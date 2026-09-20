import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";

const INTERACTIVE_SELECTOR = [
  "main a[class*=\"rounded-\"]",
  "main button[class*=\"rounded-\"]",
  "header a[class*=\"rounded-\"]",
  "header button[class*=\"rounded-\"]",
].join(",");

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

function delayFor(element: HTMLElement): number {
  const parent = element.parentElement;
  if (!parent) return 0;
  const siblings = Array.from(parent.children).filter((child) => child instanceof HTMLElement);
  const index = Math.max(0, siblings.indexOf(element));
  return Math.min(index, 5) * 55;
}

function animateElement(element: HTMLElement, delay = 0) {
  if (element.dataset.btScrollAnimated === "true") return;
  element.dataset.btScrollAnimated = "true";

  element.animate(
    [
      { opacity: 0, transform: "translate3d(0, 24px, 0)" },
      { opacity: 1, transform: "translate3d(0, 0, 0)" },
    ],
    {
      duration: 620,
      delay,
      easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      fill: "both",
    },
  );
}

export function SiteMotion() {
  const location = useLocation();

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const header = document.querySelector<HTMLElement>(".bt-site-header");
    const root = document.getElementById("main-content");

    const updateHeader = () => {
      if (!header) return;
      if (window.scrollY > 12) header.setAttribute("data-scrolled", "true");
      else header.removeAttribute("data-scrolled");
    };

    const bindInteractive = () => {
      for (const element of document.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)) {
        if (element.dataset.btInteractiveBound === "true") continue;
        element.dataset.btInteractiveBound = "true";
        element.classList.add("bt-interactive");
      }
    };

    const observer = reducedMotion
      ? null
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              const element = entry.target as HTMLElement;
              observer?.unobserve(element);
              animateElement(element, delayFor(element));
            }
          },
          {
            threshold: 0.08,
            rootMargin: "0px 0px -7% 0px",
          },
        );

    const bindReveal = () => {
      if (!root) return;

      for (const element of root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)) {
        if (element.dataset.btScrollMotionBound === "true") continue;
        element.dataset.btScrollMotionBound = "true";

        if (reducedMotion) {
          element.dataset.btScrollAnimated = "true";
          continue;
        }

        const rect = element.getBoundingClientRect();
        const isInitiallyVisible = rect.bottom > 0 && rect.top < window.innerHeight * 0.96;

        if (isInitiallyVisible) {
          animateElement(element, delayFor(element));
        } else {
          observer?.observe(element);
        }
      }
    };

    updateHeader();
    bindInteractive();

    const firstFrame = window.requestAnimationFrame(() => {
      bindReveal();
    });

    window.addEventListener("scroll", updateHeader, { passive: true });

    const mutationObserver = new MutationObserver((records) => {
      if (!records.some((record) => record.addedNodes.length > 0)) return;
      bindInteractive();
      bindReveal();
    });

    if (root) mutationObserver.observe(root, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      observer?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", updateHeader);
    };
  }, [location.pathname]);

  return null;
}
