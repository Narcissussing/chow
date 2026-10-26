import { useEffect } from "react";

// Placeholder plus long que son champ : il défile lentement d'un bout à l'autre et se fond à droite
// (styles dans communs.css). Mesuré pour chaque champ de la page, y compris ceux qui apparaissent ensuite.
const mesure = typeof document !== "undefined" ? document.createElement("canvas").getContext?.("2d") : null;

function ajuster(champ) {
  const texte = champ.getAttribute("placeholder");
  const style = getComputedStyle(champ);
  const place = champ.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  if (!mesure || !texte || place <= 0) return champ.removeAttribute("data-ph-long");
  mesure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  // 28 px de marge : la fin du texte sort du fondu avant de revenir.
  const depasse = Math.ceil(mesure.measureText(texte).width - place + 28);
  if (depasse <= 28) return champ.removeAttribute("data-ph-long");
  champ.setAttribute("data-ph-long", "");
  champ.style.setProperty("--ph-decalage", `-${depasse}px`);
  champ.style.setProperty("--ph-duree", `${(2 + depasse / 25).toFixed(1)}s`);
}

export function usePlaceholdersDefilants() {
  useEffect(() => {
    if (!mesure || typeof ResizeObserver === "undefined") return;
    const tailles = new ResizeObserver((entrees) => entrees.forEach((e) => (e.target.isConnected ? ajuster(e.target) : tailles.unobserve(e.target))));
    const suivis = new WeakSet();
    const suivre = () => {
      document.querySelectorAll("input[placeholder], textarea[placeholder]").forEach((champ) => {
        if (suivis.has(champ)) return;
        suivis.add(champ);
        tailles.observe(champ);
      });
    };
    suivre();
    const ajouts = new MutationObserver(suivre);
    ajouts.observe(document.body, { childList: true, subtree: true });
    return () => {
      ajouts.disconnect();
      tailles.disconnect();
    };
  }, []);
}
