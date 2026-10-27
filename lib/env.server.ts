import "server-only";
import { z } from "zod";

const empty = (v: unknown) => (v === "" ? undefined : v);
const opt = z.preprocess(empty, z.string().optional());

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  TURNSTILE_SECRET_KEY: opt,
  PAYMENT_PROVIDER: z.enum(["paymob", "none"]).default("none"),
  PAYMOB_SECRET_KEY: opt,
  PAYMOB_PUBLIC_KEY: opt,
  PAYMOB_INTEGRATION_ID: opt,
  PAYMOB_HMAC_SECRET: opt,
  PAYMOB_BASE_URL: z.preprocess(empty, z.string().url().default("https://accept.paymob.com")),
  CRON_SECRET: opt,
  RESEND_API_KEY: opt,
  EMAIL_FROM: opt,
  RATE_LIMIT_SALT: z.string().min(1).default("dev-salt"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const serverEnv = schema.parse(process.env);
