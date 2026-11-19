import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ENSEIGNES } from "../../components/SelecteurMagasin.jsx";
import LogoEnseigne from "../../components/LogoEnseigne.jsx";
import { useClicExterieur } from "../../hooks/useClicExterieur.js";
import "./TiroirMagasins.css";

// Logos visibles avant de glisser (« Tous » compris).
const VISIBLES = 4;
const mouvementReduit = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Logos des magasins qui sortent du caddie vers la droite (deux touchers sur le caddie), « Tous » en premier.
// Choisir : le logo choisi saute, les autres rentrent dans le caddie, puis il y rentre aussi et devient sa pastille.
// Toucher ailleurs (caddie compris), Échap ou défiler la page : tout rentre, rien ne change.
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

  // Amène un logo entièrement en vue dans le tiroir, centré si possible.
  function amenerEnVue(logo, doux = true) {
    const z = zone.current;
    if (!z || !logo) return;
    const cible = Math.max(0, Math.min(logo.offsetLeft - (z.clientWidth - logo.offsetWidth) / 2, z.scrollWidth - z.clientWidth));
    if (Math.abs(cible - z.scrollLeft) < 2) return;
    z.scrollTo({ left: cible, behavior: doux && !mouvementReduit() ? "smooth" : "auto" });
  }

  // Les logos sortent depuis la gauche, puis le tiroir glisse jusqu'au magasin en cours s'il est plus loin.
  useEffect(() => {
    const minuteurDefile = setTimeout(() => amenerEnVue(zone.current?.querySelector(".actuel")), mouvementReduit() ? 0 : 480);
    return () => clearTimeout(minuteurDefile);
  }, []);

  function choisir(nom, logo) {
    if (phase.etat !== "ouvert") return;
    amenerEnVue(logo);
    setPhase({ etat: "choisi", choix: nom });
    finir(560, () => {
      onChoisir(nom);
      onFermer();
    });
  }

  function rentrer() {
    if (phase.etat !== "ouvert") return;
    setPhase({ etat: "ferme", choix: null });
    finir(260, onFermer);
  }
  useClicExterieur(zones, rentrer, phase.etat === "ouvert");
  const rentrerActuel = useRef(rentrer);
  rentrerActuel.current = rentrer;
  useEffect(() => {
    // Un petit glissé du doigt en touchant un logo ne compte pas : la page doit vraiment défiler.
    const depuis = window.scrollY;
    const surTouche = (e) => e.key === "Escape" && rentrerActuel.current();
    const surDefilement = () => Math.abs(window.scrollY - depuis) > 24 && rentrerActuel.current();
    document.addEventListener("keydown", surTouche);
    window.addEventListener("scroll", surDefilement, { passive: true });
    return () => {
      document.removeEventListener("keydown", surTouche);
      window.removeEventListener("scroll", surDefilement);
    };
  }, []);

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
      {[{ nom: "tous" }, ...ENSEIGNES].map((e, i) => (
        <button
          key={e.nom}
          type="button"
          className={"tiroir-magasins__logo" + (e.nom === "tous" ? " tous" : "") + ((phase.choix ?? enseigne) === e.nom ? " actuel" : "") + (phase.choix === e.nom ? " choisi" : "")}
          style={{ "--i": i, "--depart": `${(i + 1) * 34 + 4}px` }}
          aria-label={e.nom === "tous" ? "Tous les magasins" : e.nom}
          aria-pressed={enseigne === e.nom}
          onClick={(ev) => choisir(e.nom, ev.currentTarget)}
        >
          {e.nom === "tous" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9.5 4.5 4h15L21 9.5M3 9.5h18M3 9.5c0 1.4 1.1 2.5 2.5 2.5S8 10.9 8 9.5c0 1.4 1.1 2.5 2.5 2.5h3c1.4 0 2.5-1.1 2.5-2.5 0 1.4 1.1 2.5 2.5 2.5S21 10.9 21 9.5M5 12v8h14v-8M10 20v-5h4v5" />
            </svg>
          ) : (
            <LogoEnseigne nom={e.nom} taille={20} />
          )}
        </button>
      ))}
    </span>
  );
}
