import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

const INTERACTIVE_SELECTOR = [
  "main a[class*=\"rounded-\"]",
  "main button[class*=\"rounded-\"]",
  "header a[class*=\"rounded-\"]",
  "header button[class*=\"rounded-\"]",
].join(",");

const SCROLL_REVEAL_SELECTOR = [
  "[data-motion-reveal]",
  "[data-motion-section] > :not(.grid)",
  "[data-motion-section] > .grid > *",
  "[data-motion-section] > div.grid > *",
  "main article",
  "main [class*=\"shadow-card\"]",
].join(",");

function staggerDelay(element: HTMLElement): number {
  const parent = element.parentElement;
  if (!parent) return 0;
  const siblings = Array.from(parent.children).filter((child) => child instanceof HTMLElement);
  const index = Math.max(0, siblings.indexOf(element));
  return Math.min(index, 5) * 55;
}

function shouldHandleAnchor(anchor: HTMLAnchorElement, event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download") || anchor.dataset.noRouteTransition === "true") return false;

  const rawHref = anchor.getAttribute("href");
  if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) return false;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;

  const current = new URL(window.location.href);
  if (
    url.pathname === current.pathname &&
    url.search === current.search &&
    url.hash === current.hash
  ) {
    return false;
  }

  if (
    url.pathname === current.pathname &&
    url.search === current.search &&
    url.hash
  ) {
    return false;
  }

  return true;
}

export function SiteMotion() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const header = document.querySelector<HTMLElement>(".bt-site-header");
    const root = document.getElementById("main-content");
    const page = root?.querySelector<HTMLElement>(".bt-route-page");
    let navigationTimer: number | undefined;

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

              if (element.dataset.btScrollAnimated === "true") continue;
              element.dataset.btScrollAnimated = "true";

              element.animate(
                [
                  { opacity: 0, transform: "translate3d(0, 24px, 0)" },
                  { opacity: 1, transform: "translate3d(0, 0, 0)" },
                ],
                {
                  duration: 620,
                  delay: staggerDelay(element),
                  easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  fill: "both",
                },
              );
            }
          },
          {
            threshold: 0.08,
            rootMargin: "0px 0px -8% 0px",
          },
        );

    const bindScrollReveal = () => {
      if (!root || !observer) return;
      const viewportCutoff = window.innerHeight * 0.9;

      for (const element of root.querySelectorAll<HTMLElement>(SCROLL_REVEAL_SELECTOR)) {
        if (element.dataset.btScrollMotionBound === "true") continue;
        element.dataset.btScrollMotionBound = "true";

        const rect = element.getBoundingClientRect();
        if (rect.top < viewportCutoff) {
          element.dataset.btScrollAnimated = "true";
          continue;
        }

        observer.observe(element);
      }
    };

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || !shouldHandleAnchor(anchor, event)) return;

      event.preventDefault();

      const destination = new URL(anchor.href, window.location.href);
      const href = `${destination.pathname}${destination.search}${destination.hash}`;

      if (reducedMotion || !page) {
        void navigate({ href });
        return;
      }

      if (page.dataset.btRouteLeaving === "true") return;
      page.dataset.btRouteLeaving = "true";
      page.classList.add("bt-route-exit");
      document.documentElement.classList.add("bt-route-transitioning");

      navigationTimer = window.setTimeout(() => {
        void navigate({ href });
      }, 240);
    };

    updateHeader();
    bindInteractive();
    bindScrollReveal();

    window.addEventListener("scroll", updateHeader, { passive: true });
    document.addEventListener("click", onDocumentClick, true);

    const mutationObserver = new MutationObserver((records) => {
      if (!records.some((record) => record.addedNodes.length > 0)) return;
      bindInteractive();
      bindScrollReveal();
    });

    if (root) mutationObserver.observe(root, { childList: true, subtree: true });

    const transitionCleanup = window.setTimeout(() => {
      document.documentElement.classList.remove("bt-route-transitioning");
    }, 520);

    return () => {
      if (navigationTimer) window.clearTimeout(navigationTimer);
      window.clearTimeout(transitionCleanup);
      observer?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", updateHeader);
      document.removeEventListener("click", onDocumentClick, true);
      document.documentElement.classList.remove("bt-route-transitioning");
    };
  }, [location.pathname, navigate]);

  return null;
}
