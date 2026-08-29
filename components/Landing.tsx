"use client";

import React from "react";
import FloatingStars from "./FloatingStars";

interface LandingProps {
  onStartListing?: () => void;
}

export default function Landing({ onStartListing }: LandingProps) {
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
        <img
          src="/sb_folderFinal.png"
          alt="Folder"
          className="absolute inset-0 w-full h-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.08)] pointer-events-none"
        />

        {/* Top-Left Polka-Dot Binder Clip */}
        <img
          src="/sb_clip.png"
          alt="Binder Clip"
          className="absolute -top-[10%] left-[2%] w-[24%] max-w-[13rem] h-auto -rotate-12 drop-shadow-md z-20 cursor-pointer hover:scale-110 hover:-rotate-[25deg] transition-all duration-300 pointer-events-auto"
        />

        {/* Bottom-Right Tape & Green Button Container (Tucked further inward) */}
        <div className="absolute -bottom-[4%] right-[2%] w-[26%] max-w-48 z-30 group cursor-pointer transition-transform duration-300 hover:scale-110 hover:rotate-3 pointer-events-auto">
          
          {/* Washi Tape */}
          <div 
            className="absolute top-[18%] -left-[22%] w-[88%] h-[24%] rotate-[-8deg] opacity-90 drop-shadow-xs transition-transform duration-300 group-hover:-rotate-[12deg]"
            style={{
              backgroundColor: "#fae8e6",
              backgroundImage: "radial-gradient(#d3747e 1.5px, transparent 1.5px)",
              backgroundSize: "8px 8px"
            }}
          />
          
          {/* Green Sewing Button */}
          <img
            src="/sb_green-button.png"
            alt="Green Button"
            className="relative w-full h-auto drop-shadow-xl ml-[6%] transition-transform duration-300 group-hover:rotate-12"
          />
        </div>

        {/* Folder Interior Content */}
        <div className="relative z-20 flex flex-col items-center justify-center text-center w-full px-4 sm:px-10 pt-[3%]">
          
          {/* Starboard Logo (Enlarged) */}
          <img
            src="/sb_logo.png"
            alt="Starboard"
            className="w-[94%] max-w-[1050px] h-auto drop-shadow-xs mb-[2%] cursor-pointer hover:scale-[1.04] hover:rotate-1 transition-all duration-300 z-30"
          />

          {/* Catchphrase */}
          <p className="text-[#6b5862] font-serif text-[11px] xs:text-xs sm:text-lg md:text-2xl tracking-wide mb-[3%] font-medium leading-none">
            Let's untangle those to-dos.
          </p>

          {/* Start Listing CTA Button */}
          <button
            onClick={onStartListing}
            className="relative hover:scale-105 active:scale-95 transition-transform duration-150 cursor-pointer z-30 flex items-center justify-center"
          >
            <img
              src="/sb_start-btn.png"
              alt="Start Listing"
              className="w-28 xs:w-36 sm:w-52 md:w-68 h-auto drop-shadow-sm" 
            />
          </button>

        </div>
      </div>

    </main>
  );
}