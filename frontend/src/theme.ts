import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "dokoga-theme";

function initial(): Theme {
  const saved = localStorage.getItem(KEY);
  return saved === "light" || saved === "dark" ? saved : "dark";
}

/** Sets data-theme on <html>, persists to localStorage. Defaults to dark (control-room). */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(KEY, theme);
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}
