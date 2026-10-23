import { Link } from "react-router-dom";
import { api } from "../../api.js";
import Page from "../../components/Page.jsx";
import { afficherToast } from "../../toast.js";
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

export default function Accueil() {
  const { etat, donnees, majDonnees } = usePageData("/accueil");

  // « Toujours là » remet la date à aujourd'hui, « Fini » vide l'article : il sort de la liste dans les deux cas.
  function verifier(article, fini) {
    api("/stock/verifier", { method: "POST", body: { idStock: article.id, fini } })
      .then(({ donnees: reponse }) => {
        if (!reponse?.succes) return afficherToast(reponse?.erreur || "Une erreur est survenue.");
        majDonnees((d) => ({
          ...d,
          aVerifier: d.aVerifier.filter((a) => a.id !== article.id),
          stock_a_verifier: d.stock_a_verifier - 1,
          stock: fini ? d.stock - 1 : d.stock,
        }));
      })
      .catch(() => afficherToast("Une erreur est survenue."));
  }
  return (
    <Page titre="Accueil" etat={etat}>
      <main>
        <section className="hero">
          <div className="hero__text">
            <h1>Bonjour</h1>
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
                  <Link key={icone} to={chemin} className="home-link-card">{contenu}</Link>
                ) : (
                  <div key={icone} className="home-link-card">{contenu}</div>
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
                    {donnees.aVerifier.map((a) => (
                      <li key={a.id}>
                        <span aria-hidden="true">{a.emoji}</span>
                        <span className="accueil-verifier__nom">
                          {a.nom}
                          <span className="accueil-verifier__jours">{Math.round(a.jours / 7)} sem.</span>
                        </span>
                        <button type="button" className="accueil-verifier__oui" aria-label={`${a.nom} : toujours là`} onClick={() => verifier(a, false)}>✓</button>
                        <button type="button" className="accueil-verifier__fini" onClick={() => verifier(a, true)}>Fini</button>
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
