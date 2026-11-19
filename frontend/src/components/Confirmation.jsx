import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import FondModal from "./FondModal.jsx";
import "./Confirmation.css";

const SORTIE_MS = 200;
const mouvementReduit = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Petite fenêtre de confirmation au centre, fond assombri (même allure que « Terminer ? » du panier).
// Non, le fond ou Échap la referment ; le bouton d'action est rouge quand il détruit quelque chose.
export default function Confirmation({ question, action = "Oui", danger = false, onConfirmer, onAnnuler }) {
  const [sortie, setSortie] = useState(false);
  const minuteur = useRef(null);
  useEffect(() => () => clearTimeout(minuteur.current), []);

  function fermer(apres) {
    if (sortie) return;
    setSortie(true);
    minuteur.current = setTimeout(apres, mouvementReduit() ? 0 : SORTIE_MS);
  }
  const annuler = () => fermer(onAnnuler);

  useEffect(() => {
    function surTouche(e) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      annuler();
    }
    // À la descente : Échap ferme la confirmation avant la fenêtre qui est dessous.
    document.addEventListener("keydown", surTouche, true);
    return () => document.removeEventListener("keydown", surTouche, true);
  });

  return (
    <>
      <FondModal onFermer={annuler} fermant={sortie} />
      {createPortal(
        <div className={"confirmation" + (sortie ? " ferme" : "")} role="alertdialog" aria-label={question}>
          <b>{question}</b>
          <div className="confirmation__actions">
            <button type="button" className="confirmation__annuler" onClick={annuler}>
              Non
            </button>
            <button type="button" className={"confirmation__action" + (danger ? " danger" : "")} onClick={() => fermer(onConfirmer)}>
              {action}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
