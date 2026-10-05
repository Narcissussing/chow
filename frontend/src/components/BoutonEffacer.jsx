import "./BoutonEffacer.css";

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
