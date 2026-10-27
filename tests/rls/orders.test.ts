import { beforeAll, describe, expect, it } from "vitest";
import { as, connect, fails, makeProduct, makeUser, orderPayload, resetDb, zoneId } from "./helpers";
import type { Client } from "pg";

let db: Client;
let zone: string;
let adminId: string;

async function place(payload: object) {
  const { rows } = await db.query("select public.create_order($1::jsonb) as o", [JSON.stringify(payload)]);
  return rows[0].o as Record<string, any>;
}
const stock = async (variantId: string) =>
  (await db.query("select stock from public.product_variants where id=$1", [variantId])).rows[0].stock as number;

beforeAll(async () => {
  resetDb();
  db = await connect();
  zone = await zoneId(db, "Alexandria");
  adminId = await makeUser(db, "o@test", "owner");
  await db.query("update public.shipping_zones set fee_piasters = 6000 where id = $1", [zone]);
});

describe("create_order — pricing is computed by the database", () => {
  it("totals subtotal + shipping, snapshots the item, decrements stock, counts the sale", async () => {
    const p = await makeProduct(db, { price: 100_000, compare: 140_000, stock: 5 });
    const o = await place(orderPayload({ zone, items: [{ variant_id: p.variantId, qty: 2 }] }));
    expect(o).toMatchObject({ subtotal_piasters: 200_000, shipping_piasters: 6_000, total_piasters: 206_000, status: "processing", replayed: false });
    expect(o.order_number).toMatch(/^AKM-[0-9A-HJKMNP-TV-Z]{6}$/);
    expect(await stock(p.variantId)).toBe(3);
    const item = (await db.query("select * from public.order_items where order_id=$1", [o.order_id])).rows[0];
    expect(item).toMatchObject({ unit_price_piasters: 100_000, original_unit_price_piasters: 140_000, qty: 2, line_total_piasters: 200_000 });
    expect(item.product_name).toContain("Test t-");
    expect((await db.query("select sold_count from public.products where id=$1", [p.productId])).rows[0].sold_count).toBe(2);
  });

  it("keeps the order snapshot when the catalog changes later", async () => {
    const p = await makeProduct(db, { price: 50_000 });
    const o = await place(orderPayload({ zone, items: [{ variant_id: p.variantId, qty: 1 }] }));
    await db.query("update public.products set price_piasters = 99_999, name = 'Renamed' where id=$1", [p.productId]);
    const item = (await db.query("select product_name, unit_price_piasters from public.order_items where order_id=$1", [o.order_id])).rows[0];
    expect(item.unit_price_piasters).toBe(50_000);
    expect(item.product_name).not.toBe("Renamed");
    await db.query("delete from public.products where id=$1", [p.productId]);
    const kept = (await db.query("select product_name, variant_id from public.order_items where order_id=$1", [o.order_id])).rows[0];
    expect(kept.product_name).toContain("Test t-");
    expect(kept.variant_id).toBeNull();
  });

  it("ignores any price the client tries to send", async () => {
    const p = await makeProduct(db, { price: 70_000 });
    const o = await place({
      ...orderPayload({ zone, items: [{ variant_id: p.variantId, qty: 1 }] }),
      total_piasters: 1, unit_price: 1, subtotal_piasters: 1,
    });
    expect(o.subtotal_piasters).toBe(70_000);
  });

  it("merges duplicate lines and rejects quantities above the cap", async () => {
    const p = await makeProduct(db, { stock: 50 });
    const o = await place(orderPayload({ zone, items: [{ variant_id: p.variantId, qty: 3 }, { variant_id: p.variantId, qty: 2 }] }));
    expect((await db.query("select qty from public.order_items where order_id=$1", [o.order_id])).rows).toEqual([{ qty: 5 }]);
    expect(await fails(db, "select public.create_order($1::jsonb)", [JSON.stringify(
      orderPayload({ zone, items: [{ variant_id: p.variantId, qty: 11 }] }))])).toMatch(/AKM_BAD_QTY/);
  });

  it("rejects draft products, inactive variants, bad zone, empty cart, bad phone", async () => {
    const draft = await makeProduct(db, { status: "draft" });
    expect(await fails(db, "select public.create_order($1::jsonb)", [JSON.stringify(orderPayload({ zone, items: [{ variant_id: draft.variantId, qty: 1 }] }))])).toMatch(/AKM_UNAVAILABLE/);
    const p = await makeProduct(db);
    await db.query("update public.product_variants set is_active=false where id=$1", [p.variantId]);
    expect(await fails(db, "select public.create_order($1::jsonb)", [JSON.stringify(orderPayload({ zone, items: [{ variant_id: p.variantId, qty: 1 }] }))])).toMatch(/AKM_UNAVAILABLE/);
    const q = await makeProduct(db);
    expect(await fails(db, "select public.create_order($1::jsonb)", [JSON.stringify(orderPayload({ zone: crypto.randomUUID(), items: [{ variant_id: q.variantId, qty: 1 }] }))])).toMatch(/AKM_BAD_GOVERNORATE/);
    expect(await fails(db, "select public.create_order($1::jsonb)", [JSON.stringify(orderPayload({ zone, items: [] }))])).toMatch(/AKM_EMPTY_CART/);
    expect(await fails(db, "select public.create_order($1::jsonb)", [JSON.stringify(orderPayload({ zone, phone: "12345", items: [{ variant_id: q.variantId, qty: 1 }] }))])).toMatch(/phone/);
    expect(await stock(q.variantId)).toBe(10); // nothing leaked from failed attempts
  });

  it("applies active offers, and ignores expired or inactive ones", async () => {
    const p = await makeProduct(db, { price: 100_000, compare: 150_000 });
    const off = (await db.query("insert into public.offers (name) values ('20 off') returning id")).rows[0].id;
    await db.query("insert into public.offer_rules (offer_id, scope, target_id, percent_off) values ($1,'product',$2,20)", [off, p.productId]);
    const sf = (await db.query("select price_piasters, original_price_piasters from public.storefront_products where id=$1", [p.productId])).rows[0];
    expect(sf).toEqual({ price_piasters: 80_000, original_price_piasters: 150_000 });
    const o = await place(orderPayload({ zone, items: [{ variant_id: p.variantId, qty: 1 }] }));
    expect(o.subtotal_piasters).toBe(80_000);
    await db.query("update public.offers set ends_at = now() - interval '1 hour', starts_at = now() - interval '2 hours' where id=$1", [off]);
    expect((await db.query("select price_piasters from public.storefront_products where id=$1", [p.productId])).rows[0].price_piasters).toBe(100_000);
  });
});

