/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        neon: {
          cyan: "#00d4ff",
          purple: "#a855f7",
          pink: "#ff3366",
          green: "#00ff88",
          yellow: "#ffaa00",
        },
        dark: {
          950: "#050810",
          900: "#0a0e1a",
          800: "#0d1225",
          700: "#111827",
          600: "#1a2035",
          500: "#243050",
        },
      },
      boxShadow: {
        neon: "0 0 20px rgba(0, 212, 255, 0.2), 0 0 60px rgba(0, 212, 255, 0.05)",
        "neon-purple":
          "0 0 20px rgba(168, 85, 247, 0.2), 0 0 60px rgba(168, 85, 247, 0.05)",
        "neon-green":
          "0 0 20px rgba(0, 255, 136, 0.2), 0 0 60px rgba(0, 255, 136, 0.05)",
        "neon-pink":
          "0 0 20px rgba(255, 51, 102, 0.2), 0 0 60px rgba(255, 51, 102, 0.05)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.3)",
      },
      fontFamily: {
        display: ['"Orbitron"', "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      animation: {
        "fade-in-up": "fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in-down": "fadeInDown 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "scale-in": "scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          from: { opacity: "0", transform: "translateY(-16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0, 212, 255, 0.2)" },
          "50%": {
            boxShadow:
              "0 0 40px rgba(0, 212, 255, 0.4), 0 0 80px rgba(0, 212, 255, 0.1)",
          },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.92)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
