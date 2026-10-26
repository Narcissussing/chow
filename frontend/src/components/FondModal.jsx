import { createPortal } from "react-dom";
import { useVerrouDefilement } from "../hooks/useVerrouDefilement.js";
import "./FondModal.css";

// Fond d'une bulle ou d'une fenêtre ouverte : la page derrière est assombrie, ne défile plus et ne réagit plus ;
// toucher le fond ferme la bulle. `zone` : l'élément qui peut encore défiler (la bulle elle-même).
export default function FondModal({ onFermer, zone, fermant = false }) {
  useVerrouDefilement(true, zone);
  return createPortal(
    <div
      className={"fond-modal" + (fermant ? " ferme" : "")}
      aria-hidden="true"
      onClick={(e) => {
        e.stopPropagation();
        onFermer();
      }}
    />,
    document.body
  );
}
