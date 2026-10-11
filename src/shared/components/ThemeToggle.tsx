"use client";

import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: flag client mount before rendering theme-dependent UI.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-14 h-7" />;

  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center w-14 h-7 p-1 bg-card border border-border rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
      aria-label="Toggle Theme"
    >
      <div
        className={`absolute w-5 h-5 bg-primary rounded-full shadow-md transition-transform duration-300 transform ${
          theme === "dark" ? "translate-x-7" : "translate-x-0"
        }`}
      />
      <div className="flex justify-between w-full px-1 z-10 pointer-events-none">
        <Sun className={`w-3.5 h-3.5 ${theme === "light" ? "text-background" : "text-foreground/50"}`} />
        <Moon className={`w-3.5 h-3.5 ${theme === "dark" ? "text-background" : "text-foreground/50"}`} />
      </div>
    </button>
  );
}
