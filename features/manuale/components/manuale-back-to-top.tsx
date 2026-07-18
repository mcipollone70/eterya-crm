"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/utils/cn";

export function ManualeBackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;

    const onScroll = () => {
      setVisible(main.scrollTop > 400);
    };

    main.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    const main = document.querySelector("main");
    main?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <Button
      type="button"
      variant="primary"
      size="icon"
      onClick={scrollToTop}
      aria-label="Torna all'inizio della pagina"
      className={cn(
        "fixed bottom-24 right-4 z-30 shadow-lg transition-all lg:bottom-8",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      )}
    >
      <ArrowUp className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
