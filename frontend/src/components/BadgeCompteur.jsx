import { useEffect, useRef } from "react";
import { relancerClasse } from "../utils/animation.js";

// Total d'une page dans une icône (boîte de rangement pour le Stock, marmite pour la Cuisine), comme le sac des Courses ; pop à chaque changement.
export default function BadgeCompteur({ icone, nombre, label, filtre = false, className = "", ref }) {
  const chiffre = useRef(null);
  const precedent = useRef(nombre);
  useEffect(() => {
    if (precedent.current !== nombre) relancerClasse(chiffre.current, "badge-pop");
    precedent.current = nombre;
  }, [nombre]);
  return (
    <div ref={ref} className={`hero__badge hero__badge--courses badge-compteur badge-compteur--${icone}${filtre ? " badge-compteur--filtre" : ""}${className ? " " + className : ""}`} title={label} aria-label={label}>
      <span ref={chiffre}>{nombre}</span>
    </div>
  );
}
