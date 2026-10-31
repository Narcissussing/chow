import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import CustomSelect from "../../components/CustomSelect.jsx";
import Page from "../../components/Page.jsx";
import { api } from "../../api.js";
import FondModal from "../../components/FondModal.jsx";
import BoutonFermer from "../../components/BoutonFermer.jsx";
import { useGlisserPourFermer } from "../../hooks/useGlisserPourFermer.js";
import { useClicExterieur } from "../../hooks/useClicExterieur.js";
import { useFermetureAnimee } from "../../hooks/useFermetureAnimee.js";
import { normaliserTexte } from "../../utils/texte.js";
import { Anneau, Barres, COULEURS_RAYONS, Courbe, MiniCourbe, couleurRayon } from "./graphiques.jsx";
import SelecteurMagasin from "../../components/SelecteurMagasin.jsx";
import { SelecteurPeriode, libellePeriode } from "./Filtres.jsx";
import FicheProduit from "./FicheProduit.jsx";
import ListeProduits, { LignePrix } from "./ListeProduits.jsx";
import FeuilleTickets from "./FeuilleTickets.jsx";
import { NombreAnime, useBlocsAnimes } from "./animations.js";
import "./StatsPage.css";

const euros = (n, decimales = 0) =>
  (n ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }) + " €";
// Dépenser plus est en rouge, dépenser moins en vert.
const sens = (n) => (n > 0 ? " hausse" : n < 0 ? " baisse" : "");
const signe = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toLocaleString("fr-FR");

// Ce qui compte d'abord : l'argent dépensé.
const TRIS = [
  { valeur: "depense", texte: "Plus grosses dépenses" },
  { valeur: "achats", texte: "Les plus achetés" },
  { valeur: "hausse", texte: "Plus fortes hausses" },
];

