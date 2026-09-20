import { useEffect } from "react";

const INTERACTIVE_SELECTOR = [
  "main a[class*=\"rounded-\"]",
  "main button[class*=\"rounded-\"]",
  "header a[class*=\"rounded-\"]",
  "header button[class*=\"rounded-\"]",
].join(",");

function clearLegacyRevealState() {
  for (const element of document.querySelectorAll<HTMLElement>(".bt-reveal, .bt-reveal-visible")) {
    element.classList.remove("bt-reveal", "bt-reveal-visible");
    element.style.removeProperty("--bt-reveal-delay");
    delete element.dataset.btMotionBound;
  }

  document.getElementById("main-content")?.classList.remove("bt-page-enter");
}

export function SiteMotion() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".bt-site-header");

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

    clearLegacyRevealState();
    updateHeader();
    bindInteractive();

    window.addEventListener("scroll", updateHeader, { passive: true });

    const root = document.getElementById("main-content");
    const mutationObserver = new MutationObserver((records) => {
      if (!records.some((record) => record.addedNodes.length > 0)) return;
      clearLegacyRevealState();
      bindInteractive();
    });

    if (root) mutationObserver.observe(root, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      window.removeEventListener("scroll", updateHeader);
    };
  }, []);

  return null;
}
