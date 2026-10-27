// LOCAL TEST TOOLING ONLY. Mints HS256 JWTs for the local PostgREST gateway. Never used in production.
import { createHmac } from "node:crypto";
export const SECRET = process.env.LOCAL_JWT_SECRET ?? "local-dev-jwt-secret-local-dev-jwt-secret";
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
export function sign(payload, secret = SECRET) {
  const h = b64({ alg: "HS256", typ: "JWT" }), p = b64(payload);
  return `${h}.${p}.${createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`;
}
export function verify(token, secret = SECRET) {
  const [h, p, s] = String(token).split(".");
  if (!h || !p || !s) return null;
  const want = createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  if (want !== s) return null;
  const body = JSON.parse(Buffer.from(p, "base64url").toString());
  if (body.exp && body.exp < Date.now() / 1000) return null;
  return body;
}
if (process.argv[1]?.endsWith("jwt.mjs")) {
  const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 86400;
  console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY=" + sign({ role: "anon", iss: "local", exp }));
  console.log("SUPABASE_SERVICE_ROLE_KEY=" + sign({ role: "service_role", iss: "local", exp }));
}
