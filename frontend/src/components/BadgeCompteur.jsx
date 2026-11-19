import { useEffect, useRef } from "react";
import { relancerClasse } from "../utils/animation.js";
import "./BadgeCompteur.css";

export default function BadgeCompteur({ icone, nombre, label, filtre = false, remplissage = null, className = "", ref }) {
  const chiffre = useRef(null);
  const precedent = useRef(nombre);
  const couvercle = useRef(null);
  const etaitPlein = useRef(remplissage >= 1);
  // La marmite vient d'être remplie : le couvercle saute puis retombe dessus.
  useEffect(() => {
    const plein = remplissage !== null && remplissage >= 1;
    if (plein && !etaitPlein.current) relancerClasse(couvercle.current, "couvercle-saute");
    etaitPlein.current = plein;
  }, [remplissage]);
  useEffect(() => {
    if (precedent.current !== nombre) relancerClasse(chiffre.current, "badge-pop");
    precedent.current = nombre;
  }, [nombre]);
  const niveau = remplissage === null ? "" : remplissage >= 1 ? " badge-compteur--plein" : " badge-compteur--niveau";
  return (
    <div
      ref={ref}
      className={`hero__badge hero__badge--courses badge-compteur badge-compteur--${icone}${filtre ? " badge-compteur--filtre" : ""}${niveau}${className ? " " + className : ""}`}
      style={remplissage === null ? undefined : { "--vide": `${remplissage >= 1 ? 0 : 91 - 49 * Math.max(remplissage, 0)}%` }}
      title={label}
      aria-label={label}
    >
      {remplissage !== null && (
        <i className="badge-compteur__remplissage" aria-hidden="true">
          <i />
        </i>
      )}
      {icone === "cuisine" && <i ref={couvercle} className="badge-compteur__couvercle" aria-hidden="true" />}
      <span ref={chiffre}>{nombre}</span>
    </div>
  );
}
