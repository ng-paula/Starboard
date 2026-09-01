"use client";

import React from "react";
import Image from "next/image";
import FloatingStars from "./FloatingStars";

interface LandingProps {
  onStartListing?: () => void;
  onTryDemo?: () => void;
  isDemoLoading?: boolean;
  demoError?: string | null;
}

export default function Landing({ onStartListing, onTryDemo, isDemoLoading, demoError }: LandingProps) {
  return (
    <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-white select-none px-4 py-8">

      {/* 1. Pastel Blue Striped Background */}
      <div
        className="absolute inset-0 z-0 bg-[repeating-linear-gradient(90deg,#b3d7f5,#b3d7f5_16px,#ffffff_16px,#ffffff_32px)] sm:bg-[repeating-linear-gradient(90deg,#b3d7f5,#b3d7f5_28px,#ffffff_28px,#ffffff_56px)] md:bg-[repeating-linear-gradient(90deg,#b3d7f5,#b3d7f5_40px,#ffffff_40px,#ffffff_80px)]"
      />

      {/* 2. Floating Animated Yellow Stars */}
      <FloatingStars />

      {/* 3. Central Scrapbook Folder Container */}
      <div className="relative z-10 w-full max-w-[920px] aspect-[1.3/1] flex items-center justify-center">

        {/* Pink Folder Base */}
        <Image
          src="/sb_folderFinal.png"
          alt=""
          fill
          priority
          sizes="(max-width: 920px) 100vw, 920px"
          className="object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.08)] pointer-events-none"
        />

        {/* Top-Left Polka-Dot Binder Clip — decorative only, so no pointer cursor promising a click */}
        <Image
          src="/sb_clip.png"
          alt=""
          width={1080}
          height={1350}
          sizes="13rem"
          className="absolute -top-[10%] left-[2%] w-[24%] max-w-[13rem] h-auto -rotate-12 drop-shadow-md z-20 hover:scale-110 hover:-rotate-[25deg] transition-all duration-300"
        />

        {/* Bottom-Right Tape & Green Button (decorative only) — kept below
            "Folder Interior Content" (z-20) so its bounding box, including the
            empty space around the tape/button art, never intercepts clicks
            meant for the Start Listing button */}
        <div className="absolute -bottom-[4%] right-[2%] w-[20%] max-w-36 z-10 group transition-transform duration-300 hover:scale-110 hover:rotate-3">

          {/* Washi Tape */}
          <div
            className="absolute top-[18%] -left-[22%] w-[88%] h-[24%] rotate-[-8deg] opacity-90 drop-shadow-xs transition-transform duration-300 group-hover:-rotate-[12deg]"
            style={{
              backgroundColor: "#fae8e6",
              backgroundImage: "radial-gradient(#d3747e 1.5px, transparent 1.5px)",
              backgroundSize: "8px 8px"
            }}
          />

          {/* Green Sewing Button — desaturated a touch so the fully-saturated
              green (which appears nowhere else on this page) doesn't pop
              out of the soft pastel palette */}
          <Image
            src="/sb_green-button.png"
            alt=""
            width={1080}
            height={1350}
            sizes="9rem"
            className="relative w-full h-auto drop-shadow-md ml-[6%] saturate-[0.65] brightness-105 transition-transform duration-300 group-hover:rotate-12"
          />
        </div>

        {/* Folder Interior Content */}
        <div className="relative z-20 flex flex-col items-center justify-center text-center w-full px-4 sm:px-10 pt-[3%]">

          {/* Starboard Logo (Enlarged) */}
          <Image
            src="/sb_logo.png"
            alt="Starboard"
            width={1640}
            height={500}
            priority
            sizes="(max-width: 768px) 94vw, 1050px"
            className="w-[94%] max-w-[1050px] h-auto drop-shadow-xs mb-[2%] hover:scale-[1.04] hover:rotate-1 transition-all duration-300 z-30"
          />

          {/* Catchphrase */}
          <p className="text-ink font-body italic text-[11px] xs:text-xs sm:text-lg md:text-2xl tracking-wide mb-[3%] font-medium leading-none">
            Let's untangle those to-dos.
          </p>

          {/* Start Listing CTA — real text, not a baked-in image, so it scales,
              translates, and stays crisp. Colors and font are pulled straight
              from the rest of the app (stripe blue + folder pink border is the
              same pairing used on the dashboard header; Chewy is the wordmark
              font) instead of inventing a one-off purple/yellow combo. */}
          <button
            onClick={onStartListing}
            className="relative z-30 flex items-center justify-center rounded-full border-2 border-folder-pinkDeep bg-stripe-blue px-5 py-2 xs:px-6 xs:py-2.5 sm:px-8 sm:py-3 shadow-sm transition-transform duration-150 hover:scale-105 hover:bg-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folder-pinkDeep/50 focus-visible:ring-offset-2"
          >
            <span className="font-logo text-ink text-sm xs:text-base sm:text-lg md:text-xl leading-none">
              Start Listing
            </span>
          </button>

          {/* Secondary, lower-key entry point for someone who just wants to
              poke around (e.g. a hiring manager) without creating a real
              account - signs into a shared, pre-made demo user. */}
          <button
            onClick={onTryDemo}
            disabled={isDemoLoading}
            className="relative z-30 mt-2 text-ink/60 hover:text-ink text-[11px] xs:text-xs sm:text-sm font-medium underline decoration-dotted underline-offset-2 transition-colors disabled:opacity-50"
          >
            {isDemoLoading ? "Loading demo…" : "Try Demo (no signup needed)"}
          </button>

          {demoError && (
            <p className="relative z-30 mt-1 text-[10px] xs:text-xs text-danger font-medium">{demoError}</p>
          )}

        </div>
      </div>

    </main>
  );
}