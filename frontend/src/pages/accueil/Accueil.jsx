import { Link } from "react-router-dom";
import { api } from "../../api.js";
import Page from "../../components/Page.jsx";
import { afficherToast } from "../../toast.js";
import { OPTIONS_CL, classeNiveauCL } from "../../utils/stock.js";
import "../stock/StockItem.css";
import { useState } from "react";
import { usePageData } from "../../hooks/usePageData.js";
import "./Accueil.css";

const ICONES = {
  stats: (
    <>
      <rect x="4" y="12" width="3.5" height="8" rx="1" fill="currentColor" fillOpacity="0.35" />
      <rect x="10.25" y="7" width="3.5" height="13" rx="1" fill="currentColor" fillOpacity="0.12" />
      <rect x="16.5" y="3.5" width="3.5" height="16.5" rx="1" fill="currentColor" fillOpacity="0.12" />
      <path d="M4 20h16" />
    </>
  ),
  stock: (
    <>
      <rect x="6" y="2.8" width="12" height="3.2" rx="1" fill="currentColor" fillOpacity="0.35" />
      <path d="M7 6v1.6C5.8 8.4 5 9.7 5 11.2V18a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6.8c0-1.5-.8-2.8-2-3.6V6" fill="currentColor" fillOpacity="0.12" />
      <rect x="8" y="12" width="8" height="5" rx="1" />
      <path d="M10 14.5h4" />
    </>
  ),
  courses: (
    <>
      <path d="M5 8.5h14l-1.1 11.2a1.6 1.6 0 0 1-1.6 1.5H7.7a1.6 1.6 0 0 1-1.6-1.5z" fill="currentColor" fillOpacity="0.12" />
      <path d="M9 11V7a3 3 0 0 1 6 0v4" />
      <path d="M9 15.5c1.8 1.3 4.2 1.3 6 0" />
    </>
  ),
};

const euros = (n) => Math.round(n).toLocaleString("fr-FR") + " €";

function cartes(r) {
  return [
    {
      chemin: "/stats",
      icone: "stats",
      titre: "Stats",
      valeur: euros(r.depense_mois),
      detail: "en " + new Date().toLocaleDateString("fr-FR", { month: "long" }),
      petits: [euros(r.depense_semaine) + " cette semaine", euros(r.depense_mois_dernier) + " le mois dernier"],
    },
    {
      chemin: "/stock",
      icone: "stock",
      titre: "Stock",
      valeur: r.stock,
      detail: r.stock_a_verifier ? `à la maison · ${r.stock_a_verifier} à vérifier` : "aliments à la maison",
    },
    {
      chemin: "/courses",
      icone: "courses",
      titre: "Courses",
      valeur: r.courses,
      detail: r.courses ? `à acheter · ≈ ${euros(r.estimation.estimation)}` : "rien à acheter",
    },
  ];
}

// Même unité que la page Stock : packs ou unités au singulier/pluriel ; niveau pour les contenants.
const UNITES = { pack: ["pack", "packs"], unite: ["unité", "unités"] };
const libelleUnite = (a, n) => {
  const [un, plusieurs] = UNITES[a.tracking_type] || [a.unite || "", a.unite || ""];
  return Number(n) > 1 ? plusieurs : un;
};

// Quantité affichée comme dans Stock ; rien tant que le serveur ne l'envoie pas (jamais « undefined »).
function Quantite({ article }) {
  if (article.quantite == null) return null;
  if (article.tracking_type === "cl") {
    return (
      <span className="stock-barre-cl accueil-niveau" title={OPTIONS_CL.find((o) => o.value === article.quantite)?.label}>
        <span className={"stock-barre-cl-remplissage " + classeNiveauCL(article.quantite)} />
      </span>
    );
  }
  return <span>{article.quantite} {libelleUnite(article, article.quantite)}</span>;
}

const Icone = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

