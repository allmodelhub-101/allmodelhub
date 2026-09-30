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

    let scrollFrame = 0;
    let pointerFrame = 0;
    let storyDistance = 1;
    let lastProgress = "";
    let lastScene = -1;
    let pointerX = "";
    let pointerY = "";
    let lastPointerX = "";
    let lastPointerY = "";

    const measureStory = () => {
      storyDistance = Math.max(story.offsetHeight - window.innerHeight, 1);
    };

    const update = () => {
      scrollFrame = 0;
      const rect = story.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / storyDistance));
      const scene = Math.min(sceneCount - 1, Math.floor(progress * sceneCount));
      const progressValue = progress.toFixed(4);

      if (progressValue !== lastProgress) {
        story.style.setProperty("--story-progress", progressValue);
        lastProgress = progressValue;
      }

      if (scene !== lastScene) {
        story.dataset.scene = String(scene);
        lastScene = scene;
      }
    };

    const requestUpdate = () => {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(update);
    };

    measureStory();
    update();
    site?.setAttribute("data-cinematic-ready", "true");

    const storyResizeObserver = new ResizeObserver(() => {
      measureStory();
      requestUpdate();
    });
    storyResizeObserver.observe(story);

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
      pointerX = `${(event.clientX / window.innerWidth) * 100}%`;
      pointerY = `${(event.clientY / window.innerHeight) * 100}%`;

      if (!pointerFrame) {
        pointerFrame = window.requestAnimationFrame(() => {
          pointerFrame = 0;
          if (!site) return;

          if (pointerX !== lastPointerX) {
            site.style.setProperty("--cin-pointer-x", pointerX);
            lastPointerX = pointerX;
          }
          if (pointerY !== lastPointerY) {
            site.style.setProperty("--cin-pointer-y", pointerY);
            lastPointerY = pointerY;
          }
        });
      }
    };

    const handleResize = () => {
      measureStory();
      requestUpdate();
    };

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", handleResize);
    window.addEventListener("pointermove", updatePointer, { passive: true });
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", updatePointer);
      revealObserver.disconnect();
      storyResizeObserver.disconnect();
      site?.removeAttribute("data-cinematic-ready");
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
    };
  }, [sceneCount]);

  return null;
}

