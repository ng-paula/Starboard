import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthShell from "@/components/AuthShell";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { error, message } = await searchParams;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to save your tasks and pick up where you left off."
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
      {message && (
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