// Modification rapide de la quantité restante : +/− pour un nombre, quatre niveaux pour un contenant.
function EditeurQuantite({ article, onValider, onAnnuler }) {
  const [valeur, setValeur] = useState(article.quantite);
  if (article.tracking_type === "cl") {
    return (
      <span className="accueil-editeur" role="group" aria-label={`Niveau de ${article.nom}`}>
        {OPTIONS_CL.map((o) => (
          <button key={o.value} type="button" className={o.value === article.quantite ? "actif" : undefined} onClick={() => onValider(o.value)}>
            {o.label}
          </button>
        ))}
        <button type="button" className="accueil-editeur__annuler" aria-label="Annuler" onClick={onAnnuler}>✕</button>
      </span>
    );
  }
  const nombre = Math.max(0, Number(valeur) || 0);
  return (
    <span className="accueil-editeur" role="group" aria-label={`Quantité de ${article.nom}`}>
      <button type="button" aria-label="Moins" onClick={() => setValeur(String(Math.max(0, nombre - 1)))}>−</button>
      <span className="accueil-editeur__valeur">{nombre} <small>{libelleUnite(article, nombre)}</small></span>
      <button type="button" aria-label="Plus" onClick={() => setValeur(String(nombre + 1))}>+</button>
      <button type="button" className="accueil-verifier__oui" aria-label="Enregistrer" onClick={() => onValider(String(nombre))}>
        <Icone d="M5 12.5l4.5 4.5L19 7.5" />
      </button>
      <button type="button" className="accueil-editeur__annuler" aria-label="Annuler" onClick={onAnnuler}>✕</button>
    </span>
  );
}

// Salutation selon l'heure : bonjour de 5 h à 18 h, bonsoir le reste du temps.
export function salutation(heure) {
  return heure >= 5 && heure < 18 ? "Bonjour" : "Bonsoir";
}

