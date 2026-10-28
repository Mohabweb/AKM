import { beforeAll, describe, expect, it } from "vitest";
import { as, connect, fails, makeProduct, makeUser, resetDb } from "./helpers";

let owner: string;
let staff: string;
let customer: string; // signed-in but NOT an admin
let draftSlug: string;

beforeAll(async () => {
  resetDb();
  const c = await connect();
  owner = await makeUser(c, "owner@test", "owner");
  staff = await makeUser(c, "staff@test", "staff");
  customer = await makeUser(c, "random@test");
  const d = await makeProduct(c, { status: "draft" });
  draftSlug = d.slug;
  await c.query("insert into public.coupons (code,type,value) values ('SECRET10','percent',10)");
  await c.end();
});

const PRIVATE_TABLES = [
  "orders", "order_items", "payments", "instapay_receipts", "order_events",
  "coupons", "admin_users", "audit_log", "product_variants", "offer_rules", "rate_limits",
];

describe("anonymous visitors", () => {
  it.each(PRIVATE_TABLES)("cannot read %s", async (t) => {
    await as({ role: "anon" }, async (c) => {
      expect(await fails(c, `select * from public.${t} limit 1`)).toMatch(/permission denied/);
    });
  });

  it("see published products only, never drafts", async () => {
    await as({ role: "anon" }, async (c) => {
      const { rows } = await c.query("select slug, status from public.products");
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.status === "published")).toBe(true);
      expect(rows.find((r) => r.slug === draftSlug)).toBeUndefined();
      const sf = await c.query("select slug, price_piasters, original_price_piasters, image_url, in_stock from public.storefront_products");
      expect(sf.rowCount).toBeGreaterThan(0); // selects real rows: function EXECUTE is checked per row for the caller
      expect(sf.rows.find((r) => r.slug === draftSlug)).toBeUndefined();
    });
  });

  it("see only public settings", async () => {
    await as({ role: "anon" }, async (c) => {
      const { rows } = await c.query("select key from public.settings");
      const keys = rows.map((r) => r.key);
      expect(keys).toContain("instapay_number");
      expect(keys).not.toContain("unpaid_order_expiry_hours");
      expect(keys).not.toContain("shipping_fees_reviewed");
    });
  });

  it("see variants only through the view, without SKU or exact stock above the threshold", async () => {
    await as({ role: "anon" }, async (c) => {
      const { rows } = await c.query("select * from public.public_variants");
      expect(rows.length).toBeGreaterThan(0);
      expect(Object.keys(rows[0])).not.toContain("sku");
      expect(Object.keys(rows[0])).not.toContain("stock");
      // low_stock_threshold = 3 → anything with more than 3 left must not reveal a number
      expect(rows.every((r) => r.stock_left === null || r.stock_left <= 3)).toBe(true);
    });
  });

  it("cannot write to the catalog", async () => {
    await as({ role: "anon" }, async (c) => {
      expect(await fails(c, "insert into public.products (name,slug,price_piasters) values ('x','x',1)")).toMatch(/permission denied/);
      expect(await fails(c, "update public.products set price_piasters = 1")).toMatch(/permission denied/);
      expect(await fails(c, "delete from public.products")).toMatch(/permission denied/);
      expect(await fails(c, "update public.settings set value = '\"x\"'")).toMatch(/permission denied/);
    });
  });

  it("cannot call server-only or admin functions", async () => {
    await as({ role: "anon" }, async (c) => {
      for (const sql of [
        "select public.create_order('{}'::jsonb)",
        "select public.track_order('AKM-AAAAAA','01012345678')",
        "select public.expire_unpaid_orders(1)",
        "select public.set_order_status(gen_random_uuid(),'paid')",
        "select public.rate_limit_hit('k',60,1)",
        "select public.delete_demo_data()",
      ]) expect(await fails(c, sql)).toMatch(/permission denied/);
    });
  });

  it("cannot upload or read storage objects", async () => {
    await as({ role: "anon" }, async (c) => {
      expect(await fails(c, "insert into storage.objects (bucket_id,name) values ('product-images','x.png')")).toMatch(/permission denied/);
    });
  });
});

