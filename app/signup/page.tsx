import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthShell from "@/components/AuthShell";
import { signup } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { error } = await searchParams;

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free, and everything you made as a guest comes with you."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-ink hover:underline">
            Sign in
          </Link>
          <span className="mx-2 text-ink/20">·</span>
          <Link href="/" className="font-semibold text-ink hover:underline">
            Continue without an account
          </Link>
        </>
      }
    >
      {error && <p className="mb-4 rounded-xl bg-danger/5 px-3 py-2.5 text-xs font-medium text-danger">{error}</p>}

      <form action={signup} className="flex flex-col gap-4">
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
          <input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" className="field" />
          <span className="text-[11px] text-muted">At least 6 characters.</span>
        </div>
        <button type="submit" className="btn-primary mt-2 w-full py-3 text-sm">
          Create account
        </button>
      </form>
    </AuthShell>
  );
}
