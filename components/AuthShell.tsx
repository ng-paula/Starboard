import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Cloud, Check } from "lucide-react";
import FadeIn from "./ui/FadeIn";

// Shared frame for /login and /signup: form on the left, a short "why
// sign in" panel on the right (desktop only). Server-safe.
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-canvas p-3 flex">
      <div className="flex w-full overflow-hidden rounded-[24px] border border-line bg-white shadow-card">
        <div className="flex w-full flex-col px-6 py-6 sm:px-10 md:w-1/2">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5" aria-label="Starboard home">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink">
                <Image src="/sb_star.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
              </span>
              <span className="text-[17px] font-extrabold tracking-tight text-ink">Starboard</span>
            </Link>
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink transition-colors">
              <ArrowLeft size={14} /> Back to my tasks
            </Link>
          </div>

          <FadeIn className="m-auto w-full max-w-sm py-10">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
            <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
            <div className="mt-7">{children}</div>
            <div className="mt-6 text-center text-xs text-muted">{footer}</div>
          </FadeIn>
        </div>

        <div className="relative hidden md:flex w-1/2 flex-col justify-end overflow-hidden bg-mint-soft p-10">
          <svg aria-hidden="true" viewBox="0 0 400 300" className="absolute right-0 top-8 w-[85%]">
            <path d="M30 200 C 90 60, 160 260, 230 110 S 340 60, 380 170" stroke="#F27BA6" strokeWidth="18" strokeLinecap="round" fill="none" />
            <circle cx="300" cy="225" r="40" fill="#F7C35F" />
            <path d="M150 40 l11 25 27 3 -20 18 6 27 -24 -14 -24 14 6 -27 -20 -18 27 -3z" fill="#18181B" />
            <rect x="335" y="45" width="36" height="36" rx="9" fill="#8EC5E8" transform="rotate(18 353 63)" />
          </svg>
          <div className="relative max-w-sm">
            <p className="text-2xl font-extrabold leading-tight tracking-tight text-ink">Your tasks, on every device.</p>
            <ul className="mt-5 space-y-2.5 text-sm text-ink/75">
              {[
                "Anything you made as a guest moves into your account",
                "Synced across your phone and laptop",
                "Streaks and stats that keep building",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-ink text-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-ink/60">
              <Cloud size={13} /> Signing in is optional. Starboard works without an account.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
