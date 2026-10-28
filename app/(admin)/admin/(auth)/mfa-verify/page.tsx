"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useActionState } from "react";
import { mfaVerifyAction } from "@/app/(admin)/admin/actions";

export default function AdminMfaVerifyPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(mfaVerifyAction, {});

  // No verified factor (or an expired session) means this page cannot succeed — send the admin where they can.
  useEffect(() => {
    if (state.redirectTo) router.replace(state.redirectTo);
  }, [state.redirectTo, router]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F23]">Two-Factor Verification</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Open your authenticator app and enter the current 6-digit security code for AKM Luxury Shoes.
        </p>
      </div>

      {state.error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm mb-6" role="alert">
          <p>{state.error}</p>
          {state.restart && (
            <Link href="/admin/mfa-enroll" className="mt-3 inline-block text-xs font-semibold underline underline-offset-2">
              Set up the authenticator again
            </Link>
          )}
        </div>
      )}

      <form action={formAction} className="space-y-5">
        <div>
          <label htmlFor="code" className="block text-sm font-semibold text-[#0B1F23] mb-1.5">
            Security Code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoFocus
            required
            placeholder="123456"
            autoComplete="one-time-code"
            className="w-full text-center text-3xl tracking-[0.35em] font-mono py-3.5 px-4 rounded-xl border border-neutral-300 text-[#0B1F23] placeholder:tracking-normal placeholder:font-sans placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#0E7C89] focus:border-transparent transition-all"
          />
          <p className="mt-2 text-xs text-neutral-500">
            Codes change every 30 seconds. Your phone&apos;s date and time must be set automatically, otherwise the code
            will be rejected even when it looks correct.
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3.5 px-6 rounded-xl bg-[#0E7C89] hover:bg-[#0b646f] text-white font-medium text-base shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              <span>Checking Code...</span>
            </>
          ) : (
            <span>Verify &amp; Enter Admin</span>
          )}
        </button>

        <div className="text-center pt-2">
          <Link
            href="/admin/login"
            className="text-xs font-medium text-neutral-500 hover:text-[#0E7C89] transition-colors"
          >
            ← Back to Login
          </Link>
        </div>
      </form>
    </div>
  );
}
