import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ENSEIGNES } from "../../components/SelecteurMagasin.jsx";
import LogoEnseigne from "../../components/LogoEnseigne.jsx";
import { useClicExterieur } from "../../hooks/useClicExterieur.js";
import "./TiroirMagasins.css";

// Logos visibles avant de glisser.
const VISIBLES = 3;
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
  // sans assez de place, le tiroir prend celle qui reste et ses logos glissent de côté. La place est recalculée
  // quand la barre change (page défilée : le compteur y entre, le caddie rétrécit), sinon le caddie passe sur le tri.
  // Le caddie revient à sa place quand le tiroir disparaît.
  const [defile, setDefile] = useState({ deborde: false, auBout: false });
  useLayoutEffect(() => {
    const caddie = zone.current?.parentElement;
    const barre = caddie?.parentElement;
    if (!barre) return;
    let decalage = 0;
    let image = 0;
    function placer() {
      // Le bouton de tri lui-même : dans la barre défilée, sa boîte peut être plus étroite que lui.
      const tri = barre.querySelector(".sort-wrapper .custom-select")?.getBoundingClientRect();
      const plus = barre.querySelector("#btnToggleAjoutCourse")?.getBoundingClientRect();
      if (!tri || !plus || !zone.current) return;
      // Place du caddie sans son décalage : offsetLeft ignore le transform, même en pleine glissade
      // (mesurer le rectangle animé faisait partir le caddie jusqu'au tri avant de revenir).
      const rect = caddie.getBoundingClientRect();
      const parent = caddie.offsetParent;
      const gauche = parent ? parent.getBoundingClientRect().left + parent.clientLeft + caddie.offsetLeft : rect.left - decalage;
      const naturelle = zone.current.scrollWidth;
      const place = Math.max(80, plus.left - tri.right - 16 - rect.width - 4);
      // Trois logos visibles au départ, les autres en glissant.
      const troisieme = zone.current.children[VISIBLES - 1];
      const trois = troisieme ? troisieme.offsetLeft + troisieme.offsetWidth + 4 : naturelle;
      const tiroir = Math.min(naturelle, place, trois);
      zone.current.style.maxWidth = tiroir + "px";
      const deborde = naturelle > tiroir + 1;
      setDefile((d) => (d.deborde === deborde ? d : { deborde, auBout: false }));
      const largeur = rect.width + 4 + tiroir;
      const cible = tri.right + Math.max(8, (plus.left - tri.right - largeur) / 2);
      decalage = Math.round(cible - gauche);
      caddie.style.transform = `translateX(${decalage}px)`;
    }
    const replacer = () => {
      cancelAnimationFrame(image);
      image = requestAnimationFrame(placer);
    };
    placer();
    const mutations = new MutationObserver(replacer);
    mutations.observe(barre, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    const tailles = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(replacer);
    tailles?.observe(barre);
    tailles?.observe(caddie);
    barre.addEventListener("transitionend", replacer);
    window.addEventListener("scroll", replacer, { passive: true });
    window.addEventListener("resize", replacer);
    return () => {
      cancelAnimationFrame(image);
      mutations.disconnect();
      tailles?.disconnect();
      barre.removeEventListener("transitionend", replacer);
      window.removeEventListener("scroll", replacer);
      window.removeEventListener("resize", replacer);
      caddie.style.transform = "";
    };
  }, []);

  return (
    <span
      ref={zone}
      className={"tiroir-magasins tiroir-magasins--" + phase.etat + (defile.deborde && !defile.auBout ? " deborde" : "")}
      role="group"
      aria-label="Choisir le magasin"
      onScroll={(e) => {
        const z = e.currentTarget;
        const auBout = z.scrollLeft + z.clientWidth >= z.scrollWidth - 2;
        if (auBout !== defile.auBout) setDefile((d) => ({ ...d, auBout }));
      }}
    >
      {ENSEIGNES.map((e, i) => (
        <button
          key={e.nom}
          type="button"
          className={"tiroir-magasins__logo" + (enseigne === e.nom ? " actuel" : "") + (phase.choix === e.nom ? " choisi" : "")}
          style={{ "--i": i, "--depart": `${(i + 1) * 34 + 4}px` }}
          aria-label={e.nom}
          aria-pressed={enseigne === e.nom}
          onClick={() => choisir(e.nom)}
        >
          <LogoEnseigne nom={e.nom} taille={20} />
        </button>
      ))}
    </span>
  );
}
