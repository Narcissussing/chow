import "./BoutonFermer.css";

// Le ✕ de toutes les fenêtres et feuilles : même taille, même icône, toujours en haut à droite de l'en-tête.
export default function BoutonFermer({ onClick, className = "" }) {
  return <button type="button" className={"bouton-fermer " + className} aria-label="Fermer" title="Fermer" onClick={onClick} />;
}
