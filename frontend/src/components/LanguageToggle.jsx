import React from "react";
import { useLanguage } from "../lib/LanguageContext";
import "./LanguageToggle.css";

/**
 * Circular flag toggle: shows both EN (🇬🇧) and SV (🇸🇪) flags.
 * Active flag is highlighted, clicking the inactive one switches language.
 */
export default function LanguageToggle() {
  const { lang, toggle } = useLanguage();

  return (
    <div className="lang-toggle" title={lang === "en" ? "Switch to Swedish" : "Byt till Engelska"}>
      <button
        className={`lang-flag ${lang === "en" ? "lang-flag--active" : ""}`}
        onClick={lang !== "en" ? toggle : undefined}
        aria-label="English"
        type="button"
      >
        {/* UK/English flag as inline SVG circle */}
        <svg viewBox="0 0 36 36" width="28" height="28">
          <circle cx="18" cy="18" r="17" fill="#012169" />
          {/* Diagonal cross */}
          <path d="M3 3 L33 33 M33 3 L3 33" stroke="#fff" strokeWidth="3" />
          <path d="M3 3 L33 33 M33 3 L3 33" stroke="#C8102E" strokeWidth="1.5" />
          {/* Vertical/Horizontal cross */}
          <path d="M18 1 V35 M1 18 H35" stroke="#fff" strokeWidth="5" />
          <path d="M18 1 V35 M1 18 H35" stroke="#C8102E" strokeWidth="3" />
          {/* Circle clip mask */}
          <circle cx="18" cy="18" r="17" fill="none" stroke="#1a1a2e" strokeWidth="2" />
        </svg>
      </button>

      <button
        className={`lang-flag ${lang === "sv" ? "lang-flag--active" : ""}`}
        onClick={lang !== "sv" ? toggle : undefined}
        aria-label="Svenska"
        type="button"
      >
        {/* Swedish flag as inline SVG circle */}
        <svg viewBox="0 0 36 36" width="28" height="28">
          <circle cx="18" cy="18" r="17" fill="#006AA7" />
          {/* Yellow cross */}
          <rect x="0" y="14" width="36" height="8" fill="#FECC02" />
          <rect x="11" y="0" width="8" height="36" fill="#FECC02" />
          {/* Circle clip mask */}
          <circle cx="18" cy="18" r="17" fill="none" stroke="#1a1a2e" strokeWidth="2" />
        </svg>
      </button>
    </div>
  );
}
