import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { afficherToast } from "../../toast.js";
import { useVerrouDefilement } from "../../hooks/useVerrouDefilement.js";
import { Courbe } from "./graphiques.jsx";
import { ENSEIGNES } from "./Filtres.jsx";

const logo = (nom) => ENSEIGNES.find((e) => e.nom === nom)?.logo;
const rythme = (j) => (j <= 1 ? "Chaque jour" : j < 7 ? `Tous les ${j} jours` : j < 11 ? "Chaque semaine" : j < 25 ? `Toutes les ${Math.round(j / 7)} sem.` : j < 45 ? "Chaque mois" : `Tous les ${Math.round(j / 30)} mois`);
const jour = (s) => new Date(s + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

// Fiche d'un produit de « Tes prix » : feuille en bas sur téléphone, panneau à droite sur ordinateur.
export default function FicheProduit({ idAliment, euros, onFermer }) {
  const [fiche, setFiche] = useState(null);
  const [ajoute, setAjoute] = useState(false);
  const zone = useRef(null);
  useVerrouDefilement(true, zone);

  useEffect(() => {
    const controleur = new AbortController();
    api("/stats/produit/" + encodeURIComponent(idAliment), { signal: controleur.signal })
      .then(({ donnees }) => setFiche(donnees?.produit ?? false))
      .catch((err) => {
        if (err.type !== "annulation") setFiche(false);
      });
    return () => controleur.abort();
  }, [idAliment]);

  useEffect(() => {
    const echap = (e) => e.key === "Escape" && onFermer();
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [onFermer]);

  function ajouterAuxCourses() {
    api("/courses/ajouter", { method: "POST", body: { idAliment } })
      .then(({ donnees }) => {
        if (donnees?.erreur) return afficherToast(donnees.erreur);
        setAjoute(true);
      })
      .catch(() => afficherToast("Une erreur est survenue."));
  }

  const unite = fiche?.unite ? " / " + fiche.unite : "";
  const moinsCher = fiche?.parEnseigne[0]?.nom;
  return (
    <div className="fiche-fond" onClick={onFermer}>
      <aside ref={zone} className="fiche" role="dialog" aria-modal="true" aria-label={fiche?.nom || "Produit"} onClick={(e) => e.stopPropagation()}>
        <span className="fiche__poignee" aria-hidden="true" />
        {fiche === null && <p className="fiche__vide">Chargement…</p>}
        {fiche === false && <p className="fiche__vide">Aucun achat trouvé pour ce produit.</p>}
        {fiche && (
          <>
            <header className="fiche__entete">
              <span className="fiche__tuile" aria-hidden="true">{fiche.emoji}</span>
              <div>
                <h2>{fiche.nom}</h2>
                <p>{fiche.achats} achats</p>
              </div>
              <button type="button" className="fiche__fermer" aria-label="Fermer" onClick={onFermer}>✕</button>
            </header>
            <div className="fiche__prix">
              <strong>{euros(fiche.prix, 2)}</strong>
              <span>{unite}</span>
              <span className={"puce " + (fiche.variation > 0 ? "puce--hausse" : fiche.variation < 0 ? "puce--baisse" : "")}>
                {fiche.variation > 0 ? "+" : ""}{fiche.variation} % depuis {fiche.depuis}
              </span>
            </div>
            <Courbe id="fiche-courbe" largeur={400} hauteur={130} format={(v) => euros(v, 2) + unite}
              points={fiche.courbe.map((c) => ({ valeur: c.prix, etiquette: c.etiquette, titre: new Date(c.mois + "-01T00:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) }))} />
            {fiche.habitudes.achats12Mois > 0 && (
              <section className="habitudes">
                <h3>Habitudes du foyer <span className="discret">· 12 derniers mois</span></h3>
                {/* Ce que l'aliment coûte au foyer, plutôt que son poids : par semaine, par mois, sur 12 mois. */}
                <div className="habitudes__tuiles">
                  <p><b>{euros(fiche.habitudes.depense12Mois / 52, 2)}</b><span>par semaine</span></p>
                  <p><b>{euros(fiche.habitudes.depense12Mois / 12)}</b><span>par mois</span></p>
                  <p><b>{euros(fiche.habitudes.depense12Mois)}</b><span>en {fiche.habitudes.achats12Mois} achats</span></p>
                  {fiche.habitudes.rythmeJours && <p><b>{rythme(fiche.habitudes.rythmeJours)}</b><span>rythme d’achat</span></p>}
                </div>
                <p className="habitudes__rappel">
                  Dernier achat {fiche.habitudes.joursDepuis === 0 ? "aujourd’hui" : `il y a ${fiche.habitudes.joursDepuis} j`}
                  {fiche.habitudes.prochainAchat && <> · prochain vers le <b>{jour(fiche.habitudes.prochainAchat)}</b></>}
                </p>
              </section>
            )}
            <div className="fiche__colonnes">
              <section>
                <h3>Par magasin</h3>
                {fiche.parEnseigne.map((e) => (
                  <p key={e.nom} className="fiche__ligne">
                    <img src={logo(e.nom)} alt="" />
                    <span>{e.nom}</span>
                    <strong className={e.nom === moinsCher && fiche.parEnseigne.length > 1 ? "moins-cher" : undefined}>{euros(e.prix, 2)}{unite}</strong>
                  </p>
                ))}
              </section>
              <section>
                <h3>Derniers achats</h3>
                {fiche.derniersAchats.map((a, i) => (
                  <p key={i} className="fiche__ligne">
                    <span className="fiche__date">{jour(a.jour)}</span>
                    <span className="discret">{a.enseigne}{a.quantite ? " · " + a.quantite : ""}</span>
                    <strong>{euros(a.total, 2)}</strong>
                  </p>
                ))}
              </section>
            </div>
            <button type="button" className="fiche__ajouter" disabled={ajoute} onClick={ajouterAuxCourses}>
              {ajoute ? "Ajouté aux Courses ✓" : "Ajouter aux Courses"}
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