describe("coupons and shipping", () => {
  it("percent coupon, usage counted, free shipping above threshold", async () => {
    await db.query("insert into public.coupons (code,type,value) values ('TEN','percent',10)");
    const p = await makeProduct(db, { price: 100_000 });
    const o = await place(orderPayload({ zone, coupon: "ten", items: [{ variant_id: p.variantId, qty: 1 }] }));
    expect(o).toMatchObject({ subtotal_piasters: 100_000, discount_piasters: 10_000, shipping_piasters: 6_000, total_piasters: 96_000 });
    expect((await db.query("select used_count from public.coupons where code='TEN'")).rows[0].used_count).toBe(1);

    await db.query("update public.settings set value='95000' where key='free_shipping_threshold_piasters'");
    const o2 = await place(orderPayload({ zone, items: [{ variant_id: p.variantId, qty: 1 }] }));
    expect(o2.shipping_piasters).toBe(0);
    const o3 = await place(orderPayload({ zone, coupon: "TEN", items: [{ variant_id: p.variantId, qty: 1 }] }));
    // 100000 - 10000 = 90000 < 95000 → threshold is checked AFTER discount
    expect(o3.shipping_piasters).toBe(6_000);
    await db.query("update public.settings set value='0' where key='free_shipping_threshold_piasters'");
  });

  it("fixed and free_shipping coupons", async () => {
    await db.query("insert into public.coupons (code,type,value) values ('FIX500','fixed',50000), ('SHIPFREE','free_shipping',0)");
    const p = await makeProduct(db, { price: 30_000 });
    const a = await place(orderPayload({ zone, coupon: "FIX500", items: [{ variant_id: p.variantId, qty: 1 }] }));
    expect(a.discount_piasters).toBe(30_000); // never more than the subtotal
    const b = await place(orderPayload({ zone, coupon: "SHIPFREE", items: [{ variant_id: p.variantId, qty: 1 }] }));
    expect(b).toMatchObject({ shipping_piasters: 0, total_piasters: 30_000 });
  });

  it("rejects expired, used-up, not-yet-started, inactive, below-minimum and unknown coupons", async () => {
    await db.query(`insert into public.coupons (code,type,value,expires_at) values ('OLD','percent',10, now() - interval '1 day')`);
    await db.query(`insert into public.coupons (code,type,value,starts_at) values ('SOON','percent',10, now() + interval '1 day')`);
    await db.query(`insert into public.coupons (code,type,value,max_uses) values ('ONCE','percent',10, 1)`);
    await db.query(`insert into public.coupons (code,type,value,is_active) values ('OFF','percent',10, false)`);
    await db.query(`insert into public.coupons (code,type,value,min_subtotal_piasters) values ('BIGONLY','percent',10, 900000)`);
    const p = await makeProduct(db, { price: 30_000 });
    const items = [{ variant_id: p.variantId, qty: 1 }];
    await place(orderPayload({ zone, coupon: "ONCE", items }));
    for (const code of ["OLD", "SOON", "ONCE", "OFF", "BIGONLY", "NOPE"]) {
      expect(await fails(db, "select public.create_order($1::jsonb)", [JSON.stringify(orderPayload({ zone, coupon: code, items }))])).toMatch(/AKM_COUPON_INVALID/);
    }
    expect(await stock(p.variantId)).toBe(9); // only the ONCE order consumed stock
  });

  it("refuses payment methods the owner has disabled", async () => {
    const p = await makeProduct(db);
    expect(await fails(db, "select public.create_order($1::jsonb)", [JSON.stringify(orderPayload({ zone, method: "card", items: [{ variant_id: p.variantId, qty: 1 }] }))])).toMatch(/AKM_PAYMENT_DISABLED/);
  });
});

