/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        spotify: {
          green: "#1ed760",
          black: "#191414",
          darkgray: "#121212",
          gray: "#b3b3b3",
          lightgray: "#1a1a1a",
          white: "#ffffff",
        },
      },
      fontFamily: {
        spotify: ["Circular", "Helvetica", "Arial", "sans-serif"],
      },
      boxShadow: {
        spotify: "0 2px 4px 0 rgba(0,0,0,0.2)",
        "spotify-lg": "0 8px 24px rgba(0,0,0,0.5)",
      },
    },
  },
  plugins: [],
};
