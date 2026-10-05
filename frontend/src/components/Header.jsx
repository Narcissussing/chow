import { Link, useLocation } from "react-router-dom";

const LIENS = [
  { chemin: "/aliments", texte: "Aliments" },
  { chemin: "/stock", texte: "Stock" },
  { chemin: "/courses", texte: "Courses" },
  { chemin: "/calories", texte: "Calories" },
];

export default function Header({ ref }) {
  const { pathname } = useLocation();
  return (
    <header className="header" ref={ref}>
      <div className="header__inner">
        <Link to="/" className="logo">Chow</Link>
        <nav className="nav">
          {LIENS.map(({ chemin, texte }) => (
            <Link key={chemin} to={chemin} className={"nav__link" + (pathname.startsWith(chemin) ? " actif" : "")}>
              {texte}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
