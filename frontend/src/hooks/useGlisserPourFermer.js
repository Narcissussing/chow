import { useEffect, useRef } from "react";

const SEUIL = 90;
const VITESSE = 0.6;
const SORTIE_MS = 200;
const surTelephone = () => typeof window.matchMedia === "function" && window.matchMedia("(max-width: 860px)").matches;

// Un contenu déjà descendu entre le doigt et la feuille : le geste fait défiler, il ne ferme pas.
function contenuDescendu(cible, feuille) {
  for (let el = cible; el && el !== feuille.parentElement; el = el.parentElement) {
    if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight) return true;
  }
  return false;
}

// Sur téléphone, tirer une feuille vers le bas la ferme : depuis sa poignée ou son en-tête ([data-entete-feuille]),
// ou de n'importe où quand son contenu est tout en haut. Relâchée trop tôt, elle remonte à sa place.
// `enteteSeulement` : seulement depuis l'en-tête, pour une feuille dont les lignes se déplacent au doigt.
// Les zones qui ont leur propre geste (courbes, [data-pas-glisser]) ne ferment jamais.
export function useGlisserPourFermer(feuille, fermer, actif = true, enteteSeulement = false) {
  const rappel = useRef(fermer);
  rappel.current = fermer;

  useEffect(() => {
    const el = feuille.current;
    if (!actif || !el) return;
    let depart = null;
    let dy = 0;
    let t0 = 0;
    let glisse = false;

    function debut(e) {
      depart = null;
      if (!surTelephone() || e.touches.length !== 1) return;
      const surEntete = !!e.target.closest?.("[data-entete-feuille], .poignee-feuille");
      if (!surEntete && (enteteSeulement || e.target.closest?.(".courbe, [data-pas-glisser]") || contenuDescendu(e.target, el))) return;
      depart = e.touches[0].clientY;
      t0 = Date.now();
      dy = 0;
      glisse = false;
    }
    function deplacement(e) {
      if (depart === null) return;
      dy = e.touches[0].clientY - depart;
      if (!glisse) {
        if (dy < -6) depart = null;
        if (dy < 6) return;
        glisse = true;
      }
      e.preventDefault();
      el.style.transition = "none";
      el.style.transform = `translateY(${Math.max(0, dy)}px)`;
    }
    function fin() {
      if (depart === null || !glisse) {
        depart = null;
        return;
      }
      depart = null;
      const vitesse = dy / Math.max(1, Date.now() - t0);
      if (dy > SEUIL || (vitesse > VITESSE && dy > 40)) {
        el.style.transition = `transform ${SORTIE_MS}ms ease-in`;
        el.style.transform = "translateY(110%)";
        setTimeout(() => rappel.current(), SORTIE_MS);
        // Une feuille qui reste dans la page (recette) retrouve sa position normale une fois cachée.
        setTimeout(() => {
          if (el.isConnected) el.style.transition = el.style.transform = "";
        }, SORTIE_MS + 300);
      } else {
        el.style.transition = "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)";
        el.style.transform = "";
        setTimeout(() => (el.style.transition = ""), 260);
      }
    }

    el.addEventListener("touchstart", debut, { passive: true });
    el.addEventListener("touchmove", deplacement, { passive: false });
    el.addEventListener("touchend", fin);
    el.addEventListener("touchcancel", fin);
    return () => {
      el.removeEventListener("touchstart", debut);
      el.removeEventListener("touchmove", deplacement);
      el.removeEventListener("touchend", fin);
      el.removeEventListener("touchcancel", fin);
    };
  }, [feuille, actif, enteteSeulement]);
}
