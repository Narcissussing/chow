import { relancerClasse } from "../utils/animation.js";

// Bouton icône seul, même rond que les boutons recettes de la Cuisine : « cuisiner » (envoyer à la Cuisine) ou « regle » (envoyer dans RègleX).
const LABELS = {
  cuisiner: "Ajouter à la Cuisine",
  regle: "Adapter dans RègleX",
};

export default function BoutonOutil({ icone, disabled, onClick }) {
  return (
    <button
      type="button"
      className={"btn-outil btn-outil--" + icone}
      title={LABELS[icone]}
      aria-label={LABELS[icone]}
      disabled={disabled}
      onClick={(e) => {
        relancerClasse(e.currentTarget, "btn-outil--tape");
        onClick?.(e);
      }}
    >
      <span className="btn-outil__icone" aria-hidden="true"></span>
    </button>
  );
}
