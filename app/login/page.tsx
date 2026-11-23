import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AuthShell from "@/components/AuthShell";
import { login } from "./actions";
import { resendConfirmation } from "../signup/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; pending?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { error, message, pending } = await searchParams;
  const awaitingConfirmation = pending === "1";

  return (
    <AuthShell
      title={awaitingConfirmation ? "Check your inbox" : "Welcome back"}
      subtitle={
        awaitingConfirmation
          ? "Confirm your email, then sign in below."
          : "Sign in to save your tasks and pick up where you left off."
      }
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-ink hover:underline">
            Create one
          </Link>
          <span className="mx-2 text-ink/20">·</span>
          <Link href="/" className="font-semibold text-ink hover:underline">
            Continue without an account
          </Link>
        </>
      }
    >
      {awaitingConfirmation && (
        <div className="mb-6 rounded-2xl border border-line bg-canvas p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-mint-deep">
              <MailCheck size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{message || "We sent you a confirmation link."}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                It can take a minute. Check spam too. Your guest tasks stay on this device and move into your account the
                first time you sign in.
              </p>
            </div>
          </div>

          <details className="group mt-3 border-t border-line pt-3">
            <summary className="cursor-pointer list-none text-xs font-semibold text-ink hover:underline">
              Didn&apos;t get it? Resend the email
            </summary>
            <form action={resendConfirmation} className="mt-3 flex gap-2">
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                aria-label="Email to resend the confirmation to"
                className="field py-2 text-sm"
              />
              <button type="submit" className="btn-ghost shrink-0 px-3 py-2">
                Resend
              </button>
            </form>
          </details>
        </div>
      )}

      {!awaitingConfirmation && message && (
        <p className="mb-4 rounded-xl bg-mint-soft px-3 py-2.5 text-xs font-medium text-mint-deep">{message}</p>
      )}
      {error && <p className="mb-4 rounded-xl bg-danger/5 px-3 py-2.5 text-xs font-medium text-danger">{error}</p>}

      <form action={login} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-semibold text-ink">
            Email
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="field" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-semibold text-ink">
            Password
          </label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="field" />
        </div>
        <button type="submit" className="btn-primary mt-2 w-full py-3 text-sm">
          Sign in
        </button>
      </form>
    </AuthShell>
  );
}