export default function Accueil() {
  const { etat, donnees, majDonnees } = usePageData("/accueil");
  const [enEdition, setEnEdition] = useState(null);
  const [sorties, setSorties] = useState({});

  // La ligne joue sa sortie pendant l'appel au serveur, puis quitte la liste ; en cas d'erreur elle revient.
  function sortir(article, sens, appel) {
    setSorties((s) => ({ ...s, [article.id]: sens }));
    const fin = () => setSorties(({ [article.id]: _, ...s }) => s);
    Promise.all([appel, new Promise((r) => setTimeout(r, 650))])
      .then(([{ donnees: reponse }]) => {
        if (!reponse?.succes) {
          fin();
          return afficherToast(reponse?.erreur || "Une erreur est survenue.");
        }
        retirer(article, sens === "fini");
        fin();
      })
      .catch(() => {
        fin();
        afficherToast("Une erreur est survenue.");
      });
  }

  // L'article sort tout de suite, puis l'accueil est relu en arrière-plan : l'article suivant à vérifier
  // remonte dans la liste et les compteurs sont ceux du serveur.
  function retirer(article, vide) {
    majDonnees((d) => ({
      ...d,
      aVerifier: d.aVerifier.filter((a) => a.id !== article.id),
      stock_a_verifier: d.stock_a_verifier - 1,
      stock: vide ? d.stock - 1 : d.stock,
    }));
    api("/accueil")
      .then(({ statut, donnees: frais }) => {
        if (statut === 200 && frais) majDonnees(frais);
      })
      .catch(() => {});
  }

  // Nouvelle quantité : enregistrée comme dans Stock (la date repart d'aujourd'hui), l'article sort de la liste.
  function modifierQuantite(article, nouvelleQuantite) {
    setEnEdition(null);
    sortir(article, nouvelleQuantite === "0" || nouvelleQuantite === "vide" ? "fini" : "garde",
      api("/stock/modifier", { method: "POST", body: { idStock: article.id, nouvelleQuantite } }));
  }

  // « Toujours là » remet la date à aujourd'hui, « Fini » vide l'article : il sort de la liste dans les deux cas.
  function verifier(article, fini) {
    sortir(article, fini ? "fini" : "garde", api("/stock/verifier", { method: "POST", body: { idStock: article.id, fini } }));
  }
  return (
    <Page titre="Accueil" etat={etat}>
      <main>
        <section className="hero">
          <div className="hero__text">
            <h1>{salutation(new Date().getHours())}</h1>
          </div>
        </section>

        <section className="grid-section">
          <div className="home-links">
            {donnees &&
              cartes(donnees).map(({ chemin, icone, titre, valeur, detail, petits }) => {
                const contenu = (
                  <>
                    <span className={"home-link-tuile home-link-tuile--" + icone}>
                      <svg className="home-link-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        {ICONES[icone]}
                      </svg>
                    </span>
                    <span className="home-link-texte">
                      <span className="home-link-title">{titre}</span>
                      <span className="home-link-desc">{detail}</span>
                    </span>
                    <span className="home-link-chiffres">
                      <span className="home-link-valeur">{valeur}</span>
                      {petits?.map((p) => <span key={p} className="home-link-petit">{p}</span>)}
                    </span>
                  </>
                );
                return chemin ? (
                  <Link key={icone} to={chemin} className={"home-link-card home-link-card--" + icone}>{contenu}</Link>
                ) : (
                  <div key={icone} className={"home-link-card home-link-card--" + icone}>{contenu}</div>
                );
              })}
          </div>

          {donnees && (
            <div className="accueil-blocs">
              <Link to="/stats" className="accueil-bloc">
                <span className="accueil-bloc__titre">8 dernières semaines</span>
                <div className="accueil-semaines">
                  {donnees.semaines.map((s, i) => (
                    <span key={s.debut} className="accueil-semaine" title={euros(s.total)}>
                      <span className="accueil-semaine__montant">{s.total ? euros(s.total) : ""}</span>
                      <span
                        className={"accueil-semaine__barre" + (i === donnees.semaines.length - 1 ? " actuelle" : "")}
                        style={{ height: `${(s.total / Math.max(...donnees.semaines.map((x) => x.total), 1)) * 100}%` }}
                      />
                      <span className="accueil-semaine__date">{new Date(s.debut + "T00:00:00").getDate()}</span>
                    </span>
                  ))}
                </div>
              </Link>
              {donnees.stock_a_verifier > 0 && (
                <section className="accueil-bloc">
                  <span className="accueil-bloc__titre">Encore à la maison ?</span>
                  <ul className="accueil-verifier">
                    {donnees.aVerifier.map((a, i) => (
                      <li
                        key={a.id}
                        className={[enEdition === a.id && "en-edition carte-active", sorties[a.id] && "sortie-" + sorties[a.id]].filter(Boolean).join(" ") || undefined}
                        style={{ "--i": i }}
                        inert={sorties[a.id] ? true : undefined}
                      >
                        <span className="accueil-verifier__emoji" aria-hidden="true">{a.emoji}</span>
                        <span className="accueil-verifier__nom">
                          <b className="nom-defile">{a.nom}</b>
                          <span className="accueil-verifier__jours">il y a {Math.round(a.jours / 7)} sem.</span>
                        </span>
                        {enEdition === a.id ? (
                          <EditeurQuantite article={a} onValider={(q) => modifierQuantite(a, q)} onAnnuler={() => setEnEdition(null)} />
                        ) : (
                          <>
                            <button type="button" className="accueil-verifier__quantite" aria-label={`Modifier la quantité de ${a.nom}`} title="Modifier la quantité" onClick={() => setEnEdition(a.id)}>
                              <Quantite article={a} />
                              <Icone d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />
                            </button>
                            <button type="button" className="accueil-verifier__oui" aria-label={`${a.nom} : toujours là`} title="Toujours là" onClick={() => verifier(a, false)}>
                              <Icone d="M5 12.5l4.5 4.5L19 7.5" />
                            </button>
                            <button type="button" className="accueil-verifier__fini" aria-label={`${a.nom} : fini`} title="Fini" onClick={() => verifier(a, true)}>
                              <Icone d="M7 7l10 10M17 7L7 17" />
                            </button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  {donnees.stock_a_verifier > donnees.aVerifier.length && (
                    <Link to="/stock?filtre=verifier" className="accueil-bloc__lien">
                      {donnees.aVerifier.length ? `Les ${donnees.stock_a_verifier - donnees.aVerifier.length} autres` : `Voir les ${donnees.stock_a_verifier}`} dans Stock →
                    </Link>
                  )}
                </section>
              )}
            </div>
          )}
        </section>
      </main>
    </Page>
  );
}
