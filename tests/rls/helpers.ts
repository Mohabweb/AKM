import { Client } from "pg";
import { execFileSync } from "node:child_process";
import path from "node:path";

export const BASE = process.env.TEST_DATABASE_URL_BASE ?? "postgres://postgres@localhost:5432";
export const DB = "akm_test";
export const URL = `${BASE}/${DB}`;

export function resetDb() {
  execFileSync(path.resolve(__dirname, "../../scripts/db-reset.sh"), [DB], {
    env: { ...process.env, DATABASE_URL: BASE },
    stdio: "pipe",
  });
}

export async function connect(): Promise<Client> {
  const c = new Client({ connectionString: URL });
  await c.connect();
  return c;
}

export type Actor = { role: "anon" | "authenticated" | "service_role"; sub?: string };

const inTx = new WeakSet<Client>();

/**
 * Runs fn inside a transaction as the given Postgres role / JWT subject.
 * Rolled back by default so checks leave no trace; pass { commit: true } when the effect must persist.
 */
export async function as<T>(actor: Actor, fn: (c: Client) => Promise<T>, opts: { commit?: boolean } = {}): Promise<T> {
  const c = await connect();
  inTx.add(c);
  try {
    await c.query("begin");
    await c.query(`set local role ${actor.role}`);
    if (actor.sub) await c.query("select set_config('request.jwt.claim.sub', $1, true)", [actor.sub]);
    const out = await fn(c);
    if (opts.commit) await c.query("commit");
    return out;
  } finally {
    await c.query("rollback").catch(() => {});
    await c.end();
  }
}

/** Expect a query to fail; returns the error message. */
export async function fails(c: Client, sql: string, params: unknown[] = []): Promise<string> {
  const tx = inTx.has(c);
  if (tx) await c.query("savepoint s");
  try {
    await c.query(sql, params);
  } catch (e) {
    if (tx) await c.query("rollback to savepoint s");
    return (e as Error).message;
  }
  throw new Error(`expected failure but succeeded: ${sql}`);
}

export async function makeUser(c: Client, email: string, role?: "owner" | "staff"): Promise<string> {
  const { rows } = await c.query("insert into auth.users (email) values ($1) returning id", [email]);
  const id = rows[0].id as string;
  if (role) await c.query("insert into public.admin_users (user_id, email, role) values ($1,$2,$3)", [id, email, role]);
  return id;
}

let n = 0;
/** Creates an isolated published product with one variant. Committed. */
export async function makeProduct(
  c: Client,
  o: { price?: number; compare?: number | null; stock?: number; status?: string; brandId?: string | null } = {},
) {
  n += 1;
  const slug = `t-${Date.now()}-${n}`;
  const { rows } = await c.query(
    `insert into public.products (name, slug, price_piasters, compare_at_piasters, status, brand_id)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [`Test ${slug}`, slug, o.price ?? 100_000, o.compare ?? null, o.status ?? "published", o.brandId ?? null],
  );
  const pid = rows[0].id as string;
  const v = await c.query(
    `insert into public.product_variants (product_id, sku, size, color, stock) values ($1,$2,'41','',$3) returning id`,
    [pid, `SKU-${slug}`, o.stock ?? 10],
  );
  return { productId: pid, variantId: v.rows[0].id as string, slug };
}

export async function zoneId(c: Client, name = "Alexandria") {
  const { rows } = await c.query("select id from public.shipping_zones where governorate=$1", [name]);
  return rows[0].id as string;
}

export function orderPayload(o: {
  items: { variant_id: string; qty: number }[];
  zone: string;
  key?: string;
  method?: "cod" | "card" | "instapay";
  coupon?: string;
  phone?: string;
}) {
  return {
    idempotency_key: o.key ?? crypto.randomUUID(),
    payment_method: o.method ?? "cod",
    customer_name: "Test Customer",
    phone: o.phone ?? "01012345678",
    governorate_id: o.zone,
    city: "Alexandria", area: "Smouha", address: "1 Test Street", landmark: "Near the tram",
    coupon_code: o.coupon,
    items: o.items,
  };
}
