// LOCAL TEST TOOLING ONLY — DO NOT DEPLOY. A tiny stand-in for the Supabase HTTP surface so the app can run against
// a plain local Postgres + PostgREST: /rest/v1 -> PostgREST, /auth/v1 (minimal GoTrue mock), /storage/v1 (in-memory).
// It exists so E2E tests exercise real SQL, RLS and PostgREST. It does NOT prove behaviour of real Supabase Auth/Storage.
import http from "node:http";
import pg from "pg";
import { createHmac, randomUUID, randomBytes } from "node:crypto";
import { sign, verify } from "./jwt.mjs";

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const REST = process.env.POSTGREST_URL ?? "http://127.0.0.1:54322";
const DB = process.env.DATABASE_URL ?? "postgres://postgres@localhost:5432/akm_dev";
const PASSWORD = process.env.LOCAL_TEST_PASSWORD ?? "e2e-password-123";
const pool = new pg.Pool({ connectionString: DB });

// ---------- minimal TOTP (RFC 6238) ----------
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const b32enc = (buf) => { let bits = "", out = ""; for (const b of buf) bits += b.toString(2).padStart(8, "0"); for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)]; return out; };
const b32dec = (s) => { let bits = ""; for (const c of s) bits += B32.indexOf(c).toString(2).padStart(5, "0"); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); };
export function totp(secret, t = Date.now()) {
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(t / 30000)));
  const h = createHmac("sha1", b32dec(secret)).update(c).digest(); const o = h[19] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, "0");
}
const factors = new Map(); // userId -> [{id, secret, status}]
const challenges = new Map();
const refresh = new Map(); // refresh token -> {sub, aal}

const send = (res, code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c))); });

async function userRow(id) { const { rows } = await pool.query("select id, email from auth.users where id = $1", [id]); return rows[0]; }
function userObj(u, aal) {
  const fs = (factors.get(u.id) ?? []).map((f) => ({ id: f.id, factor_type: "totp", status: f.status, friendly_name: "authenticator" }));
  return { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, app_metadata: {}, user_metadata: {}, factors: fs, created_at: new Date().toISOString() };
}
function session(u, aal) {
  const now = Math.floor(Date.now() / 1000);
  const access = sign({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", aal, amr: [{ method: "password", timestamp: now }, ...(aal === "aal2" ? [{ method: "totp", timestamp: now }] : [])], iat: now, exp: now + 3600, session_id: randomUUID() });
  const rt = randomBytes(12).toString("hex"); refresh.set(rt, { sub: u.id, aal });
  return { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: rt, user: userObj(u, aal) };
}
const bearer = (req) => verify((req.headers.authorization ?? "").replace(/^Bearer /i, ""));

async function auth(req, res, url, body) {
  const p = url.pathname.replace("/auth/v1", "");
  if (p === "/token" && url.searchParams.get("grant_type") === "password") {
    const { email, password } = JSON.parse(body || "{}");
    const { rows } = await pool.query("select id, email from auth.users where lower(email) = lower($1)", [email ?? ""]);
    if (!rows[0] || password !== PASSWORD) return send(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
    return send(res, 200, session(rows[0], "aal1"));
  }
  if (p === "/token" && url.searchParams.get("grant_type") === "refresh_token") {
    const { refresh_token } = JSON.parse(body || "{}"); const r = refresh.get(refresh_token);
    if (!r) return send(res, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
    return send(res, 200, session(await userRow(r.sub), r.aal));
  }
  const claims = bearer(req);
  if (!claims?.sub) return send(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
  const u = await userRow(claims.sub);
  if (!u) return send(res, 401, { code: 401, msg: "user not found" });
  if (p === "/user" && req.method === "GET") return send(res, 200, userObj(u, claims.aal));
  if (p === "/logout") { res.writeHead(204); return res.end(); }
  if (p === "/factors" && req.method === "POST") {
    const secret = b32enc(randomBytes(20)); const f = { id: randomUUID(), secret, status: "unverified" };
    factors.set(u.id, [...(factors.get(u.id) ?? []).filter((x) => x.status === "verified"), f]);
    const uri = `otpauth://totp/AKM:${u.email}?secret=${secret}&issuer=AKM`;
    return send(res, 200, { id: f.id, type: "totp", totp: { qr_code: `data:image/svg+xml;utf8,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg'/>")}`, secret, uri } });
  }
  const m = p.match(/^\/factors\/([^/]+)\/(challenge|verify)$/);
  if (m) {
    const f = (factors.get(u.id) ?? []).find((x) => x.id === m[1]);
    if (!f) return send(res, 404, { code: 404, msg: "factor not found" });
    if (m[2] === "challenge") { const id = randomUUID(); challenges.set(id, f.id); return send(res, 200, { id, type: "totp", expires_at: Math.floor(Date.now() / 1000) + 300 }); }
    const { challenge_id, code } = JSON.parse(body || "{}");
    if (challenges.get(challenge_id) !== f.id || ![-30000, 0, 30000].some((d) => totp(f.secret, Date.now() + d) === String(code)))
      return send(res, 400, { code: 400, error_code: "mfa_verification_failed", msg: "Invalid TOTP code entered" });
    challenges.delete(challenge_id); f.status = "verified";
    return send(res, 200, session(u, "aal2"));
  }
  if (p === "/user" && req.method === "PUT") { return send(res, 200, userObj(u, claims.aal)); }
  return send(res, 404, { code: 404, msg: "not mocked: " + p });
}

const objects = new Map();
async function storage(req, res, url, body) {
  const p = url.pathname.replace("/storage/v1", "");
  const claims = bearer(req);
  if (!claims || !["service_role", "authenticated"].includes(claims.role)) return send(res, 401, { error: "unauthorized" });
  let m;
  if ((m = p.match(/^\/object\/([^/]+)\/(.+)$/)) && ["POST", "PUT"].includes(req.method)) { objects.set(`${m[1]}/${m[2]}`, body); return send(res, 200, { Key: `${m[1]}/${m[2]}` }); }
  if ((m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === "POST") return send(res, 200, { signedURL: `/object/sign/${m[1]}/${m[2]}?token=local` });
  if ((m = p.match(/^\/object\/([^/]+)$/)) && req.method === "DELETE") { for (const k of JSON.parse(body || "{}").prefixes ?? []) objects.delete(`${m[1]}/${k}`); return send(res, 200, []); }
  return send(res, 404, { error: "not mocked: " + p });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const body = await readBody(req);
  try {
    if (url.pathname.startsWith("/rest/v1")) {
      const target = new URL(REST + url.pathname.replace("/rest/v1", "") + url.search);
      const headers = { ...req.headers, host: target.host }; delete headers["content-length"];
      const up = await fetch(target, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
      const out = Buffer.from(await up.arrayBuffer());
      const h = Object.fromEntries(up.headers); delete h["content-encoding"]; delete h["transfer-encoding"]; h["content-length"] = out.length;
      res.writeHead(up.status, h); return res.end(out);
    }
    if (url.pathname.startsWith("/auth/v1")) return await auth(req, res, url, body.toString());
    if (url.pathname.startsWith("/storage/v1")) return await storage(req, res, url, body);
    send(res, 404, { error: "not found" });
  } catch (e) { console.error(e); send(res, 500, { error: String(e.message) }); }
}).listen(PORT, () => console.log(`local gateway on :${PORT} -> ${REST}`));