describe("signed-in non-admin", () => {
  it("is treated like a visitor for protected data", async () => {
    await as({ role: "authenticated", sub: customer }, async (c) => {
      expect((await c.query("select * from public.orders")).rowCount).toBe(0);
      expect((await c.query("select * from public.coupons")).rowCount).toBe(0);
      expect((await c.query("select * from public.admin_users")).rowCount).toBe(0);
      expect((await c.query("select * from public.products where status='draft'")).rowCount).toBe(0);
      expect(await fails(c, "insert into public.products (name,slug,price_piasters) values ('x','x',1)")).toMatch(/row-level security/);
      expect(await fails(c, "select public.set_order_status(gen_random_uuid(),'paid')")).toMatch(/AKM_FORBIDDEN/);
      expect(await fails(c, "insert into public.admin_users (user_id,email,role) values ($1,'x','owner')", [customer])).toMatch(/row-level security/);
    });
  });

  it("cannot upload product images or read receipts", async () => {
    await as({ role: "authenticated", sub: customer }, async (c) => {
      expect(await fails(c, "insert into storage.objects (bucket_id,name) values ('product-images','x.png')")).toMatch(/row-level security/);
    });
  });
});

describe("staff", () => {
  it("can manage catalog and read orders and drafts", async () => {
    await as({ role: "authenticated", sub: staff }, async (c) => {
      await c.query("insert into public.products (name,slug,price_piasters) values ('S','staff-made',5000)");
      expect((await c.query("select * from public.products where status='draft'")).rowCount).toBeGreaterThan(0);
      await c.query("select * from public.orders");
      await c.query("select * from public.coupons"); // read-only
    });
  });

  it("cannot delete products, write settings/coupons/shipping, read audit log, or manage admins", async () => {
    await as({ role: "authenticated", sub: staff }, async (c) => {
      expect((await c.query("delete from public.products where slug=$1", [draftSlug])).rowCount).toBe(0);
      const upd = await c.query("update public.settings set value='\"hacked\"' where key='instapay_number'");
      expect(upd.rowCount).toBe(0);
      expect(await fails(c, "insert into public.coupons (code,type,value) values ('STAFF','percent',50)")).toMatch(/row-level security/);
      expect((await c.query("update public.shipping_zones set fee_piasters = 0")).rowCount).toBe(0);
      expect((await c.query("select * from public.audit_log")).rowCount).toBe(0);
      expect(await fails(c, "insert into public.admin_users (user_id,email,role) values ($1,'y','owner')", [customer])).toMatch(/row-level security/);
      expect(await fails(c, "select public.delete_demo_data()")).toMatch(/AKM_FORBIDDEN/);
    });
  });

  it("cannot refund (owner only)", async () => {
    const c = await connect();
    const z = (await c.query("select id from public.shipping_zones limit 1")).rows[0].id;
    const p = await makeProduct(c);
    const r = await c.query("select public.create_order($1::jsonb) as o", [
      JSON.stringify({
        idempotency_key: crypto.randomUUID(), payment_method: "cod", customer_name: "Ref Test", phone: "01011111111",
        governorate_id: z, city: "c", area: "a", address: "address 1", landmark: "lm",
        items: [{ variant_id: p.variantId, qty: 1 }],
      }),
    ]);
    const id = r.rows[0].o.order_id;
    await c.end();
    await as({ role: "authenticated", sub: staff }, async (s) => {
      await s.query("select public.set_order_status($1,'shipped')", [id]);
      await s.query("select public.set_order_status($1,'delivered')", [id]);
      expect(await fails(s, "select public.set_order_status($1,'refunded')", [id])).toMatch(/AKM_FORBIDDEN/);
    });
    await as({ role: "authenticated", sub: owner }, async (o) => {
      await o.query("select public.set_order_status($1,'shipped')", [id]);
      await o.query("select public.set_order_status($1,'delivered')", [id]);
      await o.query("select public.set_order_status($1,'refunded')", [id]);
      expect((await o.query("select status from public.orders where id=$1", [id])).rows[0].status).toBe("refunded");
    });
  });
});

