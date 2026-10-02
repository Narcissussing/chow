import { useRef, useState } from "react";
import { useMinuteurs } from "../../hooks/useMinuteurs.js";
import { relancerClasse } from "../../utils/animation.js";
import { classeNiveauCL } from "../../utils/stock.js";
import { fetchAvecRetry, gererErreurReseau } from "./reseau.js";

// "Pop" quand le panier devient cliquable ; classe gérée hors React (le className du bouton ne change jamais).
export function jouerPopPanier(bouton) {
  if (!bouton) return;
  relancerClasse(bouton, "vient-de-s-activer");
  setTimeout(() => bouton.classList.remove("vient-de-s-activer"), 350);
}

function IndicateurStock({ item }) {
  if (item.quantite_stock === null || item.quantite_stock === undefined) return null;
  if (item.tracking_type !== "cl") {
    return (
      <span className="course-stock-indicator course-stock-badge" title={`Déjà ${item.quantite_stock} en stock`}>
        {item.quantite_stock}
      </span>
    );
  }
  return <span className={"course-stock-indicator course-stock-dot " + classeNiveauCL(item.quantite_stock)} title={`En stock : ${item.quantite_stock}`}></span>;
}

export default function CourseItem({ item, visible, arme, effets, aPhoto, onEnvoyer, onPhoto, refPanier, refPhoto, refCarte, onFinEntree }) {
  const planifier = useMinuteurs();
  const champNote = useRef(null);
  const panierQuantite = useRef(null);
  const envoiEnCours = useRef(new Set());
  const [note, setNote] = useState({ texte: (item.commentaire || "").trim(), cachee: false, masquage: false });
  const [ligne, setLigne] = useState({ cachee: true, masquage: false });
  const [saisieNote, setSaisieNote] = useState(item.commentaire || "");
  const [quantite, setQuantite] = useState("");
  const [envoi, setEnvoi] = useState({ achat: false, suppression: false });

  const estFormQuantite = Boolean(item.food_id) && item.tracking_type !== "cl";
  const quantiteInvalide = quantite.trim() === "" || Number(quantite) < 1;

  // ---------- Notes : seul l'émoji (ou la note affichée) ouvre le champ ----------

  function afficherChamp() {
    if (note.texte && !note.cachee) {
      setNote((n) => ({ ...n, masquage: true }));
      planifier(() => setNote((n) => ({ ...n, cachee: true, masquage: false })), 150);
    }
    setLigne({ cachee: false, masquage: false });
    setTimeout(() => champNote.current?.focus(), 0);
  }

  function auBlurNote() {
    const commentaire = saisieNote.trim();
    setLigne((l) => ({ ...l, masquage: true }));
    planifier(() => setLigne({ cachee: true, masquage: false }), 150);

    if (commentaire === note.texte) {
      setNote((n) => ({ ...n, cachee: false }));
      return;
    }
    // Mise à jour immédiate de l'affichage ; un échec réseau ne fait qu'afficher le toast.
    fetchAvecRetry("/courses/commentaire", { body: { idCourse: String(item.id), commentaire } }).catch(gererErreurReseau);
    setNote({ texte: commentaire, cachee: false, masquage: false });
  }

  // ---------- Achat / suppression (bouton désactivé pendant l'envoi) ----------

  async function envoyer(type, quantiteAchetee) {
    if (envoiEnCours.current.has(type)) return;
    envoiEnCours.current.add(type);
    setEnvoi((e) => ({ ...e, [type]: true }));
    const retire = await onEnvoyer(type, quantiteAchetee);
    if (!retire) {
      envoiEnCours.current.delete(type);
      setEnvoi((e) => ({ ...e, [type]: false }));
    }
  }

  function changerQuantite(valeur) {
    const etaitInvalide = quantiteInvalide;
    setQuantite(valeur);
    const devientValide = !(valeur.trim() === "" || Number(valeur) < 1);
    if (etaitInvalide && devientValide) jouerPopPanier(panierQuantite.current);
  }

  const boutonPhoto = (
    <button
      ref={refPhoto}
      type="button"
      className="btn-photo-course"
      // Le CSS change l'icône (télécharger / œil) selon data-a-photo.
      data-a-photo={aPhoto ? "true" : "false"}
      title="Photo de référence"
      onClick={(e) => {
        relancerClasse(e.currentTarget, "photo-pop");
        onPhoto();
      }}
    />
  );

  const classes = ["course-item", "carte-article"];
  if (!visible) classes.push("hidden");
  if (arme) classes.push("arme");
  if (effets.entree) classes.push("entree");
  if (effets.miseEnAvant) classes.push("mise-en-avant");
  if (effets.sortie) classes.push(effets.sortie);

  return (
    <div
      ref={refCarte}
      className={classes.join(" ")}
      data-id={item.id}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && effets.entree) onFinEntree();
      }}
    >
      <IndicateurStock item={item} />
      <span className="course-nom">
        <span className="course-nom-emoji" onClick={afficherChamp}>
          {item.emoji}
        </span>{" "}
        {item.nom}
      </span>

      <form
        action="/courses/supprimer"
        method="post"
        className="form-supprimer"
        onSubmit={(e) => {
          e.preventDefault();
          envoyer("suppression");
        }}
      >
        <input type="hidden" name="idCourse" value={item.id} />
        <button type="submit" className="btn-supprimer-icone btn-supprimer-dash" disabled={envoi.suppression}>
          Supprimer
        </button>
      </form>

      {note.texte && (
        <p className={"note-affichee" + (note.cachee ? " hidden" : "") + (note.masquage ? " masquage" : "")} onClick={afficherChamp}>
          <span className="icone-note"></span> {note.texte}
        </p>
      )}
      <div className={"ligne-commentaire" + (ligne.cachee ? " hidden" : "") + (ligne.masquage ? " masquage-input" : "")}>
        <input
          ref={champNote}
          type="text"
          className="input-commentaire"
          placeholder="Ajouter une note"
          value={saisieNote}
          onChange={(e) => setSaisieNote(e.target.value)}
          onBlur={auBlurNote}
        />
        {!aPhoto && boutonPhoto}
      </div>

      {estFormQuantite ? (
        <form
          action="/courses/acheter"
          method="post"
          className="form-acheter form-quantite"
          onSubmit={(e) => {
            e.preventDefault();
            if (quantiteInvalide) return;
            envoyer("achat", quantite);
          }}
        >
          <input type="hidden" name="idCourse" value={item.id} />
          <div className="course-item__quantite-groupe">
            <div className="suggestions-quantite">
              {[1, 2, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  className="suggestion"
                  onClick={() => {
                    // Une suggestion remplit le champ et soumet directement, sans repasser par "Acheté".
                    changerQuantite(String(v));
                    envoyer("achat", String(v));
                  }}
                >
                  <span className="signe-mini">+</span>
                  {v}
                </button>
              ))}
            </div>
            <input
              type="number"
              name="quantiteAchetee"
              className="champ-quantite-achat"
              min="1"
              placeholder="Quantité"
              value={quantite}
              onChange={(e) => changerQuantite(e.target.value)}
            />
          </div>
          <div className="course-item__shop-slot">
            <button
              ref={(el) => {
                panierQuantite.current = el;
                refPanier(el);
              }}
              type="submit"
              className="btn-icone-rond btn-acheter-icone btn-enregistrer-achat"
              disabled={quantiteInvalide || envoi.achat}
            >
              Acheté
            </button>
          </div>
        </form>
      ) : (
        <form
          action="/courses/acheter"
          method="post"
          className="form-acheter"
          onSubmit={(e) => {
            e.preventDefault();
            envoyer("achat");
          }}
        >
          <input type="hidden" name="idCourse" value={item.id} />
          <div className="course-item__shop-slot">
            <button ref={refPanier} type="submit" className="btn-icone-rond btn-acheter-icone" disabled={envoi.achat}>
              Acheté
            </button>
          </div>
        </form>
      )}

      {aPhoto && boutonPhoto}
    </div>
  );
}
