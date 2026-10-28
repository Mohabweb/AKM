import "server-only";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { describeDbFailure, logDetail, type ApiFail, type DbFailure, type FailKind } from "@/lib/api-errors";

export type { ApiFail, FailKind };

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

function logFail(scope: string, fail: ApiFail & { reason?: string }, detail?: unknown) {
  const reason = "reason" in fail && fail.reason ? ` reason=${fail.reason}` : "";
  const at = new Date().toISOString();
  // One line per failure, on stderr, with the cause the operator needs. No customer PII: callers pass logDetail().
  console.error(
    `[${scope}] FAIL kind=${fail.kind} code=${fail.code}${reason} status=${fail.status} at=${at} :: ${fail.error}` +
      (detail === undefined ? "" : ` detail=${JSON.stringify(detail)}`),
  );
}

export function failJson(scope: string, fail: ApiFail & { reason?: string }, detail?: unknown, headers?: Record<string, string>) {
  logFail(scope, fail, detail);
  return json({ error: fail.error, code: fail.code, kind: fail.kind }, fail.status, headers);
}

export function validationFail(scope: string, error: ZodError, fallback = "Please check the highlighted fields.", headers?: Record<string, string>): Response {
  const first = error.issues[0];
  const field = first?.path.filter((p) => typeof p === "string" || typeof p === "number").join(".") || undefined;
  const message = first?.message ?? fallback;
  return failJson(
    scope,
    { status: 400, kind: "validation", code: "VALIDATION", error: message },
    { field, issues: error.issues.map((i) => ({ path: i.path, message: i.message })) },
    headers,
  );
}

/**
 * Maps a Supabase/Postgres error to a safe customer message plus a precise server-side reason.
 * Accepts either an error object ({ message, code, details, hint }) or a bare message string.
 */
export function dbError(error: unknown): DbFailure {
  return describeDbFailure(error);
}

/** Logs a database failure with its classified reason and returns the safe response. */
export function dbFailJson(scope: string, error: unknown, extra?: Record<string, unknown>, headers?: Record<string, string>): Response {
  return failJson(scope, describeDbFailure(error), { ...logDetail(error), ...extra }, headers);
}

export async function readJson(req: Request, maxBytes = 20_000): Promise<unknown | null> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return null;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
