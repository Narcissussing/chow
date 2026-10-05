import { Link } from "react-router-dom";
import Page from "../../components/Page.jsx";
import "./Accueil.css";

const ICONES = {
  aliments: (
    <>
      <path d="M12 7.2c-1.6-1.2-4.6-1.5-6.1.5-1.8 2.4-1.2 6.6.8 9.6 1.4 2.1 3 3.4 4.2 2.8.5-.3.8-.3 1.1-.3s.6 0 1.1.3c1.2.6 2.8-.7 4.2-2.8 2-3 2.6-7.2.8-9.6-1.5-2-4.5-1.7-6.1-.5z" fill="currentColor" fillOpacity="0.12" />
      <path d="M12 7.2c0-2 .6-3.4 1.9-4.4" />
      <path d="M12.7 5.4c1.7-.1 3.3-1.1 3.9-2.9-1.8-.1-3.4 1-3.9 2.9z" fill="currentColor" fillOpacity="0.35" />
      <path d="M7.6 10.4c-.5.9-.6 2-.3 3.1" />
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
  calories: (
    <>
      <path d="M12 21.2c-3.6 0-6.5-2.6-6.5-6.2 0-2.6 1.4-4.4 2.9-6 .3 1.6 1.2 2.7 2.3 3.1-.3-3.4 1.2-6.4 3.8-8.9.2 3 1.6 4.8 3.1 6.6 1.1 1.4 1.9 3 1.9 5.2 0 3.6-2.9 6.2-6.5 6.2z" fill="currentColor" fillOpacity="0.12" />
      <path d="M12 21.2c-1.7 0-2.9-1.2-2.9-2.8 0-1.6 1.1-2.7 2.2-3.8.2 1 .8 1.6 1.5 1.8.5-.9.6-1.9.4-2.9 1.3 1 2.6 2.5 2.6 4.6 0 1.8-1.3 3.1-3.8 3.1z" fill="currentColor" fillOpacity="0.35" />
    </>
  ),
};

const CARTES = [
  { chemin: "/aliments", icone: "aliments", titre: "Aliments", description: "Tous les aliments et leurs infos nutritionnelles" },
  { chemin: "/stock", icone: "stock", titre: "Stock", description: "Ce que j'ai à la maison" },
  { chemin: "/courses", icone: "courses", titre: "Courses", description: "Ce que je dois acheter" },
  { chemin: "/calories", icone: "calories", titre: "Calories", description: "Suis tes calories et macros du jour" },
];

export default function Accueil() {
  return (
    <Page titre="Accueil">
      <main>
        <section className="hero">
          <div className="hero__text">
            <h1>Bienvenue sur <span>Chow</span></h1>
            <p>Ton hub alimentaire maison.</p>
          </div>
        </section>

        <section className="grid-section">
          <div className="home-links">
            {CARTES.map(({ chemin, icone, titre, description }) => (
              <Link key={chemin} to={chemin} className="home-link-card">
                <svg className="home-link-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {ICONES[icone]}
                </svg>
                <span className="home-link-title">{titre}</span>
                <span className="home-link-desc">{description}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </Page>
  );
}
