import { Sun, Moon } from "@phosphor-icons/react";
import type { Theme } from "../theme";

export default function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      aria-label={theme === "dark" ? "Превключи на светла тема" : "Превключи на тъмна тема"}
    >
      {theme === "dark" ? <Sun size={17} weight="fill" /> : <Moon size={17} weight="fill" />}
    </button>
  );
}
