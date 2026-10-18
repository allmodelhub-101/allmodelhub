"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

const stack: symbol[] = [];
const focusables = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
let savedOverflow = "";
let scrollOwners: Array<{element: HTMLElement; overflow: string}> = [];

// One owner for modal focus/scroll, including nested dialogs. Nonmodal popovers
// participate in Escape ownership without locking the document or trapping Tab.
export function useWorkspaceOverlay(open: boolean, ref: RefObject<HTMLElement | null>, dismiss: () => void, modal = true) {
  const onDismiss = useEffectEvent(dismiss);
  useEffect(() => {
    if (!open || !ref.current) return;
    const root = ref.current;
    const token = Symbol("workspace-overlay");
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    stack.push(token);
    const isTop = () => stack.at(-1) === token;
    const candidates = () => Array.from(root.querySelectorAll<HTMLElement>(focusables)).filter(el => el.tabIndex >= 0 && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
    if (modal) {
      if (!document.body.hasAttribute("data-workspace-modal-count")) {
        savedOverflow = document.body.style.overflow;
        scrollOwners = Array.from(document.querySelectorAll<HTMLElement>(".responsive-workspace .app-content,.responsive-workspace .sidebar-scroll,.chat-workspace .chat-layout-body")).map(element => ({element, overflow:element.style.overflow}));
        for (const {element} of scrollOwners) element.style.overflow = "hidden";
      }
      document.body.dataset.workspaceModalCount = String(Number(document.body.dataset.workspaceModalCount || 0) + 1);
      document.body.style.overflow = "hidden";
    }
    const timer = window.setTimeout(() => {
      const target = root.querySelector<HTMLElement>('input[autofocus],input:not([type="hidden"]),[data-initial-focus]') || candidates()[0] || root;
      target.focus({preventScroll:true});
    }, 0);
    const keys = (event: KeyboardEvent) => {
      if (!isTop() || event.defaultPrevented) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onDismiss(); }
      if (modal && event.key === "Tab") {
        const items = candidates();
        const first = items[0], last = items.at(-1);
        if (!first) { event.preventDefault(); root.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    const focus = (event: FocusEvent) => {
      if (modal && isTop() && !root.contains(event.target as Node)) (candidates()[0] || root).focus();
    };
    document.addEventListener("keydown", keys);
    document.addEventListener("focusin", focus);
    return () => {
      window.clearTimeout(timer);
      const wasTop = isTop();
      stack.splice(stack.indexOf(token), 1);
      document.removeEventListener("keydown", keys);
      document.removeEventListener("focusin", focus);
      if (modal) {
        const count = Number(document.body.dataset.workspaceModalCount || 1) - 1;
        if (count) document.body.dataset.workspaceModalCount = String(count);
        else { delete document.body.dataset.workspaceModalCount; document.body.style.overflow = savedOverflow; for (const {element, overflow} of scrollOwners) element.style.overflow = overflow; scrollOwners = []; }
      }
      if (wasTop && previous?.isConnected) previous.focus({preventScroll:true});
    };
  }, [open, ref, modal]);
}
