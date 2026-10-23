import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { IconeParametres } from "./Header.jsx";
import "./Footer.css";

export default function Footer() {
  const { utilisateur } = useAuth();
  return (
    <footer className="footer">
      <div className="footer__inner">
        <p className="footer__marque">
          <span className="footer__logo">Chow</span>
          <span>Fait maison 🏠</span>
        </p>
        {utilisateur?.admin && (
          <Link to="/parametres" className="footer__parametres">
            <IconeParametres />
            Paramètres
          </Link>
        )}
      </div>
    </footer>
  );
}
