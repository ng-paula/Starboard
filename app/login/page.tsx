import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-white px-4 py-8">
      <div
        className="absolute inset-0 z-0 bg-[repeating-linear-gradient(90deg,#b3d7f5,#b3d7f5_16px,#ffffff_16px,#ffffff_32px)] sm:bg-[repeating-linear-gradient(90deg,#b3d7f5,#b3d7f5_28px,#ffffff_28px,#ffffff_56px)] md:bg-[repeating-linear-gradient(90deg,#b3d7f5,#b3d7f5_40px,#ffffff_40px,#ffffff_80px)]"
      />

      <div className="relative z-10 w-full max-w-sm bg-white rounded-3xl p-6 sm:p-8 shadow-[0_20px_45px_-15px_rgba(91,75,69,0.35)] border-2 border-folder-pink/60 flex flex-col items-center gap-5">
        <Link href="/" aria-label="Back to home">
          <Image src="/sb_logo.png" alt="Starboard" width={1640} height={500} className="w-40 h-auto" />
        </Link>

        <div className="w-full flex flex-col gap-1 text-center">
          <h1 className="font-logo text-2xl text-ink">Welcome back</h1>
          <p className="text-sm text-ink/70">Log in to pick up where you left off.</p>
        </div>

        {message && (
          <p className="w-full text-center text-xs font-medium text-button-greenDark bg-button-green/15 border border-button-green/40 rounded-xl px-3 py-2">
            {message}
          </p>
        )}
        {error && (
          <p className="w-full text-center text-xs font-medium text-danger bg-danger/10 border border-danger/30 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <form action={login} className="w-full flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-xs font-semibold text-ink/70">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full p-3 rounded-xl border-2 border-ink/10 focus:border-folder-pinkDeep focus:outline-none text-sm text-ink bg-ink/5 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-xs font-semibold text-ink/70">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full p-3 rounded-xl border-2 border-ink/10 focus:border-folder-pinkDeep focus:outline-none text-sm text-ink bg-ink/5 transition-colors"
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full py-3 rounded-full bg-button-greenDeep hover:bg-button-greenDark text-white text-sm font-bold shadow-sm transition-colors active:scale-95"
          >
            Log In
          </button>
        </form>

        <p className="text-xs text-ink/60">
          Don't have an account?{" "}
          <Link href="/signup" className="font-semibold text-folder-pinkDeep hover:text-ink transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
