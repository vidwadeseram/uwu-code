"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const THEMES = [
  { id: "dark", name: "Dark", color: "#1e1e2e" },
  { id: "light", name: "Light", color: "#fafafa" },
  { id: "catppuccin-mocha", name: "Catppuccin Mocha", color: "#313244" },
  { id: "catppuccin-macchiato", name: "Catppuccin Macchiato", color: "#24273a" },
  { id: "catppuccin-frappe", name: "Catppuccin Frappe", color: "#232634" },
  { id: "catppuccin-latte", name: "Catppuccin Latte", color: "#eff1f5" },
  { id: "nord", name: "Nord", color: "#2e3440" },
  { id: "dracula", name: "Dracula", color: "#282a36" },
  { id: "github-dark", name: "GitHub Dark", color: "#0d1117" },
  { id: "github-light", name: "GitHub Light", color: "#ffffff" },
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative">
      <select
        value={theme || "dark"}
        onChange={(e) => setTheme(e.target.value)}
        aria-label="Select theme"
        className="appearance-none bg-slate-700 border border-slate-600 rounded px-3 py-1.5 pr-8 text-sm cursor-pointer hover:bg-slate-600 transition-colors"
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-2 rounded hover:bg-slate-700 transition-colors"
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

export { THEMES };