describe("owner", () => {
  it("manages settings, coupons, shipping and the audit trail records it", async () => {
    await as({ role: "authenticated", sub: owner }, async (c) => {
      expect((await c.query("update public.settings set value='\"01200756172\"' where key='instapay_number'")).rowCount).toBe(1);
      await c.query("insert into public.coupons (code,type,value) values ('OWNER5','percent',5)");
      expect((await c.query("update public.shipping_zones set fee_piasters = 7000 where governorate='Cairo'")).rowCount).toBe(1);
      const log = await c.query("select actor_email, action, entity from public.audit_log order by id desc limit 5");
      expect(log.rows.some((r) => r.entity === "settings" && r.actor_email === "owner@test")).toBe(true);
    });
  });

  it("can read and delete demo data via the safe function", async () => {
    const c = await connect();
    await makeUser(c, "owner2@test", "owner").catch(() => {});
    await c.end();
    await as({ role: "authenticated", sub: owner }, async (o) => {
      const { rows } = await o.query("select public.delete_demo_data() as r");
      expect(rows[0].r.products).toBe(6);
      expect((await o.query("select * from public.products where is_demo")).rowCount).toBe(0);
    });
  });

  it("cannot remove or demote the last owner", async () => {
    const c = await connect();
    await c.query("delete from public.admin_users where email='owner2@test'");
    await c.end();
    await as({ role: "authenticated", sub: owner }, async (o) => {
      expect(await fails(o, "delete from public.admin_users where user_id=$1", [owner])).toMatch(/AKM_LAST_OWNER/);
      expect(await fails(o, "update public.admin_users set role='staff' where user_id=$1", [owner])).toMatch(/AKM_LAST_OWNER/);
    });
  });
});

describe("storage policies", () => {
  it("allow admins to upload product images and read receipts", async () => {
    await as({ role: "authenticated", sub: staff }, async (c) => {
      await c.query("insert into storage.objects (bucket_id,name) values ('product-images','ok.png')");
      expect((await c.query("select * from storage.objects where bucket_id='instapay-receipts'")).rowCount).toBe(0);
    });
  });
  it("never allow client writes to the receipts bucket", async () => {
    await as({ role: "authenticated", sub: owner }, async (c) => {
      expect(await fails(c, "insert into storage.objects (bucket_id,name) values ('instapay-receipts','r.png')")).toMatch(/row-level security/);
    });
  });
  it("keeps the receipts bucket private and the images bucket public", async () => {
    const c = await connect();
    const { rows } = await c.query("select id, public from storage.buckets order by id");
    await c.end();
    expect(rows).toEqual([
      { id: "instapay-receipts", public: false },
      { id: "product-images", public: true },
    ]);
  });
});

describe("every public table has RLS enabled", () => {
  it("has no table without row level security", async () => {
    const c = await connect();
    const { rows } = await c.query(
      "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
    );
    await c.end();
    expect(rows).toEqual([]);
  });
});

