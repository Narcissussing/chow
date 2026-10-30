import "./IconeFamille.css";

// Icône d'une famille d'achats non alimentaires (public/images/categories), teintée à la couleur de sa famille.
export default function IconeFamille({ famille }) {
  return <span className={"icone-famille icone-famille--" + famille} style={{ "--icone": `url("/images/categories/${famille}.svg")` }} aria-hidden="true" />;
}
