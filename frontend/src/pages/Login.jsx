import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Page from "../components/Page.jsx";
import { useAuth } from "../context/AuthContext.jsx";

// Q3 : seulement un chemin interne ("/stock"), jamais "//autre-site.com".
function cheminRetour(valeur) {
  return valeur && valeur.startsWith("/") && !valeur.startsWith("//") ? valeur : "/";
}

export default function Login() {
  const { connecter } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [panne, setPanne] = useState(false);
  const retour = cheminRetour(params.get("retour"));

  async function soumettre(event) {
    event.preventDefault();
    let statut = null;
    try {
      statut = await connecter(email, password);
    } catch {
      // Réseau coupé : traité comme une panne, jamais comme un mauvais mot de passe.
    }
    if (statut === 200) {
      navigate(retour);
    } else if (statut === 401) {
      navigate("/login?erreur=1" + (retour !== "/" ? "&retour=" + encodeURIComponent(retour) : ""));
    } else {
      setPanne(true);
    }
  }

  if (panne) return <Page titre="Connexion" etat="erreur" />;

  return (
    <Page titre="Connexion">
      <main>
        <div className="page-header">
          <h1>Content de te <span>revoir.</span></h1>
          <p className="page-header__description">Connecte-toi pour accéder à Chow.</p>

          {params.get("erreur") === "1" && <p className="erreur">Email ou mot de passe incorrect.</p>}
        </div>

        <div className="login-carte">
          <form action="/login" method="post" className="login-form" onSubmit={soumettre}>
            <label htmlFor="email">Email</label>
            <input type="email" name="email" id="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />

            <label htmlFor="password">Mot de passe</label>
            <input type="password" name="password" id="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />

            <button type="submit" className="btn-connexion">Se connecter</button>
          </form>
        </div>
      </main>
    </Page>
  );
}
