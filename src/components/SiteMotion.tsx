import { useLocation } from "@tanstack/react-router";
import { useEffect, useLayoutEffect } from "react";

const REVEAL_SELECTOR = [
  "main h1",
  "[data-motion-reveal]",
  "[data-motion-section] > :not(.grid)",
  "[data-motion-section] > .grid > *",
  "[data-motion-section] > div.grid > *",
  "main article",
  "main [class*=\"shadow-card\"]",
  "main a[class*=\"rounded-2xl\"]",
].join(",");

const INTERACTIVE_SELECTOR = [
  "main a[class*=\"rounded-\"]",
  "main button[class*=\"rounded-\"]",
  "header a[class*=\"rounded-\"]",
  "header button[class*=\"rounded-\"]",
].join(",");

const useBrowserLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

let previousPathname: string | null = null;

function collectRevealNodes(root: HTMLElement): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
  const unique = Array.from(new Set(all)).filter(
    (element) => !element.closest("[data-motion-skip]"),
  );
  const selected = new Set(unique);

  return unique.filter((element) => {
    let parent = element.parentElement;
    while (parent && parent !== root) {
      if (selected.has(parent) && !parent.classList.contains("grid")) return false;
      parent = parent.parentElement;
    }
    return true;
  });
}

function delayFor(element: HTMLElement): number {
  const parent = element.parentElement;
  if (!parent) return 0;

  const siblings = Array.from(parent.children).filter(
    (child) => child instanceof HTMLElement,
  );
  const index = Math.max(0, siblings.indexOf(element));
  return Math.min(index, 5) * 55;
}

function prepReveal(element: HTMLElement) {
  element.classList.add("bt-reveal-prep");
}

function playReveal(element: HTMLElement) {
  if (element.dataset.btMotionPlayed === "true") return;

  element.dataset.btMotionPlayed = "true";
  element.style.setProperty("--bt-reveal-delay", `${delayFor(element)}ms`);
  element.classList.add("bt-reveal-prep");
  element.classList.remove("bt-reveal-run");

  void element.offsetWidth;
  element.classList.add("bt-reveal-run");

  const finish = () => {
    element.classList.remove("bt-reveal-prep", "bt-reveal-run");
    element.style.removeProperty("--bt-reveal-delay");
  };

  element.addEventListener("animationend", finish, { once: true });
  element.addEventListener("animationcancel", finish, { once: true });
}

export function SiteMotion() {
  const location = useLocation();

  useBrowserLayoutEffect(() => {
    const root = document.getElementById("main-content");
    if (!root) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const header = document.querySelector<HTMLElement>(".bt-site-header");
    const isRouteNavigation =
      previousPathname !== null && previousPathname !== location.pathname;

    previousPathname = location.pathname;

    const ownedNodes = new Set<HTMLElement>();

    const updateHeader = () => {
      if (!header) return;
      if (window.scrollY > 12) header.setAttribute("data-scrolled", "true");
      else header.removeAttribute("data-scrolled");
    };

    const bindInteractive = (element: HTMLElement) => {
      if (element.dataset.btInteractiveBound === "true") return;
      element.dataset.btInteractiveBound = "true";
      element.classList.add("bt-interactive");
    };

    const observer = reducedMotion
      ? null
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              const element = entry.target as HTMLElement;
              observer?.unobserve(element);
              playReveal(element);
            }
          },
          {
            threshold: 0.08,
            rootMargin: "0px 0px -14% 0px",
          },
        );

    const bindReveal = (element: HTMLElement) => {
      if (element.dataset.btMotionBound === "true") return;

      element.dataset.btMotionBound = "true";
      ownedNodes.add(element);

      element.classList.remove(
        "bt-reveal",
        "bt-reveal-visible",
        "bt-reveal-prep",
        "bt-reveal-run",
      );
      element.style.removeProperty("--bt-reveal-delay");

      if (reducedMotion) {
        element.dataset.btMotionPlayed = "true";
        return;
      }

      const rect = element.getBoundingClientRect();
      const initiallyVisible =
        rect.bottom > 0 && rect.top < window.innerHeight;

      if (initiallyVisible) {
        if (isRouteNavigation) {
          // The route transition already animates the visible page entrance.
          // Mark it complete so it never "replays" when the user scrolls.
          element.dataset.btMotionPlayed = "true";
        } else {
          // Cold load: prep + animate before the first paint.
          prepReveal(element);
          playReveal(element);
        }
      } else {
        // Critical: off-screen content is placed in its start state NOW,
        // before the user can scroll to it. It can never appear static first.
        prepReveal(element);
        observer?.observe(element);
      }
    };

    const bindAll = () => {
      for (const element of collectRevealNodes(root)) bindReveal(element);
      for (const element of document.querySelectorAll<HTMLElement>(
        INTERACTIVE_SELECTOR,
      )) {
        bindInteractive(element);
      }
    };

    updateHeader();
    bindAll();

    window.addEventListener("scroll", updateHeader, { passive: true });

    const mutationObserver = new MutationObserver((records) => {
      if (!records.some((record) => record.addedNodes.length > 0)) return;
      bindAll();
    });

    mutationObserver.observe(root, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", updateHeader);

      for (const element of ownedNodes) {
        observer?.unobserve(element);
        element.classList.remove(
          "bt-reveal",
          "bt-reveal-visible",
          "bt-reveal-prep",
          "bt-reveal-run",
        );
        element.style.removeProperty("--bt-reveal-delay");
        delete element.dataset.btMotionBound;
        delete element.dataset.btMotionPlayed;
      }
    };
  }, [location.pathname]);

  return null;
}
