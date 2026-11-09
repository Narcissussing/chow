import { useState } from "react";
import { ENSEIGNES } from "./enseignes.js";
import "./LogoEnseigne.css";

// Logo d'une enseigne ; sans fichier (ou s'il ne charge pas), ses initiales sur une tuile à sa couleur.
export default function LogoEnseigne({ nom, taille = 20, className }) {
  const enseigne = ENSEIGNES.find((e) => e.nom === nom);
  const [manquant, setManquant] = useState(false);
  if (enseigne?.logo && !manquant) {
    return <img className={className} src={enseigne.logo} alt="" onError={() => setManquant(true)} />;
  }
  const initiales = nom.split(/\s+/).map((mot) => mot[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span
      className={"logo-initiales" + (className ? " " + className : "")}
      style={{ "--taille": taille + "px", "--couleur": enseigne?.couleur || "var(--accent)" }}
      aria-hidden="true"
    >
      {initiales}
    </span>
  );
}
