import { useEffect } from "react";

// Défilement automatique des textes trop longs, réglé sur une seule horloge pour toute l'app : noms (.nom-defile) et
// placeholders longs ([data-ph-long]) glissent tous à la même vitesse, partent ensemble, s'arrêtent chacun quand leur
// fin est visible, puis reviennent ensemble et retrouvent leur début au même instant.
export const VITESSE_DEFILEMENT = 30; // px par seconde
const ATTENTE = 1500; // ms au début et au bout
// Toucher un nom l'arrête quelques secondes, le temps de le lire ou de le faire glisser au doigt.
const PAUSE_TOUCHER = 4000;

// Décalage d'un texte qui dépasse de `depasse` px, à l'instant t, quand le plus long dépasse de `max` px : un cycle =
// attente, aller du plus long, attente, retour ; les plus courts s'arrêtent au bout puis repartent pour arriver en même temps.
export function decalageDefilement(t, max, depasse) {
  if (max <= 0 || depasse <= 0) return 0;
  const trajet = (max / VITESSE_DEFILEMENT) * 1000;
  const p = t % (2 * ATTENTE + 2 * trajet);
  let parcouru;
  if (p < ATTENTE) parcouru = 0;
  else if (p < ATTENTE + trajet) parcouru = ((p - ATTENTE) / 1000) * VITESSE_DEFILEMENT;
  else if (p < 2 * ATTENTE + trajet) parcouru = max;
  else parcouru = max - ((p - 2 * ATTENTE - trajet) / 1000) * VITESSE_DEFILEMENT;
  // Chacun suit le plus long sans dépasser son propre bout : à l'aller il s'arrête au bout, au retour il y attend
  // que le plus long revienne à sa hauteur.
  return Math.max(0, Math.min(depasse, parcouru));
}

export function useDefilementSynchro() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.requestAnimationFrame) return;
    const reduit = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const pauses = new WeakMap();
    let noms = [], placeholders = [], image, aRelire = true;

    // Les éléments sont relus quand la page change ou se redimensionne, pas à chaque image.
    const relire = () => { aRelire = true; };
    const ajouts = new MutationObserver(relire);
    ajouts.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-ph-long", "class"] });
    window.addEventListener("resize", relire);
    const toucher = (e) => {
      const nom = e.target.closest?.(".nom-defile");
      if (nom) pauses.set(nom, performance.now() + PAUSE_TOUCHER);
    };
    document.addEventListener("pointerdown", toucher, true);
    document.addEventListener("wheel", toucher, { capture: true, passive: true });

    const tourner = (t) => {
      image = requestAnimationFrame(tourner);
      if (reduit?.matches) return;
      if (aRelire) {
        aRelire = false;
        noms = [...document.querySelectorAll(".nom-defile")].map((el) => ({ el, depasse: el.scrollWidth - el.clientWidth }));
        placeholders = [...document.querySelectorAll("[data-ph-long]")];
      }
      const depasses = placeholders.map((champ) => (champ.value ? 0 : Math.abs(parseFloat(champ.style.getPropertyValue("--ph-decalage")) || 0)));
      const max = Math.max(0, ...noms.map((n) => (n.el.isConnected ? n.depasse : 0)), ...depasses);
      for (const n of noms) {
        if (n.depasse < 2 || !n.el.isConnected || (pauses.get(n.el) ?? 0) > t) continue;
        n.el.scrollLeft = decalageDefilement(t, max, n.depasse);
      }
      placeholders.forEach((champ, i) => {
        if (depasses[i]) champ.style.setProperty("--ph-position", `${(-decalageDefilement(t, max, depasses[i])).toFixed(1)}px`);
      });
    };
    image = requestAnimationFrame(tourner);
    return () => {
      cancelAnimationFrame(image);
      ajouts.disconnect();
      window.removeEventListener("resize", relire);
      document.removeEventListener("pointerdown", toucher, true);
      document.removeEventListener("wheel", toucher, { capture: true });
    };
  }, []);
}