describe("stock safety and idempotency", () => {
  it("never oversells under concurrent orders for the last unit", async () => {
    const p = await makeProduct(db, { stock: 1 });
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, async () => {
        const c = await connect();
        try {
          await c.query("select public.create_order($1::jsonb)", [JSON.stringify(orderPayload({ zone, items: [{ variant_id: p.variantId, qty: 1 }] }))]);
        } finally { await c.end(); }
      }),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const msgs = results.filter((r) => r.status === "rejected").map((r) => (r as PromiseRejectedResult).reason.message);
    expect(msgs.every((m) => /AKM_OUT_OF_STOCK/.test(m))).toBe(true);
    expect(await stock(p.variantId)).toBe(0);
  });

  it("creates exactly one order when the same idempotency key is submitted concurrently", async () => {
    const p = await makeProduct(db, { stock: 10 });
    const key = crypto.randomUUID();
    const payload = JSON.stringify(orderPayload({ zone, key, items: [{ variant_id: p.variantId, qty: 2 }] }));
    const outs = await Promise.all(
      Array.from({ length: 6 }, async () => {
        const c = await connect();
        try { return (await c.query("select public.create_order($1::jsonb) as o", [payload])).rows[0].o; }
        finally { await c.end(); }
      }),
    );
    expect(new Set(outs.map((o) => o.order_number)).size).toBe(1);
    expect(outs.filter((o) => o.replayed === false)).toHaveLength(1);
    expect(await stock(p.variantId)).toBe(8); // decremented once
    expect((await db.query("select count(*)::int c from public.orders where idempotency_key=$1", [key])).rows[0].c).toBe(1);
  });
});

