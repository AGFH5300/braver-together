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
  const unique = Array.from(new Set(all)).filter((element) => !element.closest("[data-motion-skip]"));
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
  const siblings = Array.from(parent.children).filter((child) => child instanceof HTMLElement);
  const index = Math.max(0, siblings.indexOf(element));
  return Math.min(index, 5) * 55;
}

export function SiteMotion() {
  const location = useLocation();

  useEffect(() => {
    const root = document.getElementById("main-content");
    if (!root) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const header = document.querySelector<HTMLElement>(".bt-site-header");

    const updateHeader = () => {
      if (!header) return;
      if (window.scrollY > 12) header.setAttribute("data-scrolled", "true");
      else header.removeAttribute("data-scrolled");
    };

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });

    if (reducedMotion) {
      return () => window.removeEventListener("scroll", updateHeader);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.classList.add("bt-reveal-visible");
          observer.unobserve(element);
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
      element.classList.add("bt-reveal");
      element.style.setProperty("--bt-reveal-delay", `${delayFor(element)}ms`);
      observer.observe(element);
    };

    const bindInteractive = (element: HTMLElement) => {
      if (element.dataset.btInteractiveBound === "true") return;
      element.dataset.btInteractiveBound = "true";
      element.classList.add("bt-interactive");
    };

    const bindAll = () => {
      for (const element of collectRevealNodes(root)) bindReveal(element);
      for (const element of document.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)) {
        bindInteractive(element);
      }
    };

    bindAll();

    const mutationObserver = new MutationObserver((records) => {
      if (!records.some((record) => record.addedNodes.length > 0)) return;
      bindAll();
    });

    mutationObserver.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", updateHeader);
    };
  }, [location.pathname]);

  return null;
}