describe("is_admin() requires aal2", () => {
  it("denies admin access to staff/owner when session is only aal1", async () => {
    await as({ role: "authenticated", sub: staff, aal: "aal1" }, async (c) => {
      // is_admin() should return false
      const { rows } = await c.query("select public.is_admin() as is_admin, public.is_owner() as is_owner");
      expect(rows[0].is_admin).toBe(false);
      expect(rows[0].is_owner).toBe(false);

      // Orders and draft products blocked by RLS
      expect((await c.query("select * from public.orders")).rowCount).toBe(0);
      expect((await c.query("select * from public.products where status='draft'")).rowCount).toBe(0);

      // Admin functions fail with AKM_FORBIDDEN
      expect(await fails(c, "select public.set_order_status(gen_random_uuid(), 'paid')")).toMatch(/AKM_FORBIDDEN/);
      expect(await fails(c, "select public.set_order_internal_notes(gen_random_uuid(), 'note')")).toMatch(/AKM_FORBIDDEN/);
    });

    await as({ role: "authenticated", sub: owner, aal: "aal1" }, async (c) => {
      const { rows } = await c.query("select public.is_admin() as is_admin, public.is_owner() as is_owner");
      expect(rows[0].is_admin).toBe(false);
      expect(rows[0].is_owner).toBe(false);
      expect((await c.query("select * from public.audit_log")).rowCount).toBe(0);
      expect(await fails(c, "select public.delete_demo_data()")).toMatch(/AKM_FORBIDDEN/);
    });
  });

  it("grants admin access when session is aal2", async () => {
    await as({ role: "authenticated", sub: staff, aal: "aal2" }, async (c) => {
      const { rows } = await c.query("select public.is_admin() as is_admin, public.is_owner() as is_owner");
      expect(rows[0].is_admin).toBe(true);
      expect(rows[0].is_owner).toBe(false);
      expect((await c.query("select * from public.products where status='draft'")).rowCount).toBeGreaterThan(0);
    });

    await as({ role: "authenticated", sub: owner, aal: "aal2" }, async (c) => {
      const { rows } = await c.query("select public.is_admin() as is_admin, public.is_owner() as is_owner");
      expect(rows[0].is_admin).toBe(true);
      expect(rows[0].is_owner).toBe(true);
    });
  });

  it("still denies non-admin even if they claim aal2", async () => {
    await as({ role: "authenticated", sub: customer, aal: "aal2" }, async (c) => {
      const { rows } = await c.query("select public.is_admin() as is_admin, public.is_owner() as is_owner");
      expect(rows[0].is_admin).toBe(false);
      expect(rows[0].is_owner).toBe(false);
      expect((await c.query("select * from public.orders")).rowCount).toBe(0);
    });
  });
});

describe("staff strictly cannot do owner actions", () => {
  it("cannot modify store settings", async () => {
    await as({ role: "authenticated", sub: staff, aal: "aal2" }, async (c) => {
      const res = await c.query("update public.settings set value='\"new_val\"' where key='store_name'");
      expect(res.rowCount).toBe(0);
    });
  });

  it("cannot create or modify coupons", async () => {
    await as({ role: "authenticated", sub: staff, aal: "aal2" }, async (c) => {
      expect(await fails(c, "insert into public.coupons (code,type,value) values ('STAFFFAIL','percent',10)")).toMatch(/row-level security/);
    });
  });

  it("cannot modify shipping fees", async () => {
    await as({ role: "authenticated", sub: staff, aal: "aal2" }, async (c) => {
      const res = await c.query("update public.shipping_zones set fee_piasters = 9999 where governorate='Cairo'");
      expect(res.rowCount).toBe(0);
    });
  });

  it("cannot read or write audit logs", async () => {
    await as({ role: "authenticated", sub: staff, aal: "aal2" }, async (c) => {
      expect((await c.query("select * from public.audit_log")).rowCount).toBe(0);
    });
  });

  it("cannot manage staff accounts or promote themselves to owner", async () => {
    await as({ role: "authenticated", sub: staff, aal: "aal2" }, async (c) => {
      expect(await fails(c, "update public.admin_users set role='owner' where user_id=$1", [staff])).toMatch(/row-level security/);
      expect(await fails(c, "insert into public.admin_users (user_id,email,role) values (gen_random_uuid(),'new@staff','staff')")).toMatch(/row-level security/);
    });
  });

  it("cannot delete products", async () => {
    await as({ role: "authenticated", sub: staff, aal: "aal2" }, async (c) => {
      const res = await c.query("delete from public.products where slug=$1", [draftSlug]);
      expect(res.rowCount).toBe(0);
    });
  });

  it("cannot invoke delete_demo_data", async () => {
    await as({ role: "authenticated", sub: staff, aal: "aal2" }, async (c) => {
      expect(await fails(c, "select public.delete_demo_data()")).toMatch(/AKM_FORBIDDEN/);
    });
  });
});

