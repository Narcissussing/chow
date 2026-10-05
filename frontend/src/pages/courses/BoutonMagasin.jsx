import { useLayoutEffect, useRef, useState } from "react";
import "./BoutonMagasin.css";

const TRAITS = [
  { dehors: "M6 7L42 7L42 15L6 15Z", dedans: "M5 12L10.5 12L10.5 12L5 12Z" },
  { dehors: "M9 41L9 15L39 15L39 41", dedans: "M15.4 30L11.8 17L39.6 17L36 30" },
  { dehors: "M12 11L36 11", dedans: "M10.5 12L15.4 30" },
  { dehors: "M7 41L41 41", dedans: "M13.8 34.5L36.5 34.5" },
];

const mouvementReduit = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function BoutonMagasin({ actif, onBasculer }) {
  const svg = useRef(null);
  const [sens, setSens] = useState(null);
  const depart = useRef(actif);
  const reduit = mouvementReduit();

  useLayoutEffect(() => {
    if (!sens || reduit || !svg.current) return;
    svg.current.querySelectorAll(`animate[data-sens="${sens}"]`).forEach((a) => a.beginElementAt?.(sens === "aller" ? 0.95 : 0.05));
  }, [sens, reduit]);

  function basculer() {
    setSens(actif ? "retour" : "aller");
    onBasculer();
  }

  const classes = ["btn-magasin"];
  if (actif) classes.push("actif");
  if (sens === "aller") classes.push("entre");
  if (sens === "retour") classes.push("sort");

  return (
    <button
      type="button"
      id="toggleMagasin"
      className={classes.join(" ")}
      aria-pressed={actif}
      aria-label={actif ? "Quitter le mode magasin" : "Passer en mode magasin"}
      title={actif ? "Quitter le mode magasin" : "Mode magasin"}
      onClick={basculer}
    >
      <svg ref={svg} viewBox="0 0 48 48" aria-hidden="true">
        <path className="btn-magasin__teinte" d="M12.6 17h27l-3.5 13H15.4z" />
        <g className="btn-magasin__client">
          <circle className="trait fin" cx="19" cy="27" r="2.3" />
          <path className="trait fin" d="M15.6 39.5c0-4.4 6.8-4.4 6.8 0M21.2 33.4h3.4M24.4 31h1.6l1.3 5.2h5.2l1.3-3.8h-7.3" />
          <circle className="trait fin" cx="27.8" cy="38.6" r="1.1" />
          <circle className="trait fin" cx="32.2" cy="38.6" r="1.1" />
        </g>
        <g className="btn-magasin__portes">
          <rect className="btn-magasin__porte-g trait" x="14" y="20" width="10" height="21" />
          <rect className="btn-magasin__porte-d trait" x="24" y="20" width="10" height="21" />
        </g>
        {TRAITS.map((t) => {
          const d = reduit ? (actif ? t.dedans : t.dehors) : depart.current ? t.dedans : t.dehors;
          return (
            <path key={t.dehors} className="trait" d={d}>
              <animate attributeName="d" dur="0.55s" begin="indefinite" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".5 0 .2 1" from={t.dehors} to={t.dedans} data-sens="aller" />
              <animate attributeName="d" dur="0.5s" begin="indefinite" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".5 0 .2 1" from={t.dedans} to={t.dehors} data-sens="retour" />
            </path>
          );
        })}
        <path className="btn-magasin__grille trait fin" d="M14.1 23.5h24M21 17l1.2 13M29.5 17l-.5 13" />
        <g className="btn-magasin__roues">
          <circle className="trait" cx="17.5" cy="39" r="2.8" />
          <circle className="trait" cx="33" cy="39" r="2.8" />
        </g>
      </svg>
    </button>
  );
}
