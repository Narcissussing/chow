import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../api.js";
import BoutonFermer from "../../components/BoutonFermer.jsx";
import IconeFamille from "../../components/IconeFamille.jsx";
import SelecteurMagasin from "../../components/SelecteurMagasin.jsx";
import { useVerrouDefilement } from "../../hooks/useVerrouDefilement.js";
import { useFermetureAnimee } from "../../hooks/useFermetureAnimee.js";
import { useGlisserPourFermer } from "../../hooks/useGlisserPourFermer.js";
import { useClicExterieur } from "../../hooks/useClicExterieur.js";
import { CalendrierPlage } from "./Filtres.jsx";
import { NombreAnime } from "./animations.js";
import FeuillePlan from "./FeuillePlan.jsx";
import "./FeuilleTickets.css";

const NIVEAUX = {
  1: { titre: "À arrêter", classe: "niveau--1" },
  2: { titre: "Desserts", classe: "niveau--2" },
  3: { titre: "Moins cher", classe: "niveau--3" },
};
const PERIODES = [
  { valeur: "jour", texte: "Jour" },
  { valeur: "semaine", texte: "Semaine" },
  { valeur: "mois", texte: "Mois" },
];
// Liste par paliers : 10 lignes, puis 10, 20 et 30 de plus à chaque toucher (30 ensuite).
const AJOUTS = [10, 20, 30];
export const lignesMontrees = (touches) => 10 + Array.from({ length: touches }, (_, k) => AJOUTS[Math.min(k, AJOUTS.length - 1)]).reduce((s, n) => s + n, 0);

const date = (s) => new Date(s + "T00:00:00");
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const jourCourt = (s) => date(s).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

