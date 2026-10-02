import { Link } from "react-router-dom";
import Page from "../components/Page.jsx";

const CARTES = [
  { chemin: "/aliments", emoji: "🥗", titre: "Aliments", description: "Tous les aliments et leurs infos nutritionnelles" },
  { chemin: "/stock", emoji: "📦", titre: "Stock", description: "Ce que j'ai à la maison" },
  { chemin: "/courses", emoji: "🛒", titre: "Courses", description: "Ce que je dois acheter" },
  { chemin: "/calories", emoji: "🔥", titre: "Calories", description: "Suis tes calories et macros du jour" },
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
            {CARTES.map(({ chemin, emoji, titre, description }) => (
              <Link key={chemin} to={chemin} className="home-link-card">
                <span className="home-link-emoji">{emoji}</span>
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
