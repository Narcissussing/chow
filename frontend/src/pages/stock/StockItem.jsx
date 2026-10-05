import { useEffect, useRef } from "react";
import CustomSelect from "../../components/CustomSelect.jsx";
import { OPTIONS_CL, classeNiveauCL, estQuantiteBasse, texteEmplacement, texteJours } from "../../utils/stock.js";

function AffichageStatique({ item }) {
  const fondu = item.effets.fondu ? " anim-fondu" : "";
  if (item.tracking_type === "cl") {
    return (
      <div className={"stock-barre-cl" + fondu} title={item.quantite}>
        <div className={"stock-barre-cl-remplissage " + classeNiveauCL(item.quantite)}></div>
      </div>
    );
  }
  return <span className={"stock-quantite" + fondu}>{item.quantite}</span>;
}

export function boutonCoursesVisible(item) {
  return estQuantiteBasse(item.quantite, item.tracking_type) && !item.dejaEnCourses;
}

function BoutonAjouterCourses({ item, onAjouterCourses }) {
  if (!item.effets.coursesVisible) return null;
  return (
    <button
      type="button"
      className={"btn-ajouter-courses" + (item.effets.coursesSortant ? " disparait" : "")}
      title="Ajouter aux courses"
      disabled={item.effets.coursesEnvoi}
      onClick={(e) => {
        e.stopPropagation();
        onAjouterCourses();
      }}
    />
  );
}

function Edition({ item, valeur, setValeur, onSoustraire, onAjouterCourses }) {
  const champ = useRef(null);

  useEffect(() => {
    champ.current?.focus();
    champ.current?.select();
  }, []);

  if (item.tracking_type === "cl") {
    return (
      <>
        <CustomSelect className="stock-cl-edit anim-fondu" value={valeur} options={OPTIONS_CL} onChange={setValeur} />
        <BoutonAjouterCourses item={item} onAjouterCourses={onAjouterCourses} />
      </>
    );
  }

  const actuel = Number(item.quantite);
  const soustractions = actuel ? [1, 2, 5].filter((v) => v <= actuel) : [];

  return (
    <>
      <div className="stock-edition-ligne">
        <input
          ref={champ}
          type="number"
          className="stock-quantite-edit anim-fondu"
          value={valeur}
          min="0"
          step="1"
          onChange={(e) => setValeur(e.target.value)}
        />
        <BoutonAjouterCourses item={item} onAjouterCourses={onAjouterCourses} />
      </div>
      {soustractions.length > 0 && (
        <div className="stock-quick-subtract">
          {soustractions.map((v) => (
            <button
              key={v}
              type="button"
              className="suggestion"
              onClick={(e) => {
                e.stopPropagation();
                onSoustraire(v);
              }}
            >
              <span className="signe-mini">−</span>
              {v}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export default function StockItem({ item, visible, edition, setValeurEdition, onCarteClic, onSoustraire, onAjouterCourses, onSupprimer, onFinEntree, ref }) {
  const { effets } = item;
  const enEdition = Boolean(edition);
  const classes = ["stock-item", "carte-article"];
  if (!visible) classes.push("hidden");
  if (enEdition) classes.push("en-edition");
  if (effets.entree) classes.push("entree");
  if (effets.miseEnAvant) classes.push("mise-en-avant");
  if (effets.majFlash) classes.push("maj-flash");
  if (effets.disparait) classes.push("disparait");

  return (
    <div
      ref={ref}
      className={classes.join(" ")}
      onClick={onCarteClic}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && effets.entree) onFinEntree();
      }}
    >
      {item.image ? <img src={"/" + item.image} alt={item.nom} className="stock-item__img" /> : <div className="stock-item__emoji">{item.emoji}</div>}

      <div className="stock-item__body">
        <div className="stock-item__infos">
          <div className="stock-item__ligne stock-item__ligne--nom">
            <span className="stock-nom">{item.nom}</span>
          </div>
          <div className="stock-item__ligne stock-item__ligne--meta">
            <span className="stock-emplacement">{texteEmplacement(item.emplacement)}</span>
            <span className="stock-separateur">|</span>
            <span className="stock-jours">{texteJours(Number(item.jours_depuis))}</span>
          </div>
        </div>

        <div className={"stock-editable-zone" + (enEdition && !edition.enAttente && item.tracking_type !== "cl" ? " stock-edition-colonne" : "")}>
          {enEdition ? (
            <Edition item={item} valeur={edition.valeur} setValeur={setValeurEdition} onSoustraire={onSoustraire} onAjouterCourses={onAjouterCourses} />
          ) : (
            <AffichageStatique item={item} />
          )}
        </div>
      </div>

      <form
        className="form-supprimer-stock"
        onSubmit={(e) => {
          e.preventDefault();
          onSupprimer();
        }}
      >
        <button type="submit" className="btn-supprimer-icone btn-supprimer-dash">Supprimer</button>
      </form>
    </div>
  );
}
