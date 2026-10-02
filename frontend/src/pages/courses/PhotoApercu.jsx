// Aperçu plein écran : fermé au tap en dehors ou sur ✕ ; la photo « s'aspire » vers l'œil (--vers-x/--vers-y).
export default function PhotoApercu({ ouvert, src, fermeture, vers, refApercu, onFermer, onSupprimer }) {
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
        style={vers ? { "--vers-x": vers.x + "px", "--vers-y": vers.y + "px" } : undefined}
      >
        <button type="button" className="btn-fermer-photo" id="btnFermerPhoto" aria-label="Fermer" onClick={onFermer}>
          ✕
        </button>
        <img id="imgApercuPhoto" alt="Photo de référence" src={src || undefined} />
        <button type="button" className="btn-supprimer-pleine-largeur" id="btnSupprimerPhoto" onClick={onSupprimer}>
          Supprimer
        </button>
      </div>
    </div>
  );
}
