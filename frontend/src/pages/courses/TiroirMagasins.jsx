import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ENSEIGNES } from "../../components/SelecteurMagasin.jsx";
import { useClicExterieur } from "../../hooks/useClicExterieur.js";
import "./TiroirMagasins.css";

const mouvementReduit = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Logos des magasins qui sortent du caddie vers la droite (deux touchers sur le caddie).
// Choisir : le logo choisi saute, les autres rentrent dans le caddie, puis il y rentre aussi et devient sa pastille.
// Re-choisir le magasin déjà choisi = tous les magasins. Toucher ailleurs : tout rentre.
export default function TiroirMagasins({ enseigne, onChoisir, onFermer }) {
  const zone = useRef(null);
  const zones = useMemo(() => [zone], []);
  const [phase, setPhase] = useState({ etat: "ouvert", choix: null });
  const minuteur = useRef(null);
  useEffect(() => () => clearTimeout(minuteur.current), []);

  function finir(duree, apres) {
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(apres, mouvementReduit() ? 0 : duree);
  }

  function choisir(nom) {
    if (phase.etat !== "ouvert") return;
    setPhase({ etat: "choisi", choix: nom });
    finir(560, () => {
      onChoisir(nom === enseigne ? "tous" : nom);
      onFermer();
    });
  }

  function rentrer() {
    if (phase.etat !== "ouvert") return;
    setPhase({ etat: "ferme", choix: null });
    finir(260, onFermer);
  }
  useClicExterieur(zones, rentrer, phase.etat === "ouvert");

  // Le caddie et ses logos se centrent ensemble entre le tri et le + (avec ou sans compteur dans la barre) ;
  // le caddie revient à sa place quand le tiroir disparaît.
  useLayoutEffect(() => {
    const caddie = zone.current?.parentElement;
    const barre = caddie?.parentElement;
    const tri = barre?.querySelector(".sort-wrapper")?.getBoundingClientRect();
    const plus = barre?.querySelector("#btnToggleAjoutCourse")?.getBoundingClientRect();
    if (!tri || !plus) return;
    const debut = caddie.getBoundingClientRect();
    const largeur = debut.width + 4 + zone.current.offsetWidth;
    const cible = tri.right + Math.max(8, (plus.left - tri.right - largeur) / 2);
    caddie.style.transform = `translateX(${Math.round(cible - debut.left)}px)`;
    return () => {
      caddie.style.transform = "";
    };
  }, []);

  return (
    <span ref={zone} className={"tiroir-magasins tiroir-magasins--" + phase.etat} role="group" aria-label="Choisir le magasin">
      {ENSEIGNES.map((e, i) => (
        <button
          key={e.nom}
          type="button"
          className={"tiroir-magasins__logo" + (enseigne === e.nom ? " actuel" : "") + (phase.choix === e.nom ? " choisi" : "")}
          style={{ "--i": i, "--depart": `${(i + 1) * 40 + 4}px` }}
          aria-label={e.nom}
          aria-pressed={enseigne === e.nom}
          onClick={() => choisir(e.nom)}
        >
          <img src={e.logo} alt="" />
        </button>
      ))}
    </span>
  );
}
