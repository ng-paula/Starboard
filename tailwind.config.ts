import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Starboard "Digital Scrapbook / Y2K Stationery" palette
        stripe: {
          blue: "#BFE3F2", // pastel stripe blue
          white: "#FFFDF8", // warm paper white
        },
        folder: {
          pink: "#F6C9D9", // primary folder pink
          pinkDark: "#E9A9C2", // folder shadow / crease
        },
        star: "#FDE896", // soft yellow star
        button: {
          green: "#7BA98A", // sewing button green
          greenDark: "#5C8A6C",
        },
        washi: "#F2A6B0", // dotted washi tape
        ink: "#5B4B45", // warm brown ink for text
        dash: {
          bg: "#FDF7EE", // calmer dashboard backdrop
          card: "#FFFFFF",
          accent: "#F6C9D9",
          accent2: "#BFE3F2",
        },
      },
      fontFamily: {
        logo: ["var(--font-logo)"],
        body: ["var(--font-body)"],
      },
      boxShadow: {
        folder: "0 20px 45px -15px rgba(91, 75, 69, 0.35)",
        card: "0 8px 20px -8px rgba(91, 75, 69, 0.18)",
        pop: "0 2px 0 rgba(91, 75, 69, 0.25)",
      },
      backgroundImage: {
        stripes:
          "repeating-linear-gradient(90deg, #BFE3F2 0px, #BFE3F2 40px, #FFFDF8 40px, #FFFDF8 80px)",
      },
      keyframes: {
        twinkle: {
          "0%, 100%": { opacity: "0.4", transform: "scale(0.85)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px) rotate(var(--tilt, 0deg))" },
          "50%": { transform: "translateY(-6px) rotate(var(--tilt, 0deg))" },
        },
      },
      animation: {
        twinkle: "twinkle 2.4s ease-in-out infinite",
        float: "float 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
