import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const base =
  "block w-full min-h-11 rounded-xl border border-ink/25 bg-white px-4 py-2.5 text-base text-ink placeholder:text-muted/80 " +
  "focus:border-teal-600 aria-[invalid=true]:border-danger disabled:bg-sand-2";

export function Field({ label, hint, error, id, children }: { label: string; hint?: string; error?: string; id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="mt-1 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}

type FieldProps = { label: string; hint?: string; error?: string; id: string };

export function Input({ label, hint, error, id, className, ...p }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} className={cn(base, className)} {...p} />
    </Field>
  );
}

export function Textarea({ label, hint, error, id, className, ...p }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <textarea id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} className={cn(base, "min-h-24", className)} {...p} />
    </Field>
  );
}

export function Select({ label, hint, error, id, className, children, ...p }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <select id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} className={cn(base, "appearance-auto", className)} {...p}>
        {children}
      </select>
    </Field>
  );
}