describe("lifecycle", () => {
  it("cancelling restocks and uncounts the sale; invalid transitions are refused", async () => {
    const p = await makeProduct(db, { stock: 5 });
    const o = await place(orderPayload({ zone, method: "instapay", items: [{ variant_id: p.variantId, qty: 3 }] }));
    expect(o.status).toBe("pending_payment");
    expect(await stock(p.variantId)).toBe(2);
    expect(await fails(db, "select public.system_set_order_status($1,'delivered')", [o.order_id])).toMatch(/AKM_BAD_TRANSITION/);
    await db.query("select public.system_set_order_status($1,'cancelled','test')", [o.order_id]);
    expect(await stock(p.variantId)).toBe(5);
    expect((await db.query("select sold_count from public.products where id=$1", [p.productId])).rows[0].sold_count).toBe(0);
    expect(await fails(db, "select public.system_set_order_status($1,'paid')", [o.order_id])).toMatch(/AKM_BAD_TRANSITION/);
    await db.query("select public.system_set_order_status($1,'cancelled')", [o.order_id]); // idempotent no-op
    expect(await stock(p.variantId)).toBe(5); // not restocked twice
    const events = (await db.query("select to_status from public.order_events where order_id=$1 order by id", [o.order_id])).rows.map((r) => r.to_status);
    expect(events).toEqual(["pending_payment", "cancelled"]);
  });

  it("InstaPay: receipt upload → awaiting_verification → admin approves → paid", async () => {
    const p = await makeProduct(db);
    const o = await place(orderPayload({ zone, method: "instapay", items: [{ variant_id: p.variantId, qty: 1 }] }));
    await db.query("select public.attach_receipt($1,'receipts/x.jpg')", [o.order_id]);
    expect((await db.query("select status from public.orders where id=$1", [o.order_id])).rows[0].status).toBe("awaiting_verification");
    const rid = (await db.query("select id from public.instapay_receipts where order_id=$1", [o.order_id])).rows[0].id;
    await as({ role: "authenticated", sub: adminId }, async (c) => {
      await c.query("select public.review_receipt($1,true,null)", [rid]);
    }, { commit: true });
    expect((await db.query("select status from public.orders where id=$1", [o.order_id])).rows[0].status).toBe("paid");
    expect((await db.query("select status from public.payments where order_id=$1", [o.order_id])).rows[0].status).toBe("succeeded");
  });

  it("InstaPay: a rejected receipt returns the order to pending_payment", async () => {
    const p = await makeProduct(db);
    const o = await place(orderPayload({ zone, method: "instapay", items: [{ variant_id: p.variantId, qty: 1 }] }));
    await db.query("select public.attach_receipt($1,'receipts/y.jpg')", [o.order_id]);
    const rid = (await db.query("select id from public.instapay_receipts where order_id=$1", [o.order_id])).rows[0].id;
    await as({ role: "authenticated", sub: adminId }, async (c) => { await c.query("select public.review_receipt($1,false,'blurry')", [rid]); }, { commit: true });
    expect((await db.query("select status from public.orders where id=$1", [o.order_id])).rows[0].status).toBe("pending_payment");
  });

  it("receipts are only accepted for InstaPay orders that are awaiting payment", async () => {
    const p = await makeProduct(db);
    const cod = await place(orderPayload({ zone, method: "cod", items: [{ variant_id: p.variantId, qty: 1 }] }));
    expect(await fails(db, "select public.attach_receipt($1,'x')", [cod.order_id])).toMatch(/AKM_RECEIPT_NOT_ALLOWED/);
  });

  it("COD: delivered marks the payment succeeded", async () => {
    const p = await makeProduct(db);
    const o = await place(orderPayload({ zone, method: "cod", items: [{ variant_id: p.variantId, qty: 1 }] }));
    for (const s of ["shipped", "delivered"]) await db.query("select public.system_set_order_status($1,$2)", [o.order_id, s]);
    expect((await db.query("select status from public.payments where order_id=$1", [o.order_id])).rows[0].status).toBe("succeeded");
  });

  it("expires stale unpaid orders and restocks them, leaving COD and fresh orders alone", async () => {
    const p = await makeProduct(db, { stock: 4 });
    const stale = await place(orderPayload({ zone, method: "instapay", items: [{ variant_id: p.variantId, qty: 1 }] }));
    const fresh = await place(orderPayload({ zone, method: "instapay", items: [{ variant_id: p.variantId, qty: 1 }] }));
    const cod = await place(orderPayload({ zone, method: "cod", items: [{ variant_id: p.variantId, qty: 1 }] }));
    await db.query("update public.orders set created_at = now() - interval '48 hours' where id in ($1,$2)", [stale.order_id, cod.order_id]);
    const n = (await db.query("select public.expire_unpaid_orders() as n")).rows[0].n;
    expect(n).toBe(1);
    const st = (id: string) => db.query("select status from public.orders where id=$1", [id]).then((r) => r.rows[0].status);
    expect(await st(stale.order_id)).toBe("cancelled");
    expect(await st(fresh.order_id)).toBe("pending_payment");
    expect(await st(cod.order_id)).toBe("processing");
    expect(await stock(p.variantId)).toBe(2);
  });
});

describe("track_order", () => {
  it("needs both the order number and the matching phone, and leaks no personal details", async () => {
    const p = await makeProduct(db);
    const o = await place(orderPayload({ zone, phone: "01234567890", items: [{ variant_id: p.variantId, qty: 1 }] }));
    const t = async (n: string, ph: string) => (await db.query("select public.track_order($1,$2) as t", [n, ph])).rows[0].t;
    expect(await t(o.order_number, "01099999999")).toBeNull();
    expect(await t("AKM-ZZZZZZ", "01234567890")).toBeNull();
    const ok = await t(o.order_number.toLowerCase(), "01234567890");
    expect(ok.order_number).toBe(o.order_number);
    const flat = JSON.stringify(ok);
    for (const secret of ["01234567890", "Test Customer", "1 Test Street", "Near the tram", "Smouha"]) expect(flat).not.toContain(secret);
  });
});

