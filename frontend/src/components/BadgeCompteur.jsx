import { useEffect, useRef } from "react";
import { relancerClasse } from "../utils/animation.js";

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
