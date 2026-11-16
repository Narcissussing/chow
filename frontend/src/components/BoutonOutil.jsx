import { relancerClasse } from "../utils/animation.js";
import "./BoutonOutil.css";

const LABELS = {
  cuisiner: "Ajouter à la Cuisine",
  regle: "Adapter dans RègleX",
  courses: "Ajouter aux Courses (ponctuel)",
};

export default function BoutonOutil({ icone, actif, disabled, onClick }) {
  return (
    <button
      type="button"
      className={"btn-outil btn-outil--" + icone + (actif ? " actif" : "")}
      aria-pressed={actif === undefined ? undefined : actif}
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
