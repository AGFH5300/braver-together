import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";

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

function playReveal(element: HTMLElement) {
  if (element.dataset.btMotionPlayed === "true") return;
  element.dataset.btMotionPlayed = "true";
  element.style.setProperty("--bt-reveal-delay", `${delayFor(element)}ms`);
  element.classList.remove("bt-reveal-run");

  // Force a fresh animation timeline even after Vite HMR.
  void element.offsetWidth;
  element.classList.add("bt-reveal-run");

  const finish = () => {
    element.classList.remove("bt-reveal-run");
    element.style.removeProperty("--bt-reveal-delay");
  };

  element.addEventListener("animationend", finish, { once: true });
  element.addEventListener("animationcancel", finish, { once: true });
}

export function SiteMotion() {
  const location = useLocation();

  useEffect(() => {
    const root = document.getElementById("main-content");
    if (!root) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const header = document.querySelector<HTMLElement>(".bt-site-header");

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
            rootMargin: "0px 0px -7% 0px",
          },
        );

    const bindReveal = (element: HTMLElement) => {
      if (element.dataset.btMotionBound === "true") return;
      element.dataset.btMotionBound = "true";

      // Clean up any stale classes left behind by older dev builds/HMR.
      element.classList.remove(
        "bt-reveal",
        "bt-reveal-visible",
        "bt-reveal-run",
      );
      element.style.removeProperty("--bt-reveal-delay");

      if (reducedMotion) {
        element.dataset.btMotionPlayed = "true";
        return;
      }

      const rect = element.getBoundingClientRect();
      const initiallyVisible =
        rect.bottom > 0 && rect.top < window.innerHeight * 0.96;

      if (initiallyVisible) playReveal(element);
      else observer?.observe(element);
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
    window.addEventListener("scroll", updateHeader, { passive: true });

    const frame = window.requestAnimationFrame(bindAll);

    const mutationObserver = new MutationObserver((records) => {
      if (!records.some((record) => record.addedNodes.length > 0)) return;
      bindAll();
    });

    mutationObserver.observe(root, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", updateHeader);

      // Route teardown must always leave the DOM fully visible.
      for (const element of collectRevealNodes(root)) {
        element.classList.remove(
          "bt-reveal",
          "bt-reveal-visible",
          "bt-reveal-run",
        );
        element.style.removeProperty("--bt-reveal-delay");
      }
    };
  }, [location.pathname]);

  return null;
}
