import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#121417",
        panel: "#f7f5ef",
        signal: "#0f766e",
        flare: "#d97706",
      },
      fontFamily: {
        sans: ["Arial", "Helvetica", "sans-serif"],
      },
      boxShadow: {
        soft: "0 18px 60px rgba(18, 20, 23, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
