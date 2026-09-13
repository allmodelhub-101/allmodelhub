"use client";

import { useEffect } from "react";

export function CinematicStoryController({ sceneCount }: { sceneCount: number }) {
  useEffect(() => {
    const story = document.getElementById("cinematic-story");
    if (!story) return;

    const site = story.closest<HTMLElement>(".cin-site");
    const cinematicSections = site
      ? Array.from(site.querySelectorAll<HTMLElement>(
          ".cin-hero, .cin-model-rail, .cin-create, .cin-wallet-section, .cin-pakistan, .cin-faq, .cin-final-cta, .cin-footer",
        ))
      : [];

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) {
      story.dataset.reducedMotion = "true";
      cinematicSections.forEach((section) => section.classList.add("is-revealed"));
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = story.getBoundingClientRect();
      const distance = Math.max(story.offsetHeight - window.innerHeight, 1);
      const progress = Math.min(1, Math.max(0, -rect.top / distance));
      const scene = Math.min(sceneCount - 1, Math.floor(progress * sceneCount));
      story.style.setProperty("--story-progress", progress.toFixed(4));
      story.dataset.scene = String(scene);

      if (site) {
        const pageDistance = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
        site.style.setProperty("--cin-page-progress", (window.scrollY / pageDistance).toFixed(4));
        site.style.setProperty("--cin-scroll-y", `${Math.round(window.scrollY)}px`);
      }
    };

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    site?.setAttribute("data-cinematic-ready", "true");

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12%", threshold: 0.08 },
    );
    cinematicSections.forEach((section) => revealObserver.observe(section));

    const updatePointer = (event: PointerEvent) => {
      if (!site || event.pointerType === "touch") return;
      site.style.setProperty("--cin-pointer-x", `${(event.clientX / window.innerWidth) * 100}%`);
      site.style.setProperty("--cin-pointer-y", `${(event.clientY / window.innerHeight) * 100}%`);
    };

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    window.addEventListener("pointermove", updatePointer, { passive: true });
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      window.removeEventListener("pointermove", updatePointer);
      revealObserver.disconnect();
      site?.removeAttribute("data-cinematic-ready");
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sceneCount]);

  return null;
}

