"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/app/(admin)/admin/actions";

export default function AdminLoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, {});

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F23]">Sign In</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Enter your admin credentials. Two-factor authentication (TOTP) is required.
        </p>
      </div>

      {state.error && (
        <div
          className={`p-4 rounded-xl text-sm mb-6 ${
            state.lockout
              ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-amber-50 text-amber-900 border border-amber-200"
          }`}
          role="alert"
        >
          <div className="font-semibold mb-0.5">
            {state.lockout ? "Account Locked" : "Unable to sign in"}
          </div>
          <div>{state.error}</div>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-semibold text-[#0B1F23] mb-1.5"
          >
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="owner@akmshoes.com"
            className="w-full px-4 py-3 rounded-xl border border-neutral-300 text-base text-[#0B1F23] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#0E7C89] focus:border-transparent transition-all"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-[#0B1F23]"
            >
              Password
            </label>
            <Link
              href="/admin/forgot-password"
              className="text-xs font-medium text-[#0E7C89] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••••••"
            className="w-full px-4 py-3 rounded-xl border border-neutral-300 text-base text-[#0B1F23] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#0E7C89] focus:border-transparent transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={isPending || state.lockout}
          className="w-full mt-2 py-3.5 px-6 rounded-xl bg-[#0E7C89] hover:bg-[#0b646f] text-white font-medium text-base shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              <span>Verifying...</span>
            </>
          ) : (
            <span>Continue to 2FA</span>
          )}
        </button>
      </form>
    </div>
  );
}
