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

function reveal(element: HTMLElement) {
  if (element.dataset.btMotionPlayed === "true") return;
  element.dataset.btMotionPlayed = "true";

  element.animate(
    [
      {
        opacity: 0,
        transform: "translate3d(0, 24px, 0) scale(0.992)",
        filter: "blur(3px)",
      },
      {
        opacity: 1,
        transform: "translate3d(0, 0, 0) scale(1)",
        filter: "blur(0)",
      },
    ],
    {
      duration: 720,
      delay: delayFor(element),
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "none",
    },
  );
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
              reveal(element);
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

      // Remove any legacy hiding classes left by HMR or an older build.
      element.classList.remove("bt-reveal", "bt-reveal-visible");
      element.style.removeProperty("--bt-reveal-delay");

      if (reducedMotion) {
        element.dataset.btMotionPlayed = "true";
        return;
      }

      const rect = element.getBoundingClientRect();
      const initiallyVisible = rect.bottom > 0 && rect.top < window.innerHeight * 0.96;

      if (initiallyVisible) reveal(element);
      else observer?.observe(element);
    };

    const bindAll = () => {
      for (const element of collectRevealNodes(root)) bindReveal(element);
      for (const element of document.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)) {
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

      // Never leave content in an animated/hidden state during route teardown.
      for (const element of collectRevealNodes(root)) {
        element.getAnimations().forEach((animation) => animation.cancel());
        element.classList.remove("bt-reveal", "bt-reveal-visible");
        element.style.removeProperty("--bt-reveal-delay");
      }
    };
  }, [location.pathname]);

  return null;
}
