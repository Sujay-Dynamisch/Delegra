"use client";
import { useEffect } from "react";

/** Marks whichever element is scrolling with data-scrolling, so CSS shows its scrollbar only then. */
export function ScrollReveal() {
  useEffect(() => {
    const timers = new WeakMap<Element, number>();
    const onScroll = (e: Event) => {
      const el = e.target === document ? document.documentElement : (e.target as Element);
      if (!(el instanceof Element)) return;
      el.setAttribute("data-scrolling", "");
      window.clearTimeout(timers.get(el));
      timers.set(el, window.setTimeout(() => el.removeAttribute("data-scrolling"), 900));
    };
    // Capture phase: scroll events don't bubble, but they do reach a capturing listener.
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, []);
  return null;
}
