/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080c14",
        surface: "#0f1623",
        "surface-raised": "#162032",
        border: "#1c283e",
        "border-subtle": "#151e2e",
        brand: {
          orange: "#f97316",
          "orange-hover": "#ea580c",
          green: "#22c55e",
        },
      },
    },
  },
  plugins: [],
};