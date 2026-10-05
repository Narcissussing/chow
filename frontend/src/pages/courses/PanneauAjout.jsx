import { useEffect, useRef, useState } from "react";
import BoutonEffacer from "../../components/BoutonEffacer.jsx";
import { useClicExterieur } from "../../hooks/useClicExterieur.js";
import { normaliserTexte } from "../../utils/texte.js";
import "./PanneauAjout.css";

export default function PanneauAjout({ ref, ouvert, pret, onPret, champ, aliments, onChoisir, onAjouterTexte }) {
  const zone = useRef(null);
  const [texte, setTexte] = useState("");
  const [listeVisible, setListeVisible] = useState(false);

  useEffect(() => {
    if (ouvert) return;
    setTexte("");
    setListeVisible(false);
  }, [ouvert]);

  useClicExterieur([zone], () => setListeVisible(false));

  const termes = normaliserTexte(texte.toLowerCase());
  const suggestions = aliments.map((a) => ({ ...a, visible: normaliserTexte(`${a.emoji} ${a.nom}`.toLowerCase()).includes(termes) }));
  const aUneCorrespondance = suggestions.some((s) => s.visible);
  const nouveau = termes !== "" && !aUneCorrespondance;

  function tenterAjout() {
    const libre = texte.trim();
    if (libre === "") return;
    onAjouterTexte(libre);
  }

  return (
    <div
      ref={ref}
      id="panneauAjoutCourse"
      className={"panneau-ajout" + (ouvert ? " ouvert" : "") + (pret ? " pret" : "")}
      onTransitionEnd={(e) => {
        if (e.propertyName === "grid-template-rows" && ouvert) onPret();
      }}
    >
      <div className="panneau-ajout__piege">
        <div className="panneau-ajout__interieur">
          <form id="formAjouterCourse" onSubmit={(e) => e.preventDefault()}>

            <div id="autocompleteCourses" ref={zone}>
              <div className={"champ-recherche-wrapper" + (nouveau ? " nouveau" : "")}>
                <input
                  ref={champ}
                  type="text"
                  id="rechercheAlimentCourses"
                  name="rechercheAliment"
                  placeholder="Recherche un article..."
                  autoComplete="off"
                  value={texte}
                  onChange={(e) => {
                    setTexte(e.target.value);
                    setListeVisible(normaliserTexte(e.target.value.toLowerCase()) !== "");
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    tenterAjout();
                  }}
                />
                <BoutonEffacer
                  cible="rechercheAlimentCourses"
                  valeur={texte}
                  onEffacer={() => {
                    setTexte("");
                    setListeVisible(false);
                  }}
                  champ={champ}
                />
                <span className="panneau-ajout__new" aria-hidden="true">
                  New
                </span>
                <button type="button" id="btnAjouterCourse" className="panneau-ajout__plus" aria-label="Ajouter comme nouvel article" tabIndex={nouveau ? 0 : -1} onClick={tenterAjout}>
                  +
                </button>
              </div>
              <ul id="listeAlimentsCourses" hidden={!listeVisible || nouveau}>
                {suggestions.map((s) => (
                  <li key={s.id} hidden={!s.visible} onClick={() => onChoisir(s)}>
                    {s.emoji} {s.nom}
                  </li>
                ))}
              </ul>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
