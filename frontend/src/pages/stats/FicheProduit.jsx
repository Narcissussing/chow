import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { afficherToast } from "../../toast.js";
import { useVerrouDefilement } from "../../hooks/useVerrouDefilement.js";
import { useFermetureAnimee } from "../../hooks/useFermetureAnimee.js";
import { useGlisserPourFermer } from "../../hooks/useGlisserPourFermer.js";
import BoutonFermer from "../../components/BoutonFermer.jsx";
import { Courbe } from "./graphiques.jsx";
import { ENSEIGNES } from "../../components/SelecteurMagasin.jsx";
import { libellePeriode } from "./Filtres.jsx";
import { NombreAnime } from "./animations.js";

const logo = (nom) => ENSEIGNES.find((e) => e.nom === nom)?.logo;
const rythme = (j) => (j <= 1 ? "Chaque jour" : j < 7 ? `Tous les ${j} jours` : j < 11 ? "Chaque semaine" : j < 25 ? `Toutes les ${Math.round(j / 7)} sem.` : j < 45 ? "Chaque mois" : `Tous les ${Math.round(j / 30)} mois`);
const jour = (s) => new Date(s + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

// Fiche d'un produit de « Tes prix » : feuille en bas sur téléphone, panneau à droite sur ordinateur.
export default function FicheProduit({ idAliment, periode, enseigne, euros, onFermer }) {
  const [fiche, setFiche] = useState(null);
  const [ajoute, setAjoute] = useState(false);
  const zone = useRef(null);
  const [ferme, fermer] = useFermetureAnimee(onFermer);
  useVerrouDefilement(true, zone);
  useGlisserPourFermer(zone, fermer);

  useEffect(() => {
    const controleur = new AbortController();
    const params = new URLSearchParams({ ...periode, enseigne });
    api("/stats/produit/" + encodeURIComponent(idAliment) + "?" + params, { signal: controleur.signal })
      .then(({ donnees }) => setFiche(donnees?.produit ?? false))
      .catch((err) => {
        if (err.type !== "annulation") setFiche(false);
      });
    return () => controleur.abort();
  }, [idAliment, periode, enseigne]);

  useEffect(() => {
    const echap = (e) => e.key === "Escape" && fermer();
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [fermer]);

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
    <div className={"fiche-fond" + (ferme ? " ferme" : "")} onClick={fermer}>
      <aside ref={zone} className={"fiche" + (ferme ? " ferme" : "")} role="dialog" aria-modal="true" aria-label={fiche?.nom || "Produit"} onClick={(e) => e.stopPropagation()}>
        <span className="fiche__poignee poignee-feuille" aria-hidden="true" />
        {fiche === null && <p className="fiche__vide">Chargement…</p>}
        {fiche === false && <p className="fiche__vide">Aucun achat trouvé pour ce produit.</p>}
        {fiche && (
          <>
            <header className="fiche__entete" data-entete-feuille>
              <span className="fiche__tuile" aria-hidden="true">{fiche.emoji}</span>
              <div>
                <h2 className="nom-defile">{fiche.nom}</h2>
                <p>
                  {euros(fiche.depenseTotale ?? 0)} dépensés depuis {fiche.premierAchat?.slice(0, 4) ?? fiche.depuis}
                  {fiche.economiePromos > 0 && <> · <span className="fiche__economie">{euros(fiche.economiePromos)} économisés en promo</span></>}
                </p>
              </div>
              <BoutonFermer onClick={fermer} />
            </header>
            {fiche.periode && (
              <div className="fiche__periode">
                <span className="fiche__periode-icone" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2" />
                    <circle cx="9" cy="20" r="1.3" />
                    <circle cx="17" cy="20" r="1.3" />
                  </svg>
                </span>
                <p>
                  <b><NombreAnime valeur={fiche.periode.achats} format={(n) => Math.round(n) + (Math.round(n) > 1 ? " achats" : " achat")} /></b>
                  <span>{libellePeriode(periode)}{enseigne !== "tous" ? " · " + enseigne : ""}</span>
                </p>
                <strong><NombreAnime valeur={fiche.periode.depense} format={(n) => euros(n)} /></strong>
              </div>
            )}
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
                    <strong>
                      {euros(a.total, 2)}
                      {a.remise > 0 && <span className="fiche__promo">−{euros(a.remise, 2)} promo</span>}
                    </strong>
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
