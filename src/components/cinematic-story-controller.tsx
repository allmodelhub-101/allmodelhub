"use client";

import { useEffect } from "react";

export function CinematicStoryController({ sceneCount }: { sceneCount: number }) {
  useEffect(() => {
    const story = document.getElementById("cinematic-story");
    if (!story) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) {
      story.dataset.reducedMotion = "true";
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
    };

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sceneCount]);

  return null;
}
