import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Starboard workspace palette: warm neutral surfaces, near-black
        // ink for text and primary actions, and a few flat accent colours
        // (pink / amber / sky / mint) used as solid blocks, never as
        // gradients or glows.
        ink: "#18181B",
        canvas: "#F6F3EE", // page backdrop
        sidebar: "#FAF8F5",
        line: "#ECE8E2", // hairline borders
        muted: "#71717A",

        pink: { DEFAULT: "#F27BA6", soft: "#FDE7EF", deep: "#B83A6B" },
        amber: { DEFAULT: "#F7C35F", soft: "#FEF3DC", deep: "#94620B" },
        sky: { DEFAULT: "#8EC5E8", soft: "#E6F2FA", deep: "#2B6283" },
        mint: { DEFAULT: "#BFE5A8", soft: "#E8F6DF", deep: "#3E7A4F" },
        lilac: { DEFAULT: "#C9BBF2", soft: "#EFEAFC", deep: "#5B45B0" },

        // Legacy names still used in a few places, mapped onto the new
        // palette so everything stays consistent.
        folder: { pink: "#F27BA6", pinkDark: "#E9A9C2", pinkDeep: "#B83A6B" },
        stripe: { blue: "#8EC5E8", white: "#FFFFFF" },
        star: "#F7C35F",
        button: { green: "#BFE5A8", greenDark: "#3E7A4F", greenDeep: "#3E7A4F" },
        danger: "#D14343",
        dash: { bg: "#F6F3EE", card: "#FFFFFF" },
      },
      fontFamily: {
        logo: ["var(--font-body)"],
        body: ["var(--font-body)"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(24, 24, 27, 0.04), 0 4px 16px -8px rgba(24, 24, 27, 0.08)",
        lift: "0 2px 4px rgba(24, 24, 27, 0.04), 0 12px 28px -12px rgba(24, 24, 27, 0.18)",
        pop: "0 20px 50px -20px rgba(24, 24, 27, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
