"use client";

import * as React from "react";
import { Moon, Sun, Laptop, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch by rendering a placeholder until mounted
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border border-border/40 bg-background" aria-label="Toggle theme">
        <Sun className="h-[1.2rem] w-[1.2rem] scale-100 transition-all dark:scale-0" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="h-9 w-9 rounded-xl border border-border/40 bg-background cursor-pointer focus-visible:ring-1 focus-visible:ring-ring outline-hidden inline-flex items-center justify-center relative">
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-foreground" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 bg-popover border border-border text-popover-foreground rounded-xl">
        <DropdownMenuItem onClick={() => setTheme("light")} className="flex items-center justify-between cursor-pointer py-1.5 px-2">
          <span className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-foreground" />
            Light
          </span>
          {theme === "light" && <Check className="h-3.5 w-3.5 text-emerald-500" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className="flex items-center justify-between cursor-pointer py-1.5 px-2">
          <span className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-foreground" />
            Dark
          </span>
          {theme === "dark" && <Check className="h-3.5 w-3.5 text-emerald-500" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")} className="flex items-center justify-between cursor-pointer py-1.5 px-2">
          <span className="flex items-center gap-2">
            <Laptop className="h-4 w-4 text-foreground" />
            System
          </span>
          {theme === "system" && <Check className="h-3.5 w-3.5 text-emerald-500" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
