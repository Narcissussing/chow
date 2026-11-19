import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useVerrouDefilement } from "../../hooks/useVerrouDefilement.js";
import { useGlisserPourFermer } from "../../hooks/useGlisserPourFermer.js";
import BoutonFermer from "../../components/BoutonFermer.jsx";
import Confirmation from "../../components/Confirmation.jsx";
import "./PhotoApercu.css";

const mouvementReduit = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const Fleche = ({ sens }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={sens === "gauche" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
  </svg>
);

// Photos de référence d'un article : on glisse d'une photo à l'autre (défilement natif aimanté) ou on touche les flèches ;
// points et « 2 / 3 » dessous dès qu'il y en a deux. « Ajouter » en prend une de plus, « Supprimer » demande confirmation
// dans une petite fenêtre, puis retire celle affichée.
export default function PhotoApercu({ ouvert, photos, index, onIndex, sortante, fermeture, vers, refApercu, onFermer, onAjouter, onSupprimer }) {
  const piste = useRef(null);
  // La page derrière est bloquée, mais pas la piste : le doigt doit pouvoir faire défiler les photos.
  useVerrouDefilement(ouvert, piste);
  useGlisserPourFermer(refApercu, onFermer, ouvert);
  // Index venu du doigt : la piste est déjà à sa place, il ne faut pas la relancer (elle lutterait contre le doigt).
  const depuisLeDoigt = useRef(false);
  // Glissade lancée par une flèche : les positions intermédiaires ne changent pas l'index.
  const cibleEnCours = useRef(null);
  const nombre = photos.length;
  const plusieurs = nombre > 1;
  // Fenêtre « Supprimer cette photo ? » ouverte ; oubliée si l'on change de photo ou ferme la visionneuse.
  const [aConfirmer, setAConfirmer] = useState(false);
  useEffect(() => setAConfirmer(false), [index, ouvert, nombre]);

  // À l'ouverture, la piste se place sur la photo demandée sans glisser.
  useLayoutEffect(() => {
    const p = piste.current;
    cibleEnCours.current = null;
    if (ouvert && p) p.scrollLeft = index * p.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  // Index changé par une flèche, le clavier, une suppression ou une photo ajoutée : la piste glisse jusqu'à elle.
  useEffect(() => {
    const p = piste.current;
    if (!ouvert || !p) return;
    if (depuisLeDoigt.current) {
      depuisLeDoigt.current = false;
      return;
    }
    const cible = index * p.clientWidth;
    if (Math.abs(p.scrollLeft - cible) <= 2) return;
    const reduit = mouvementReduit();
    cibleEnCours.current = reduit ? null : cible;
    p.scrollTo({ left: cible, behavior: reduit ? "auto" : "smooth" });
  }, [index, nombre, ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    function surTouche(e) {
      if (e.key === "Escape") onFermer();
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      if (e.key === "ArrowRight" && index < nombre - 1) onIndex(index + 1);
    }
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [ouvert, index, nombre, onFermer, onIndex]);

  function surDefilement(e) {
    const p = e.currentTarget;
    if (cibleEnCours.current !== null) {
      if (Math.abs(p.scrollLeft - cibleEnCours.current) > 2) return;
      cibleEnCours.current = null;
    }
    const i = Math.round(p.scrollLeft / Math.max(1, p.clientWidth));
    if (i !== index && i >= 0 && i < nombre) {
      depuisLeDoigt.current = true;
      onIndex(i);
    }
  }

  // Le doigt reprend la piste pendant une glissade de flèche : c'est lui qui décide.
  function surToucher() {
    cibleEnCours.current = null;
  }

  return (
    <div
      className={"photo-backdrop" + (ouvert ? " ouvert" : "")}
      id="photoBackdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFermer();
      }}
    >
      <div
        ref={refApercu}
        className={"photo-apercu" + (fermeture ? " fermeture" : "")}
        role="dialog"
        aria-label="Photos de référence"
        style={vers ? { "--vers-x": vers.x + "px", "--vers-y": vers.y + "px" } : undefined}
      >
        <BoutonFermer className="bouton-fermer--sur-photo btn-fermer-photo" onClick={onFermer} />
        <div className="photo-scene">
          <div ref={piste} className="photo-piste" onScroll={surDefilement} onTouchStart={surToucher} onWheel={surToucher}>
            {photos.map((p, i) => (
              <div key={p.id} className={"photo-diapo" + (p.id === sortante ? " sortante" : "")} aria-hidden={i !== index}>
                <img id={i === index ? "imgApercuPhoto" : undefined} alt={`Photo ${i + 1} sur ${nombre}`} src={p.src} draggable={false} />
              </div>
            ))}
          </div>
          {plusieurs && (
            <>
              <button type="button" className={"photo-fleche photo-fleche--gauche" + (index === 0 ? " cachee" : "")} aria-label="Photo précédente" onClick={() => onIndex(index - 1)}>
                <Fleche sens="gauche" />
              </button>
              <button type="button" className={"photo-fleche photo-fleche--droite" + (index >= nombre - 1 ? " cachee" : "")} aria-label="Photo suivante" onClick={() => onIndex(index + 1)}>
                <Fleche sens="droite" />
              </button>
            </>
          )}
        </div>
        <div className={"photo-compteur" + (plusieurs ? "" : " cache")} aria-hidden={!plusieurs}>
          <span className="photo-points">
            {photos.map((p, i) => (
              <span key={p.id} className={"photo-point" + (i === index ? " actif" : "")} />
            ))}
          </span>
          <span className="photo-compteur__texte">
            {Math.min(index + 1, nombre)} / {nombre}
          </span>
        </div>
        {aConfirmer && (
          <Confirmation
            question="Supprimer la photo ?"
            action="Oui"
            danger
            onAnnuler={() => setAConfirmer(false)}
            onConfirmer={() => {
              setAConfirmer(false);
              onSupprimer();
            }}
          />
        )}
          <div className="photo-actions">
            <button type="button" className="photo-action" id="btnAjouterPhoto" onClick={onAjouter}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
                <circle cx="12" cy="13" r="3.2" />
              </svg>
              Ajouter
            </button>
            <button type="button" className="photo-action photo-action--supprimer" id="btnSupprimerPhoto" onClick={() => setAConfirmer(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5" />
              </svg>
              Supprimer
            </button>
          </div>
      </div>
    </div>
  );
}
