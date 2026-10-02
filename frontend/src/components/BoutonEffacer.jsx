// Bouton ✕ des recherches (visible sur mobile seulement, via le CSS) : vide le champ et lui rend le focus.
export default function BoutonEffacer({ cible, valeur, onEffacer, champ }) {
  return (
    <button
      type="button"
      className={"btn-effacer-recherche" + (valeur.length > 0 ? " visible" : "")}
      data-cible={cible}
      aria-label="Effacer la recherche"
      onClick={() => {
        onEffacer();
        champ.current?.focus();
      }}
    />
  );
}
