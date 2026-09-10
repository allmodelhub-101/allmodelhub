"use client";

import { useEffect } from "react";

export function HomeReveal() {
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      elements.forEach((element) => element.dataset.visible = "true");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.visible = "true";
          observer.unobserve(entry.target);
        }
      }),
      { rootMargin: "0px 0px -10%", threshold: 0.12 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  return null;
}

