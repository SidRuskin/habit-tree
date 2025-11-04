import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        'dark': {
          primary: '#1a2332',
          secondary: '#2a3544',
          tertiary: '#3a4555',
        },
        'gold': '#f0b90b',
      },
    },
  },
  plugins: [],
};
export default config;

