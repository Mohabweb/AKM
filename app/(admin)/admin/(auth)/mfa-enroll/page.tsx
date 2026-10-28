"use client";

import { useCallback, useEffect, useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { mfaEnrollInitAction, mfaEnrollVerifyAction, type MfaEnrollInit } from "@/app/(admin)/admin/actions";

export default function AdminMfaEnrollPage() {
  const router = useRouter();
  const [initData, setInitData] = useState<MfaEnrollInit | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [state, formAction, isPending] = useActionState(mfaEnrollVerifyAction, {});
  // Guard both the StrictMode double-effect and a double-click on "generate a new QR code":
  // each init replaces the pending factor, so two overlapping calls would fight over it.
  const booted = useRef(false);
  const running = useRef(false);

  const start = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setLoading(true);
    try {
      const res = await mfaEnrollInitAction();
      if (res.redirectTo) {
        router.replace(res.redirectTo);
        return;
      }
      setInitData(res);
      setLoading(false);
    } finally {
      running.current = false;
    }
  }, [router]);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void start();
  }, [start]);

  const copySecret = () => {
    if (initData?.secret) {
      navigator.clipboard.writeText(initData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-neutral-500">
        <div className="w-8 h-8 border-3 border-[#0E7C89]/30 border-t-[#0E7C89] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm">Preparing two-factor setup...</p>
      </div>
    );
  }

  if (initData?.error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 text-red-800 text-sm">
        <p className="font-semibold mb-1">Setup Failed</p>
        <p>{initData.error}</p>
        <button
          type="button"
          onClick={() => void start()}
          className="mt-4 w-full py-2.5 rounded-lg bg-[#0E7C89] hover:bg-[#0b646f] text-white font-medium transition-colors"
        >
          Try setup again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0E7C89]/10 text-[#0E7C89] text-xs font-semibold uppercase tracking-wider mb-2">
          Mandatory Security Step
        </div>
        <h1 className="text-2xl font-bold text-[#0B1F23]">Set Up Authenticator</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Scan the QR code with an authenticator app (such as Google Authenticator, Authy, or 1Password).
        </p>
      </div>

      {initData?.replacedSetup && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm mb-4">
          <p className="font-semibold mb-1">Unfinished setup replaced</p>
          <p>
            An earlier setup on this account was never confirmed, so it has been replaced. If you already added
            &ldquo;AKM Luxury Shoes&rdquo; to your app, delete that entry — it no longer works — and scan the QR code below.
          </p>
        </div>
      )}

      {initData?.qrCode && (
        <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-200 flex flex-col items-center justify-center mb-6">
          <img
            src={initData.qrCode}
            alt="MFA QR Code"
            className="w-48 h-48 bg-white p-2 rounded-xl shadow-sm border border-neutral-200"
          />

          <div className="mt-4 text-center w-full">
            <p className="text-xs text-neutral-500 mb-1">Can&apos;t scan? Enter this code manually:</p>
            <div className="flex items-center justify-center gap-2">
              <code className="text-xs font-mono font-bold bg-white px-3 py-1.5 rounded-lg border border-neutral-300 text-[#0B1F23] select-all tracking-wider">
                {initData.secret}
              </code>
              <button
                type="button"
                onClick={copySecret}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-medium transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {state.error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm mb-4" role="alert">
          <p>{state.error}</p>
          {state.restart && (
            <button
              type="button"
              onClick={() => void start()}
              className="mt-3 text-xs font-semibold underline underline-offset-2 hover:text-red-900"
            >
              Show a fresh QR code
            </button>
          )}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="factorId" value={initData?.factorId || ""} />

        <div>
          <label htmlFor="code" className="block text-sm font-semibold text-[#0B1F23] mb-1.5">
            Enter 6-Digit Code from App
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            placeholder="123456"
            autoComplete="one-time-code"
            className="w-full text-center text-2xl tracking-[0.3em] font-mono py-3 px-4 rounded-xl border border-neutral-300 text-[#0B1F23] placeholder:tracking-normal placeholder:font-sans placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#0E7C89] focus:border-transparent transition-all"
          />
          <p className="mt-2 text-xs text-neutral-500">
            Codes change every 30 seconds. If your app shows a countdown about to expire, wait for the next code.
            Your phone&apos;s date and time must be set automatically.
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
              <span>Verifying Code...</span>
            </>
          ) : (
            <span>Activate 2FA &amp; Enter Admin</span>
          )}
        </button>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => void start()}
            className="text-xs font-medium text-neutral-500 hover:text-[#0E7C89] transition-colors"
          >
            Already added the wrong entry? Generate a new QR code
          </button>
        </div>
      </form>
    </div>
  );
}
