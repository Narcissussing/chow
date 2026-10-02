import { useEffect } from "react";

// Page figée derrière un panneau ouvert. overflow:hidden seul ne suffit pas sur Safari iOS :
// les glissements hors de la zone défilante du panneau sont bloqués à la main.
export function useVerrouDefilement(actif, zone) {
  useEffect(() => {
    if (!actif) return;
    const html = document.documentElement;
    const avant = { html: html.style.overflow, body: document.body.style.overflow };
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    function bloquer(event) {
      if (zone?.current?.contains(event.target)) return;
      // Listes des sélecteurs : posées sur <body>, hors du panneau, mais elles doivent défiler.
      if (event.target.closest?.(".custom-select__list")) return;
      event.preventDefault();
    }
    document.addEventListener("touchmove", bloquer, { passive: false });
    return () => {
      html.style.overflow = avant.html;
      document.body.style.overflow = avant.body;
      document.removeEventListener("touchmove", bloquer);
    };
  }, [actif, zone]);
}