const titreMois = (m) => new Date(m + "-01T00:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

function titreSeau(s, pas) {
  const date = new Date(s.debut + "T00:00:00");
  if (pas === "semaine") return "Sem. du " + date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  if (pas === "mois") return titreMois(s.debut.slice(0, 7));
  if (pas === "jour") return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return s.etiquette;
}

function comparaison(periode) {
  return { semaine: "vs sem. préc.", mois: "vs mois préc.", annee: "vs " + (Number(periode.ref.slice(0, 4)) - 1), "12mois": "vs 12 mois préc.", dates: "vs avant" }[periode.periode];
}

function titreDepense(periode) {
  if (periode.periode === "annee") return "Dépensé en " + periode.ref.slice(0, 4);
  if (periode.periode === "mois") return "Dépensé en " + new Date(periode.ref + "T00:00:00").toLocaleDateString("fr-FR", { month: "long" });
  if (periode.periode === "semaine") return "Dépensé cette semaine-là";
  if (periode.periode === "tout") return "Dépensé en tout";
  return "Dépensé · " + libellePeriode(periode);
}

// Bouton qui ouvre une bulle d'explication par-dessus la page (clic ailleurs ou Échap : fermée).
// Sur téléphone, la bulle devient une feuille en bas de l'écran, rendue hors de la page pour n'être jamais coupée.
const surTelephone = () => typeof window.matchMedia === "function" && window.matchMedia("(max-width: 860px)").matches;

function InfoBulle({ bouton, classeBouton, titre, children }) {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef(null);
  const bulleRef = useRef(null);
  const zones = useMemo(() => [zone, bulleRef], []);
  const [ferme, fermer] = useFermetureAnimee(useCallback(() => setOuvert(false), []), 180);
  useClicExterieur(zones, fermer, !!ouvert);
  useGlisserPourFermer(bulleRef, fermer, ouvert === "feuille");
  useEffect(() => {
    if (!ouvert) return;
    const echap = (e) => e.key === "Escape" && fermer();
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [ouvert, fermer]);
  const bulle = (
    <span ref={bulleRef} className={"info-popup" + (ouvert === "feuille" ? " info-popup--feuille" : "") + (ferme ? " ferme" : "")} role="dialog" aria-label={titre}>
      {ouvert === "feuille" && (
        <span className="info-popup__entete" data-entete-feuille>
          <span className="info-popup__poignee poignee-feuille" aria-hidden="true" />
          <BoutonFermer onClick={fermer} />
        </span>
      )}
      {children}
    </span>
  );
  return (
    <span className="info-ancre" ref={zone}>
      <button type="button" className={classeBouton} aria-expanded={!!ouvert} aria-label={typeof bouton === "string" ? titre : undefined} onClick={() => (ouvert ? fermer() : setOuvert(surTelephone() ? "feuille" : "bulle"))}>
        {bouton}
      </button>
      {ouvert && <FondModal onFermer={fermer} zone={bulleRef} fermant={ferme} />}
      {ouvert === "bulle" && bulle}
      {ouvert === "feuille" && createPortal(bulle, document.body)}
    </span>
  );
}

// Bulle 🇫🇷 : foyer et France comparés sur les mêmes mois de la période affichée (l'INSEE publie avec retard).
function ComparaisonFrance({ points, panier, jusqua, titreMois, euros, signe, ensemble }) {
  const communs = points.filter((p) => p.national !== null && p.mois <= jusqua);
  const premier = communs[0], dernier = communs[communs.length - 1];
  const foyer = Math.round((dernier.indice / premier.indice - 1) * 1000) / 10;
  const france = Math.round((dernier.national / premier.national - 1) * 1000) / 10;
  const ecart = Math.round((foyer - france) * 10) / 10;
  const mois = (m) => titreMois(m).replace(/ \d{4}$/, (a) => (premier.mois.slice(0, 4) === dernier.mois.slice(0, 4) && m === premier.mois ? "" : a));
  return (
    <>
      <b>De {mois(premier.mois)} à {mois(dernier.mois)}</b>
      <span className="comparaison">
        <span>Foyer <b className={foyer > 0 ? "hausse" : "baisse"}>{signe(foyer)} %</b></span>
        <span>🇫🇷 France{ensemble ? " (tout)" : ""} <b>{signe(france)} %</b></span>
      </span>
      <span>
        {Math.abs(ecart) < 0.5
          ? "Les prix du foyer suivent ceux de la France."
          : ecart > 0
            ? `Les prix du foyer montent plus vite que la moyenne (${signe(ecart)} pt).`
            : `Les prix du foyer montent moins vite que la moyenne (${signe(ecart)} pt).`}
      </span>
      {panier > 0 && (
        <span>Un mois de courses à {euros(panier)} coûterait {euros(panier * (1 + foyer / 100))} aux prix du foyer, {euros(panier * (1 + france / 100))} aux prix moyens.</span>
      )}
      <span className="discret">
        INSEE, {ensemble ? "tous les produits (alimentation, énergie, services…)" : "alimentation et boissons sans alcool"}, tous les ménages · des prix, pas des dépenses · dernier mois publié : {titreMois(jusqua)}.
      </span>
    </>
  );
}

// Produits qui ont le plus monté / baissé sur la période : contenu des bulles « Foyer » et de la tuile Inflation.
function Mouvements({ detail, euros, signe }) {
  if (!detail.hausses.length && !detail.baisses.length) return <span>Pas assez d’achats répétés sur cette période.</span>;
  return (
    <span className="mouvements">
      {[["hausses", "Ont le plus monté", "hausse"], ["baisses", "Ont le plus baissé", "baisse"]].map(([cle, titre, classe]) =>
        detail[cle].length > 0 && (
          <span key={cle} className="mouvements__groupe">
            <b>{titre}</b>
            {detail[cle].map((p) => (
              <span key={p.nom} className={"mouvement mouvement--" + classe}>
                <span>{p.emoji} {p.nom}</span>
                <span className="discret">{euros(p.avant, 2)} → {euros(p.apres, 2)}{p.unite ? " / " + p.unite : ""}</span>
                <b>{signe(p.variation)} %</b>
              </span>
            ))}
          </span>
        )
      )}
      <span className="discret">Sur {detail.nbProduits} produits suivis.</span>
    </span>
  );
}

// Icône de chaque KPI, affichée en grand et très pâle derrière la tuile.
const FILIGRANES = {
  depense: <><rect x="4" y="12" width="3.5" height="8" rx="1" /><rect x="10.25" y="7" width="3.5" height="13" rx="1" /><rect x="16.5" y="3.5" width="3.5" height="16.5" rx="1" /></>,
  semaine: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  inflation: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
};
const Filigrane = ({ type }) => (
  <span className="kpi__fond" aria-hidden="true">
    <svg className={"kpi__filigrane kpi__filigrane--" + type} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {FILIGRANES[type]}
    </svg>
  </span>
);

export default function StatsPage() {
  const [aujourdhui] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [periode, setPeriode] = useState({ periode: "semaine", ref: aujourdhui });
  const [enseigne, setEnseigne] = useState("tous");
  const [lecture, setLecture] = useState({ etat: "chargement", donnees: null });
  const [estimation, setEstimation] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState("depense");
  const [listeOuverte, setListeOuverte] = useState(false);
  const [produit, setProduit] = useState(null);
  const [rayonSurvole, setRayonSurvole] = useState(null);
  const [axeDepuisZero, setAxeDepuisZero] = useState(false);
  // Ligne France : prix de l'alimentation, ou de tous les produits (alimentation, énergie, services…).
  const [franceTout, setFranceTout] = useState(false);

  useEffect(() => {
    const controleur = new AbortController();
    const params = new URLSearchParams({ ...periode, enseigne });
    api("/stats?" + params, { signal: controleur.signal })
      .then(({ statut, donnees }) => setLecture(statut === 200 ? { etat: "pret", donnees } : (l) => (l.donnees ? l : { etat: "erreur", donnees: null })))
      .catch((err) => {
        if (err.type !== "annulation" && err.type !== "session") setLecture((l) => (l.donnees ? l : { etat: "erreur", donnees: null }));
      });
    return () => controleur.abort();
  }, [periode, enseigne]);

  useEffect(() => {
    api("/courses/estimation").then(({ donnees }) => setEstimation(donnees)).catch(() => {});
  }, []);

  const fermerFiche = useCallback(() => setProduit(null), []);
  const fermerListe = useCallback(() => setListeOuverte(false), []);
  const [ticketsOuverts, setTicketsOuverts] = useState(false);
  const fermerTickets = useCallback(() => setTicketsOuverts(false), []);
  const page = useRef(null);
  useBlocsAnimes(page);
  const d = lecture.donnees;

  const produits = useMemo(() => {
    if (!d) return [];
    const termes = normaliserTexte(recherche.trim().toLowerCase());
    const liste = d.produits.filter((p) => normaliserTexte(p.nom.toLowerCase()).includes(termes));
    const cle = { achats: (p) => p.achats, hausse: (p) => p.variation, depense: (p) => p.depense }[tri];
    return liste.sort((a, b) => cle(b) - cle(a));
  }, [d, recherche, tri]);

  const visibles = produits.slice(0, 5);
  const totalRayons = d ? d.parRayon.reduce((s, r) => s + r.total, 0) : 0;
  const totalMagasins = d ? d.parMagasin.reduce((s, m) => s + m.total, 0) : 0;
  const inflationPoints = d ? d.inflation.filter((p) => p.indice !== null) : [];
  // Sans au moins deux mois, pas de courbe : le bloc Inflation disparaît et Les prix prend sa place.
  const avecCourbe = inflationPoints.length >= 2;
  const franceNationale = d && (franceTout ? d.inflationNationaleEnsemble : d.inflationNationale);
  // Échelle en euros de la courbe : courses alimentaires, ou toutes les courses quand la France suit tous les prix.
  const panier = d && (franceTout ? d.panierMensuelTout ?? d.panierMensuel : d.panierMensuel);
  const controlesPrix = (id) => (
    <>
      <input type="search" className="prix__recherche" placeholder="Rechercher un aliment…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      <div className="prix__tri">
        <CustomSelect id={id} value={tri} options={TRIS.map((t) => ({ value: t.valeur, label: t.texte }))} onChange={setTri} ariaLabel="Trier" />
      </div>
    </>
  );
  const sectionPrix = d && (
          <section className="carte prix" data-flip="prix">
            <div className="prix__entete">
              <h2>Les prix</h2>
              {controlesPrix("triPrix")}
            </div>
            <ul className="prix__liste">
              {visibles.map((p, i) => <LignePrix key={p.id} p={p} i={i} euros={euros} signe={signe} onOuvrir={setProduit} />)}
            </ul>
            {produits.length === 0 && <p className="vide">Aucun produit pour cette recherche.</p>}
            {produits.length > visibles.length && (
              <button type="button" className="lien" onClick={() => setListeOuverte(true)}>Voir les {produits.length} produits →</button>
            )}
          </section>
  );

  return (
    <Page titre="Stats" etat={lecture.etat}>
      {d && (
        <main className="stats" ref={page}>
          <header className="stats__entete">
            <h1>Dépenses</h1>
            <div className="stats__filtres">
              <SelecteurPeriode periode={periode} onChange={setPeriode} dernierAchat={d.dernierAchat} premierAchat={d.premierAchat} />
              <SelecteurMagasin enseigne={enseigne} onChange={setEnseigne} />
            </div>
            <button type="button" className="stats__tickets" aria-label="Tickets" title="Tickets" onClick={() => setTicketsOuverts(true)} />
          </header>

          <section className="stats__kpis">
            <article className="carte kpi kpi--large" data-flip="kpi-depense">
              <Filigrane type="depense" />
              <div>
                <p className="kpi__libelle">{titreDepense(periode)}</p>
                <p className="kpi__valeur"><NombreAnime valeur={d.kpi.depense} format={euros} /></p>
                {d.kpi.variation != null && <p className={"kpi__detail" + sens(d.kpi.variation)}>{signe(d.kpi.variation)} % {comparaison(periode)}</p>}
              </div>
              <div className="kpi__mini" aria-hidden="true">
                {d.barres.seaux.slice(-12).map((s) => (
                  <span key={s.debut} className={s.debut === d.barres.enCours ? "dernier" : undefined} style={{ height: `${(s.total / Math.max(...d.barres.seaux.map((x) => x.total), 1)) * 100}%` }} />
                ))}
              </div>
            </article>
            <article className="carte kpi" data-flip="kpi-semaine">
              <Filigrane type="semaine" />
              <div>
                <p className="kpi__libelle">Par semaine</p>
                {d.kpi.ecartSemaine != null && <p className={"kpi__detail" + sens(d.kpi.ecartSemaine)}>{signe(Math.round(d.kpi.ecartSemaine))} € {comparaison(periode)}</p>}
              </div>
              <MiniCourbe valeurs={d.kpi.serieSemaines || []} hausse={d.kpi.ecartSemaine} className="kpi__courbe" />
              <p className="kpi__valeur"><NombreAnime valeur={d.kpi.parSemaine} format={euros} /></p>
            </article>
            <article className="carte kpi" data-flip="kpi-inflation">
              <Filigrane type="inflation" />
              <div>
                <p className="kpi__libelle">Inflation</p>
                <p className="kpi__detail">{{ "12mois": "vs 12 mois", "annee-glissante": "sur 12 mois" }[d.kpi.inflationRef] || "panier"}</p>
              </div>
              <MiniCourbe valeurs={d.kpi.serieInflation || []} hausse={d.kpi.inflation} className="kpi__courbe" />
              <InfoBulle classeBouton="kpi__bouton" titre="Ce qui fait bouger l’inflation" bouton={<span className={"kpi__valeur" + (d.kpi.inflation > 0 ? " hausse" : d.kpi.inflation < 0 ? " baisse" : "")}>
                {d.kpi.inflation === null ? "—" : <NombreAnime valeur={d.kpi.inflation} format={(v) => signe(Math.round(v * 10) / 10) + " %"} />}
              </span>}>
                <Mouvements detail={d.detailInflation} euros={euros} signe={signe} />
              </InfoBulle>
            </article>
          </section>

          {enseigne === "tous" && d.parMagasin.length > 0 && (
            <section className="carte magasin-bande" data-flip="magasins">
              <h2>Par magasin</h2>
              <div className="pile">
                {d.parMagasin.map((m, i) => (
                  <span key={m.nom} style={{ width: `${(m.total / totalMagasins) * 100}%`, background: COULEURS_RAYONS[i] }} />
                ))}
              </div>
              <p className="legende">
                {d.parMagasin.map((m, i) => (
                  <span key={m.nom}><i style={{ background: COULEURS_RAYONS[i] }} />{m.nom} {Math.round((m.total / totalMagasins) * 100)} %</span>
                ))}
              </p>
            </section>
          )}

          <div className="stats__grille">
            {avecCourbe ? (
            <section className="carte inflation" data-flip="inflation">
              <div className="titre-info">
                <h2>Inflation</h2>
                <InfoBulle classeBouton="info-bouton" bouton="ⓘ" titre="Comment l’inflation est calculée">
                  <b>Ce que montre la courbe</b>
                  <span>Les aliments de Chow achetés au moins deux mois de la période (vin, ménage et « Autres » exclus), au prix au kg ou au litre quand il est connu, sinon à la pièce.</span>
                  <span>Chaque mois, le prix de chaque aliment est comparé à son premier prix de la période ; la courbe suit la moyenne de ces écarts, chaque aliment pesant autant.</span>
                  <span>L’axe traduit cet écart en euros : ce que coûterait un mois de courses habituel aux prix du mois ({euros(d.panierMensuel)} d’alimentation, {euros(d.panierMensuelTout)} avec le ménage et l’hygiène).</span>
                  <span>Avec un magasin choisi, seuls ses tickets comptent.</span>
                </InfoBulle>
                {d.inflationNationaleEnsemble && (
                  <span className="bascule-france" role="group" aria-label="Ligne France">
                    <button type="button" className={!franceTout ? "actif" : undefined} aria-pressed={!franceTout} aria-label="Alimentation" title="France : prix de l’alimentation" onClick={() => setFranceTout(false)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 9h14l-1.2 10.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z" />
                        <path d="M9 9l3-5 3 5" />
                      </svg>
                    </button>
                    <button type="button" className={franceTout ? "actif" : undefined} aria-pressed={franceTout} aria-label="Tout" title="France : tous les prix (alimentation, énergie, services…)" onClick={() => setFranceTout(true)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="4" y="4" width="7" height="7" rx="1.5" />
                        <rect x="13" y="4" width="7" height="7" rx="1.5" />
                        <rect x="4" y="13" width="7" height="7" rx="1.5" />
                        <rect x="13" y="13" width="7" height="7" rx="1.5" />
                      </svg>
                    </button>
                  </span>
                )}
              </div>
              <p className="discret">Un mois de courses habituel, aux prix de chaque mois · {d.detailInflation.nbProduits} produits suivis</p>
              <>
                  <Courbe key={libellePeriode(periode) + enseigne} id="inflation" graduations depuisZero={axeDepuisZero} onDoubleClic={() => setAxeDepuisZero((z) => !z)}
                    formatAxe={(v) => euros((panier * v) / 100)}
                    format={(v) => `${euros((panier * v) / 100)} (${signe(Math.round((v - 100) * 10) / 10)} %)`}
                    points={inflationPoints.map((p) => ({ ...p, valeur: p.indice, national: franceTout ? p.nationalEnsemble : p.national, titre: titreMois(p.mois) }))} />
                  <div className="inflation__legende">
                    <InfoBulle classeBouton={"puce " + (d.kpi.inflation > 0 ? "puce--hausse" : "puce--baisse")} titre="Ce qui fait bouger l’inflation"
                      bouton={<><i className="trait" /> Foyer {signe(d.kpi.inflation)} % ⓘ</>}>
                      <Mouvements detail={d.detailInflation} euros={euros} signe={signe} />
                    </InfoBulle>
                    {franceNationale && (
                      <InfoBulle classeBouton="puce puce--france" titre="Ligne France"
                        bouton={<><i className="trait trait--pointille" /> 🇫🇷 {signe(franceNationale.variation)} % ⓘ</>}>
                        <ComparaisonFrance points={inflationPoints.map((p) => ({ ...p, national: franceTout ? p.nationalEnsemble : p.national }))} panier={panier}
                          jusqua={franceNationale.jusqua} titreMois={titreMois} euros={euros} signe={signe} ensemble={franceTout} />
                      </InfoBulle>
                    )}
                  </div>
              </>
            </section>
            ) : (
              sectionPrix
            )}

            <div className="stats__colonne">
              {estimation && estimation.articles > 0 && (
                <Link to="/courses" className="carte courses-estimation" data-flip="courses">
                  <span className="courses-estimation__icone" aria-hidden="true">
                    🛒<b>{estimation.articles}</b>
                  </span>
                  <span className="courses-estimation__texte">
                    <span className="discret">Prochaines courses</span>
                    <strong>{euros(estimation.bas)} – {euros(estimation.haut)}</strong>
                  </span>
                  <span className="chevron" aria-hidden="true">›</span>
                </Link>
              )}
              <section className="carte rayons" data-flip="rayons">
                <h2>Par rayon</h2>
                <div className="rayons__corps">
                  <Anneau parts={d.parRayon} centre={<NombreAnime valeur={totalRayons} format={euros} />} survol={rayonSurvole} onSurvol={setRayonSurvole} />
                  <ul className="legende legende--liste" onMouseLeave={() => setRayonSurvole(null)}>
                    {d.parRayon.map((r, i) => (
                      <li key={r.nom} className={rayonSurvole === i ? "survole" : rayonSurvole !== null ? "estompe" : undefined} onMouseEnter={() => setRayonSurvole(i)}><i style={{ background: couleurRayon(r.nom, i) }} /><span>{r.nom}</span><b>{Math.round((r.total / (totalRayons || 1)) * 100)} %</b></li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>
          </div>

          {avecCourbe && sectionPrix}

          <section className="carte depenses" data-flip="depenses">
            <h2>Dépenses</h2>
            <Barres {...d.barres} seaux={d.barres.seaux.map((s) => ({ ...s, titre: titreSeau(s, d.barres.pas) }))} euros={euros} />
            {d.semaineMax && (
              <div className="semaine-max">
                <p><span className="fleche" aria-hidden="true">↑</span> Sem. du {new Date(d.semaineMax.debut + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} <b>{euros(d.semaineMax.total)}</b></p>
                <div className="semaine-max__causes">
                  <svg className="semaine-max__icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="a fait monter">
                    <path d="M3 17l6-6 4 4 8-8" />
                    <path d="M15 7h6v6" />
                  </svg>
                  {d.semaineMax.causes.map((c) =>
                    c.semaine != null ? (
                      <InfoBulle key={c.nom} classeBouton="puce puce--hausse cause" titre={c.nom} bouton={<>{c.nom} +{euros(c.ecart)}</>}>
                        <b>{c.nom}</b>
                        <span>{euros(c.semaine)} cette semaine</span>
                        <span className="discret">{euros(c.moyenne)} en moyenne ({libellePeriode(periode)}) · {euros(c.semaineAvant ?? 0)} la semaine d’avant</span>
                      </InfoBulle>
                    ) : (
                      <span key={c.nom} className="puce puce--hausse cause">{c.nom} +{euros(c.ecart)}</span>
                    )
                  )}
                </div>
              </div>
            )}
          </section>

          {listeOuverte && (
            <ListeProduits produits={produits} controles={controlesPrix("triPrixTous")} euros={euros} signe={signe}
              ficheOuverte={!!produit} onOuvrir={setProduit} onFermer={fermerListe} />
          )}
          {produit && <FicheProduit idAliment={produit} periode={periode} enseigne={enseigne} euros={euros} onFermer={fermerFiche} />}
          {ticketsOuverts && (
            <FeuilleTickets periodeInitiale={periode.periode === "mois" ? "mois" : "semaine"}
              refInitiale={periode.periode === "semaine" || periode.periode === "mois" ? periode.ref : d.dernierAchat}
              enseigneInitiale={enseigne} euros={euros} onFermer={fermerTickets} />
          )}
        </main>
      )}
    </Page>
  );
}

