"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/app/(admin)/admin/actions";

export default function AdminForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, {});

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F23]">Reset Password</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Enter your admin email address. If an account exists, you will receive a secure password reset link.
        </p>
      </div>

      {state.success ? (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm mb-6">
          <p className="font-semibold mb-1">Check your email</p>
          <p>
            If your email is registered as an administrator, a password reset link has been sent. Please check your inbox and spam folder.
          </p>
          <div className="mt-4">
            <Link
              href="/admin/login"
              className="inline-block text-xs font-semibold text-[#0E7C89] hover:underline"
            >
              ← Return to Login
            </Link>
          </div>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          {state.error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
              {state.error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-[#0B1F23] mb-1.5">
              Admin Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="owner@akmshoes.com"
              className="w-full px-4 py-3 rounded-xl border border-neutral-300 text-base text-[#0B1F23] focus:outline-none focus:ring-2 focus:ring-[#0E7C89] focus:border-transparent transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3.5 px-6 rounded-xl bg-[#0E7C89] hover:bg-[#0b646f] text-white font-medium text-base shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                <span>Sending Reset Link...</span>
              </>
            ) : (
              <span>Send Reset Link</span>
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
      )}
    </div>
  );
}
