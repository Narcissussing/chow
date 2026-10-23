import { Link } from "react-router-dom";
import Page from "../../components/Page.jsx";
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

// Stats n'a pas encore de page : sa carte affiche le chiffre sans lien.
function cartes(r) {
  return [
    {
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
  const { etat, donnees } = usePageData("/accueil");
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
        </section>
      </main>
    </Page>
  );
}