export function libelleTickets(periode, debut, fin) {
  if (periode === "mois") return date(debut).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const dernier = date(fin);
  dernier.setDate(dernier.getDate() - 1);
  if (periode === "jour" || iso(dernier) === debut) return jourCourt(debut);
  const memeMois = debut.slice(0, 7) === iso(dernier).slice(0, 7);
  return `${date(debut).toLocaleDateString("fr-FR", memeMois ? { day: "numeric" } : { day: "numeric", month: "short" })} – ${dernier.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
}

// Date des Tickets, comme celle des Stats : flèches, libellé blanc ; un toucher ouvre le calendrier (un jour = deux
// touchers sur le même jour, sinon une plage), qui remplace jour, semaine ou mois.
function PeriodeTickets({ d, filtres, precedent, suivant, onChange }) {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef(null);
  const zones = useMemo(() => [zone], []);
  const [ferme, fermer] = useFermetureAnimee(useCallback(() => setOuvert(false), []), 180);
  useClicExterieur(zones, fermer, ouvert);
  const choisies = filtres.periode === "dates";
  return (
    <div className="periode tickets__date" ref={zone}>
      <button type="button" className="periode__fleche" aria-label="Période précédente" hidden={!precedent} onClick={() => onChange({ ref: precedent })}>‹</button>
      <button type="button" className="periode__choix" aria-haspopup="dialog" aria-expanded={ouvert} onClick={() => (ouvert ? fermer() : setOuvert(true))}>
        <span className="periode__libelle">{libelleTickets(filtres.periode, d.debut, d.fin)}</span>
      </button>
      <button type="button" className="periode__fleche" aria-label="Période suivante" hidden={!suivant} onClick={() => onChange({ ref: suivant })}>›</button>
      {ouvert && (
        <CalendrierPlage debut={choisies ? filtres.debut : null} fin={choisies ? filtres.fin : null} min={d.premierAchat} max={iso(new Date())} ferme={ferme}
          onAppliquer={(plage) => { onChange({ periode: "dates", debut: plage.debut, fin: plage.fin, ref: plage.debut }); fermer(); }} />
      )}
    </div>
  );
}

// Période voisine : le jour d'achat d'avant ou d'après, sinon la semaine ou le mois d'à côté.
function voisine(d, periode, sens) {
  if (periode === "jour") return sens < 0 ? d.precedent : d.suivant;
  if (sens < 0 && !d.precedent) return null;
  if (sens > 0 && !d.suivant) return null;
  const r = date(d.debut);
  if (periode === "semaine") r.setDate(r.getDate() + 7 * sens);
  else r.setMonth(r.getMonth() + sens, 1);
  return iso(r);
}

// ⓘ des niveaux : comment ça marche, en deux lignes, dans une bulle qui se referme comme elle s'est ouverte.
function AideNiveaux() {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef(null);
  const zones = useMemo(() => [zone], []);
  const [ferme, fermer] = useFermetureAnimee(useCallback(() => setOuvert(false), []), 180);
  useClicExterieur(zones, fermer, ouvert);
  return (
    <span className="niveaux__aide" ref={zone}>
      <button type="button" aria-label="Comment ça marche" aria-expanded={ouvert} onClick={() => (ouvert ? fermer() : setOuvert(true))}>i</button>
      {ouvert && (
        <span className={"niveaux__bulle" + (ferme ? " ferme" : "")} role="tooltip">
          Toucher un niveau ouvre sa liste : ✓ compte un article cette fois, ✕ le sort du niveau pour de bon.
          Le rond à droite retire tout le niveau du total.
        </span>
      )}
    </span>
  );
}

function Tuile({ article }) {
  if (article.emoji) return <span className="tickets__tuile" aria-hidden="true">{article.emoji}</span>;
  return <span className="tickets__tuile">{article.racine && article.racine !== "alimentation" ? <IconeFamille famille={article.racine} /> : <span aria-hidden="true">🍽️</span>}</span>;
}

function LigneArticle({ a, i, retire, euros }) {
  const detail = a.niveau === 3 && a.alternative
    ? `${a.quantite} · ${euros(a.alternative.prix, 2)} / ${a.alternative.unite} chez ${a.alternative.enseigne}`
    : a.quantite;
  return (
    <li className={"tickets__ligne" + (retire ? " retire" : "")} style={{ "--i": i }}>
      <Tuile article={a} />
      <span className="tickets__nom"><b className="nom-defile">{a.nom}</b><span className="discret nom-defile">{detail}</span></span>
      {a.niveau && <span className={"tickets__pastille " + NIVEAUX[a.niveau].classe} title={NIVEAUX[a.niveau].titre}>{a.niveau}</span>}
      <span className="tickets__valeur">
        <b>{euros(a.depense, 2)}</b>
        {retire && a.niveau === 3 && <span className="tickets__gain">−{euros(a.economie, 2)}</span>}
      </span>
    </li>
  );
}

// Quand la période, le magasin ou l'onglet change, l'ancienne liste s'efface avant que la nouvelle arrive en cascade.
function ListeParPaliers({ elements, rendu, cle }) {
  const [affiche, setAffiche] = useState({ cle, elements, rendu, touches: 0 });
  const [sortie, setSortie] = useState(false);
  // Le nombre animé redessine la feuille à chaque image : le dernier rendu est lu au moment de l'échange.
  const dernierRendu = useRef(rendu);
  dernierRendu.current = rendu;
  useEffect(() => {
    if (cle === affiche.cle) {
      if (elements !== affiche.elements) setAffiche((a) => ({ ...a, elements }));
      return;
    }
    setSortie(true);
    const minuteur = setTimeout(() => { setAffiche({ cle, elements, rendu: dernierRendu.current, touches: 0 }); setSortie(false); }, 180);
    return () => clearTimeout(minuteur);
  }, [cle, elements, affiche.cle, affiche.elements]);
  const montres = lignesMontrees(affiche.touches);
  const suivant = lignesMontrees(affiche.touches + 1);
  // L'ancienne liste garde sa façon de se dessiner pendant qu'elle s'efface.
  const dessiner = cle === affiche.cle ? rendu : affiche.rendu;
  return (
    <div className={"tickets__bloc" + (sortie ? " sortie" : "")} key={String(affiche.cle)}>
      <ul className="tickets__liste">{affiche.elements.slice(0, montres).map(dessiner)}</ul>
      {affiche.elements.length > montres && (
        <button type="button" className="tickets__plus" onClick={() => setAffiche((a) => ({ ...a, touches: a.touches + 1 }))}>
          Voir {Math.min(suivant - montres, affiche.elements.length - montres)} de plus
          <span className="discret">{montres} / {affiche.elements.length}</span>
        </button>
      )}
    </div>
  );
}

// Tickets de la période : total en haut, boutons d'économie par niveau, puis les articles ou les passages en caisse.
export default function FeuilleTickets({ periodeInitiale, refInitiale, enseigneInitiale, euros, onFermer }) {
  const zone = useRef(null);
  const [ferme, fermer] = useFermetureAnimee(onFermer);
  const [filtres, setFiltres] = useState({ periode: periodeInitiale, ref: refInitiale, enseigne: enseigneInitiale });
  const [lecture, setLecture] = useState({ etat: "chargement", d: null });
  const [actifs, setActifs] = useState(() => new Set());
  // Articles qu'on garde malgré leur niveau coché : décochés dans le détail du niveau.
  const [gardes, setGardes] = useState(() => new Set());
  // Niveaux dont la liste est ouverte, et articles qui sortent d'une liste (le temps de leur animation).
  const [deplies, setDeplies] = useState(() => new Set());
  const [retraits, setRetraits] = useState(() => new Set());
  const [onglet, setOnglet] = useState("articles");
  const [ticket, setTicket] = useState(null);
  const [planOuvert, setPlanOuvert] = useState(false);
  // Mon plan s'ouvre par-dessus : c'est lui qui bloque alors le défilement et répond à Échap.
  useVerrouDefilement(!planOuvert, zone);
  useGlisserPourFermer(zone, fermer, !planOuvert);

  useEffect(() => {
    if (planOuvert) return;
    const echap = (e) => e.key === "Escape" && (ticket ? setTicket(null) : fermer());
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [ticket, fermer, planOuvert]);

  useEffect(() => {
    const controleur = new AbortController();
    const params = new URLSearchParams({ periode: filtres.periode, enseigne: filtres.enseigne });
    if (filtres.ref) params.set("ref", filtres.ref);
    if (filtres.periode === "dates") { params.set("debut", filtres.debut); params.set("fin", filtres.fin); }
    api("/stats/tickets?" + params, { signal: controleur.signal })
      .then(({ statut, donnees }) => setLecture(statut === 200 ? { etat: "pret", d: donnees } : (l) => ({ ...l, etat: "erreur" })))
      .catch((err) => { if (err.type !== "annulation" && err.type !== "session") setLecture((l) => ({ ...l, etat: "erreur" })); });
    return () => controleur.abort();
  }, [filtres]);

  const d = lecture.d;
  const basculer = (n) => setActifs((s) => { const t = new Set(s); t.has(n) ? t.delete(n) : t.add(n); return t; });
  const retire = (a) => !!a.niveau && actifs.has(a.niveau) && !gardes.has(a.id);
  const gagne = (articles) => articles.reduce((s, a) => s + (retire(a) ? a.economie : 0), 0);
  const deplier = (n) => setDeplies((s) => { const t = new Set(s); t.has(n) ? t.delete(n) : t.add(n); return t; });
  // Mettre un article dans un niveau ou l'en sortir, pour toujours : la liste est relue ensuite.
  function changerNiveau(id, niveau) {
    if (niveau === null) setRetraits((r) => new Set(r).add(id));
    api("/articles/" + encodeURIComponent(id) + "/a-reduire", { method: "POST", body: { niveau } })
      .then(() => setTimeout(() => { setFiltres((f) => ({ ...f })); setRetraits(new Set()); }, niveau === null ? 260 : 0))
      .catch(() => setRetraits(new Set()));
  }
  const garder = (id) => setGardes((g) => { const t = new Set(g); t.has(id) ? t.delete(id) : t.add(id); return t; });
  const economie = d ? gagne(d.articles) : 0;
  const ouvert = ticket && d?.tickets.find((t) => t.id === ticket);
  const precedent = d && voisine(d, filtres.periode, -1), suivant = d && voisine(d, filtres.periode, 1);
  const economieTicket = (t) => gagne(t.articles);

  return createPortal(
    <>
    <div className={"fiche-fond fiche-fond--liste" + (ferme ? " ferme" : "")} onClick={fermer}>
      <aside ref={zone} className={"fiche fiche--liste tickets" + (ferme ? " ferme" : "")} role="dialog" aria-modal="true" aria-label="Tickets" onClick={(e) => e.stopPropagation()}>
        <span className="fiche__poignee poignee-feuille" aria-hidden="true" />
        <header className="tickets__entete" data-entete-feuille>
          {ouvert && <button type="button" className="tickets__retour" aria-label="Retour aux tickets" onClick={() => setTicket(null)} />}
          <span className="tickets__icone" aria-hidden="true" />
          <span className="tickets__titre">
            <h2>{ouvert ? ouvert.enseigne : "Tickets"}</h2>
            <span className="discret">
              {ouvert ? `${jourCourt(ouvert.jour)} · ${ouvert.nbArticles} articles` : d ? `${d.tickets.length} ticket${d.tickets.length > 1 ? "s" : ""} · ${d.nbArticles} articles` : " "}
            </span>
          </span>
          <BoutonFermer onClick={fermer} />
        </header>

        <div className="tickets__defile">
          {!ouvert && (
            <div className="tickets__filtres">
              <div className="segmente" role="group" aria-label="Période">
                {PERIODES.map((p) => (
                  <button key={p.valeur} type="button" className={filtres.periode === p.valeur ? "actif" : undefined} aria-pressed={filtres.periode === p.valeur}
                    onClick={() => setFiltres((f) => ({ ...f, periode: p.valeur, ref: f.periode === "dates" ? f.debut : f.ref }))}>{p.texte}</button>
                ))}
              </div>
              {d && <PeriodeTickets d={d} filtres={filtres} precedent={precedent} suivant={suivant} onChange={(c) => setFiltres((f) => ({ ...f, ...c }))} />}
              <SelecteurMagasin enseigne={filtres.enseigne} onChange={(e) => setFiltres((f) => ({ ...f, enseigne: e }))} />
              <button type="button" className="tickets__lien-plan" onClick={() => setPlanOuvert(true)}>Mon plan →</button>
            </div>
          )}

          {lecture.etat === "erreur" && !d && <p className="vide">Tickets indisponibles pour le moment.</p>}

          {d && !ouvert && (
            <>
              <div className="tickets__total">
                <b><NombreAnime valeur={d.total - economie} format={(n) => euros(n, 2)} /></b>
                {economie > 0 && <s className="discret">{euros(d.total, 2)}</s>}
                {economie > 0 && <span className="tickets__badge">−{euros(economie, 2)}</span>}
              </div>

              <div className="tickets__niveaux">
                <div className="niveaux__entete">
                  <h3>Économiser</h3>
                  <AideNiveaux />
                </div>
                {d.niveaux.map((n) => {
                  const actif = actifs.has(n.niveau);
                  const deplie = deplies.has(n.niveau);
                  const concernes = d.articles.filter((a) => a.niveau === n.niveau);
                  const valeur = actif ? gagne(concernes) : n.economie;
                  const modifiable = n.niveau !== 3;
                  return (
                    <div key={n.niveau} className={"niveau-bloc " + NIVEAUX[n.niveau].classe + (deplie ? " ouvert" : "")}>
                      <div className={"niveau " + NIVEAUX[n.niveau].classe + (actif ? " actif" : "")}>
                        <button type="button" className="niveau__ouvrir" aria-expanded={deplie} aria-label={"Voir la liste " + NIVEAUX[n.niveau].titre}
                          onClick={() => deplier(n.niveau)}>
                          <span className="niveau__numero">{n.niveau}</span>
                          <span className="niveau__texte">
                            <b>{NIVEAUX[n.niveau].titre}</b>
                            <span className="discret nom-defile">{concernes.length ? `${concernes.length} article${concernes.length > 1 ? "s" : ""} · ${n.noms.slice(0, 2).join(", ")}` : "Rien cette fois"}</span>
                          </span>
                          <span className="niveau__valeur">
                            <b>−{euros(valeur, 2)}</b>
                            <span className="discret">{euros(n.parAn)} / an</span>
                          </span>
                          <span className="niveau__fleche" aria-hidden="true" />
                        </button>
                        <button type="button" className="niveau__coche" aria-pressed={actif} disabled={!n.economie}
                          aria-label={(actif ? "Remettre " : "Retirer du total ") + NIVEAUX[n.niveau].titre} title={actif ? "Remettre dans le total" : "Retirer du total"}
                          onClick={() => basculer(n.niveau)} />
                      </div>
                      {/* Toujours là pour pouvoir se replier en douceur : la liste du niveau, article par article. */}
                      <div className="niveau__detail" aria-hidden={!deplie}>
                        <div>
                          <ul aria-label={"Liste " + NIVEAUX[n.niveau].titre}>
                            {concernes.map((a) => {
                              const garde = gardes.has(a.id);
                              const detail = n.niveau === 3 && a.alternative
                                ? `${euros(a.alternative.prix, 2)} / ${a.alternative.unite} chez ${a.alternative.enseigne}`
                                : `${a.quantite} · ${euros(a.depense, 2)}`;
                              return (
                                <li key={a.id} className={(garde ? "garde" : "") + (retraits.has(a.id) ? " sort" : "")}>
                                  <Tuile article={a} />
                                  <span className="tickets__nom"><b className="nom-defile">{a.nom}</b><span className="discret nom-defile">{detail}</span></span>
                                  <b className="niveau__retire">−{euros(a.economie, 2)}</b>
                                  <button type="button" className="niveau__case" tabIndex={deplie ? 0 : -1} aria-pressed={!garde}
                                    aria-label={(garde ? "Compter " : "Ne pas compter ") + a.nom} title={garde ? "Compter cette fois" : "Ne pas compter cette fois"} onClick={() => garder(a.id)} />
                                  {modifiable && (
                                    <button type="button" className="niveau__sortir" tabIndex={deplie ? 0 : -1} aria-label={"Sortir " + a.nom + " de " + NIVEAUX[n.niveau].titre}
                                      title={"Sortir de « " + NIVEAUX[n.niveau].titre + " »"} onClick={() => changerNiveau(a.id, null)} />
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                          <button type="button" className="tickets__lien-plan" tabIndex={deplie ? 0 : -1} onClick={() => setPlanOuvert(true)}>Moins au lieu de tout retirer ? Mon plan →</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="segmente" role="group" aria-label="Afficher">
                {[["articles", "Articles"], ["tickets", "Tickets"]].map(([v, t]) => (
                  <button key={v} type="button" className={onglet === v ? "actif" : undefined} aria-pressed={onglet === v} onClick={() => setOnglet(v)}>{t}</button>
                ))}
              </div>

              {d.tickets.length === 0 && <p className="vide">Aucun ticket sur cette période.</p>}
            </>
          )}

          {ouvert && (
            <div className="tickets__total">
              <b><NombreAnime valeur={ouvert.paye - economieTicket(ouvert)} format={(n) => euros(n, 2)} /></b>
              {economieTicket(ouvert) > 0 && <s className="discret">{euros(ouvert.paye, 2)}</s>}
            </div>
          )}

          {d && (
            <ListeParPaliers
              cle={ouvert ? "ticket-" + ouvert.id : onglet + JSON.stringify(filtres)}
              elements={ouvert ? ouvert.articles : onglet === "articles" ? d.articles : d.tickets}
              rendu={ouvert || onglet === "articles"
                ? (a, i) => <LigneArticle key={a.id} a={a} i={i % 10} retire={retire(a)} euros={euros} />
                : (t, i) => {
                  const gain = economieTicket(t);
                  return (
                    <li key={t.id} className="tickets__ligne tickets__ligne--ticket" style={{ "--i": i % 10 }}>
                      <button type="button" disabled={!t.detaille} onClick={() => setTicket(t.id)}>
                        <img className="tickets__logo" src={`/magasins/${t.enseigne === "Marché Frais" ? "marche-frais" : t.enseigne.toLowerCase()}.png`} alt="" />
                        <span className="tickets__nom"><b className="nom-defile">{t.enseigne}</b><span className="discret nom-defile">{jourCourt(t.jour)} · {t.detaille ? `${t.nbArticles} articles` : "montant seul"}</span></span>
                        <span className="tickets__valeur"><b>{euros(t.paye, 2)}</b>{gain > 0 && <span className="tickets__gain">−{euros(gain, 2)}</span>}</span>
                      </button>
                    </li>
                  );
                }} />
          )}
        </div>
      </aside>
    </div>
    {/* Hors du fond des Tickets : un toucher sur le fond du plan ne ferme que le plan. Les choix changent les
        suggestions « moins cher » : les tickets sont relus en le fermant. */}
    {planOuvert && <FeuillePlan euros={euros} onFermer={() => { setPlanOuvert(false); setFiltres((f) => ({ ...f })); }} />}
    </>,
    document.body
  );
}
