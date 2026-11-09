import { useLayoutEffect, useRef, useState } from "react";
import { ENSEIGNES } from "./enseignes.js";
import LogoEnseigne from "./LogoEnseigne.jsx";
import "./SelecteurMagasin.css";

export { ENSEIGNES };

// Logos visibles avant de glisser (comme le tiroir des Courses), en plus du bouton « tous ».
const VISIBLES = 3;

export default function SelecteurMagasin({ enseigne, onChange }) {
  const rangee = useRef(null);
  const [defile, setDefile] = useState({ deborde: false, auBout: false });

  // Largeur bornée au bouton « tous » + 3 logos ; le magasin choisi reste visible s'il est plus loin.
  useLayoutEffect(() => {
    const r = rangee.current;
    const dernier = r?.children[VISIBLES];
    if (!dernier) return;
    r.style.maxWidth = dernier.offsetLeft + dernier.offsetWidth + 3 + "px";
    const actif = r.querySelector("button.actif");
    if (actif && actif.offsetLeft + actif.offsetWidth > r.clientWidth) r.scrollLeft = actif.offsetLeft - r.clientWidth / 2;
    setDefile({ deborde: r.scrollWidth > r.clientWidth + 1, auBout: r.scrollLeft + r.clientWidth >= r.scrollWidth - 2 });
  }, [enseigne]);

  return (
    <div
      ref={rangee}
      className={"magasins" + (defile.deborde && !defile.auBout ? " deborde" : "")}
      role="group"
      aria-label="Magasin"
      onScroll={(e) => {
        const r = e.currentTarget;
        const auBout = r.scrollLeft + r.clientWidth >= r.scrollWidth - 2;
        if (auBout !== defile.auBout) setDefile((d) => ({ ...d, auBout }));
      }}
    >
      <button type="button" className={enseigne === "tous" ? "actif" : undefined} aria-pressed={enseigne === "tous"} aria-label="Tous les magasins" onClick={() => onChange("tous")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 9.5 4.5 4h15L21 9.5M3 9.5h18M3 9.5c0 1.4 1.1 2.5 2.5 2.5S8 10.9 8 9.5c0 1.4 1.1 2.5 2.5 2.5h3c1.4 0 2.5-1.1 2.5-2.5 0 1.4 1.1 2.5 2.5 2.5S21 10.9 21 9.5M5 12v8h14v-8M10 20v-5h4v5" />
        </svg>
      </button>
      {ENSEIGNES.map((e) => (
        <button key={e.nom} type="button" className={enseigne === e.nom ? "actif" : undefined} aria-pressed={enseigne === e.nom} aria-label={e.nom} onClick={() => onChange(e.nom)}>
          <LogoEnseigne nom={e.nom} />
        </button>
      ))}
    </div>
  );
}
