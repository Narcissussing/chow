import "./SelecteurMagasin.css";

// Les trois enseignes du foyer, avec leur logo : filtre des Stats et magasin du mode magasin des Courses.
export const ENSEIGNES = [
  { nom: "Leclerc", logo: "/magasins/leclerc.png" },
  { nom: "Carrefour", logo: "/magasins/carrefour.png" },
  { nom: "Marché Frais", logo: "/magasins/marche-frais.png" },
];

export default function SelecteurMagasin({ enseigne, onChange }) {
  return (
    <div className="magasins" role="group" aria-label="Magasin">
      <button type="button" className={enseigne === "tous" ? "actif" : undefined} aria-pressed={enseigne === "tous"} aria-label="Tous les magasins" onClick={() => onChange("tous")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 9.5 4.5 4h15L21 9.5M3 9.5h18M3 9.5c0 1.4 1.1 2.5 2.5 2.5S8 10.9 8 9.5c0 1.4 1.1 2.5 2.5 2.5h3c1.4 0 2.5-1.1 2.5-2.5 0 1.4 1.1 2.5 2.5 2.5S21 10.9 21 9.5M5 12v8h14v-8M10 20v-5h4v5" />
        </svg>
      </button>
      {ENSEIGNES.map((e) => (
        <button key={e.nom} type="button" className={enseigne === e.nom ? "actif" : undefined} aria-pressed={enseigne === e.nom} aria-label={e.nom} onClick={() => onChange(e.nom)}>
          <img src={e.logo} alt="" />
        </button>
      ))}
    </div>
  );
}
