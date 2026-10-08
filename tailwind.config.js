/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        candy: {
          bg: "#0b0c10",
          card: "#13141c",
          elevated: "#181a24",
          surface: "#1f2230",
          border: "rgba(255, 255, 255, 0.08)",
          pink: "#ec4899",
          rose: "#f43f5e",
          purple: "#a855f7",
          gradientStart: "#f43f5e",
          gradientEnd: "#8b5cf6",
        },
      },
      backgroundImage: {
        "candy-gradient": "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
        "candy-gradient-hover": "linear-gradient(135deg, #f43f5e 0%, #a855f7 100%)",
        "candy-badge": "linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)",
      },
    },
  },
  plugins: [],
};
