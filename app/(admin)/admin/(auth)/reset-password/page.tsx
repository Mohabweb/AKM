"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction } from "@/app/(admin)/admin/actions";

export default function AdminResetPasswordPage() {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, {});

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F23]">Set New Password</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Create a new strong password for your administrator account.
        </p>
      </div>

      {state.error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm mb-6" role="alert">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-[#0B1F23] mb-1.5">
            New Password (minimum 8 characters)
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="••••••••••••"
            className="w-full px-4 py-3 rounded-xl border border-neutral-300 text-base text-[#0B1F23] focus:outline-none focus:ring-2 focus:ring-[#0E7C89] focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-semibold text-[#0B1F23] mb-1.5">
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            placeholder="••••••••••••"
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
              <span>Updating Password...</span>
            </>
          ) : (
            <span>Update Password</span>
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