describe("rate_limit_hit", () => {
  it("allows up to max hits per window then blocks", async () => {
    const r: boolean[] = [];
    for (let i = 0; i < 5; i++) r.push((await db.query("select public.rate_limit_hit('t:1', 60, 3) as ok")).rows[0].ok);
    expect(r).toEqual([true, true, true, false, false]);
    await db.query("update public.rate_limits set window_start = now() - interval '2 minutes' where key='t:1'");
    expect((await db.query("select public.rate_limit_hit('t:1', 60, 3) as ok")).rows[0].ok).toBe(true);
  });
});

describe("shop_products", () => {
  it("filters, sorts and paginates", async () => {
    const all = (await db.query("select count(*)::int c from public.storefront_products")).rows[0].c;
    const page = await db.query("select * from public.shop_products(p_limit=>2, p_offset=>0, p_sort=>'price_asc')");
    expect(page.rowCount).toBe(2);
    expect(Number(page.rows[0].total_count)).toBe(all);
    const prices = page.rows.map((r) => r.product.price_piasters);
    expect(prices[0]).toBeLessThanOrEqual(prices[1]);
    const sale = await db.query("select product from public.shop_products(p_sale=>true)");
    expect(sale.rows.every((r) => r.product.is_on_sale)).toBe(true);
    const cat = await db.query("select product from public.shop_products(p_category=>'boots')");
    expect(cat.rows.map((r) => r.product.name)).toEqual(["Demo Boot 4"]);
    const hostile = await db.query("select * from public.shop_products(p_q=>'%_%')"); // wildcards are stripped, not interpreted
    expect(Number(hostile.rows[0].total_count)).toBe(all);
  });
});

describe("quote_cart (cart page)", () => {
  const quote = async (p: object) => (await db.query("select public.quote_cart($1::jsonb) as q", [JSON.stringify(p)])).rows[0].q;

  it("matches what create_order will charge, without touching stock", async () => {
    await db.query("insert into public.coupons (code,type,value) values ('Q10','percent',10) on conflict do nothing");
    const p = await makeProduct(db, { price: 100_000, stock: 5 });
    const req = { items: [{ variant_id: p.variantId, qty: 2 }], coupon_code: "q10", governorate_id: zone };
    const q = await quote(req);
    expect(q).toMatchObject({ subtotal: 200_000, discount: 20_000, shipping: 6_000, total: 186_000, zone: { name: "Alexandria" } });
    expect(await stock(p.variantId)).toBe(5);
    const o = await place({ ...orderPayload({ zone, coupon: "Q10", items: [{ variant_id: p.variantId, qty: 2 }] }) });
    expect(o.total_piasters).toBe(q.total);
  });

  it("reports problems per line and per coupon instead of raising", async () => {
    const p = await makeProduct(db, { stock: 2 });
    const gone = await makeProduct(db, { status: "draft" });
    const q = await quote({ items: [{ variant_id: p.variantId, qty: 5 }, { variant_id: gone.variantId, qty: 1 }], coupon_code: "NOPE" });
    const byVar = Object.fromEntries(q.lines.map((l: any) => [l.variant_id, l]));
    expect(byVar[p.variantId]).toMatchObject({ issue: "limited_stock", max_qty: 2 });
    expect(byVar[gone.variantId]).toMatchObject({ issue: "unavailable" });
    expect(q.coupon_error).toBe("unavailable");
    expect(q.subtotal).toBe(0); // problem lines are not charged
    expect(q.shipping).toBeNull(); // no governorate chosen yet
  });

  it("shows how far the customer is from free shipping, and hides exact stock when plentiful", async () => {
    await db.query("update public.settings set value='500000' where key='free_shipping_threshold_piasters'");
    const p = await makeProduct(db, { price: 100_000, stock: 50 });
    const q = await quote({ items: [{ variant_id: p.variantId, qty: 1 }], governorate_id: zone });
    expect(q.free_shipping_remaining).toBe(400_000);
    expect(q.lines[0].stock_left).toBeNull();
    expect(q.lines[0].max_qty).toBeNull();
    await db.query("update public.settings set value='0' where key='free_shipping_threshold_piasters'");
  });

  it("is not callable by visitors", async () => {
    await as({ role: "anon" }, async (c) => {
      expect(await fails(c, "select public.quote_cart('{}'::jsonb)")).toMatch(/permission denied/);
    });
  });
});
