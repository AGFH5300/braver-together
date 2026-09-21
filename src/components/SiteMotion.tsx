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

function playReveal(element: HTMLElement) {
  if (element.dataset.btMotionPlayed === "true") return;
  element.dataset.btMotionPlayed = "true";
  element.style.setProperty("--bt-reveal-delay", `${delayFor(element)}ms`);
  element.classList.remove("bt-reveal-run");

  void element.offsetWidth;
  element.classList.add("bt-reveal-run");

  const finish = () => {
    element.classList.remove("bt-reveal-run");
    element.style.removeProperty("--bt-reveal-delay");
  };

  element.addEventListener("animationend", finish, { once: true });
  element.addEventListener("animationcancel", finish, { once: true });
}

function isInternalNavigation(anchor: HTMLAnchorElement, event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const rawHref = anchor.getAttribute("href");
  if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
    return false;
  }

  const destination = new URL(anchor.href, window.location.href);
  const current = new URL(window.location.href);

  if (destination.origin !== current.origin) return false;
  if (
    destination.pathname === current.pathname &&
    destination.search === current.search
  ) {
    return false;
  }

  return true;
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
    const isNavigation =
      previousPathname !== null && previousPathname !== location.pathname;
    previousPathname = location.pathname;

    // A new route should never inherit motion bookkeeping from an HMR update
    // or a preserved DOM node.
    for (const element of collectRevealNodes(root)) {
      delete element.dataset.btMotionBound;
      delete element.dataset.btMotionPlayed;
      element.classList.remove(
        "bt-reveal",
        "bt-reveal-visible",
        "bt-reveal-run",
      );
      element.style.removeProperty("--bt-reveal-delay");
    }

    root.classList.remove("bt-route-pending");
    document.documentElement.classList.remove("bt-route-pending");

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

    const bindBelowFold = () => {
      for (const element of collectRevealNodes(root)) {
        if (element.dataset.btMotionBound === "true") continue;
        element.dataset.btMotionBound = "true";

        if (reducedMotion) {
          element.dataset.btMotionPlayed = "true";
          continue;
        }

        const rect = element.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < window.innerHeight) continue;
        observer?.observe(element);
      }
    };

    const playVisible = () => {
      if (reducedMotion) return;
      for (const element of collectRevealNodes(root)) {
        const rect = element.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
        playReveal(element);
      }
    };

    const bindInteractiveAll = () => {
      for (const element of document.querySelectorAll<HTMLElement>(
        INTERACTIVE_SELECTOR,
      )) {
        bindInteractive(element);
      }
    };

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || !isInternalNavigation(anchor, event)) return;

      // Do not intercept navigation. This only gives instant visual feedback
      // while the router resolves/preloads the next route.
      root.classList.add("bt-route-pending");
      document.documentElement.classList.add("bt-route-pending");
    };

    updateHeader();
    bindInteractiveAll();
    bindBelowFold();

    // View-transition snapshots sit above the live DOM while a route changes.
    // Start the visible-page reveals just before that snapshot finishes, so
    // the user actually sees the entrance motion instead of it completing
    // invisibly underneath the snapshot.
    const supportsViewTransitions =
      typeof document !== "undefined" && "startViewTransition" in document;
    const revealDelay =
      isNavigation && supportsViewTransitions ? 285 : 24;
    const revealTimer = window.setTimeout(playVisible, revealDelay);

    window.addEventListener("scroll", updateHeader, { passive: true });
    document.addEventListener("click", onDocumentClick, true);

    const mutationObserver = new MutationObserver((records) => {
      if (!records.some((record) => record.addedNodes.length > 0)) return;
      bindInteractiveAll();
      bindBelowFold();
    });

    mutationObserver.observe(root, { childList: true, subtree: true });

    // If a navigation fails or stalls, never leave the old page looking
    // permanently faded.
    const pendingSafetyTimer = window.setTimeout(() => {
      root.classList.remove("bt-route-pending");
      document.documentElement.classList.remove("bt-route-pending");
    }, 1_500);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(pendingSafetyTimer);
      observer?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", updateHeader);
      document.removeEventListener("click", onDocumentClick, true);

      root.classList.remove("bt-route-pending");
      document.documentElement.classList.remove("bt-route-pending");

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
