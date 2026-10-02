import { useEffect, useRef, useState } from "react";
import BoutonEffacer from "../../components/BoutonEffacer.jsx";
import { useClicExterieur } from "../../hooks/useClicExterieur.js";
import { normaliserTexte } from "../../utils/texte.js";

// Panneau accordéon, toujours dernier enfant de #listeCourses (le CSS en dépend).
export default function PanneauAjout({ ref, ouvert, pret, onPret, champ, aliments, onChoisir, onAjouterTexte }) {
  const zone = useRef(null);
  const [texte, setTexte] = useState("");
  const [listeVisible, setListeVisible] = useState(false);

  // Fermer le panneau vide son contenu (texte tapé, liste, bouton "Ajouter").
  useEffect(() => {
    if (ouvert) return;
    setTexte("");
    setListeVisible(false);
  }, [ouvert]);

  useClicExterieur([zone], () => setListeVisible(false));

  const termes = normaliserTexte(texte.toLowerCase());
  const suggestions = aliments.map((a) => ({ ...a, visible: normaliserTexte(`${a.emoji} ${a.nom}`.toLowerCase()).includes(termes) }));
  const aUneCorrespondance = suggestions.some((s) => s.visible);

  // Entrée ajoute toujours en texte libre : le champ caché idAliment n'est jamais rempli (§3.2-1).
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
        // "pret" : overflow visible une fois ouvert, pour que les suggestions dépassent sous le panneau.
        if (e.propertyName === "grid-template-rows" && ouvert) onPret();
      }}
    >
      <div className="panneau-ajout__piege">
        <div className="panneau-ajout__interieur">
          <form action="/courses/ajouter" method="post" id="formAjouterCourse" onSubmit={(e) => e.preventDefault()}>
            <input type="hidden" name="idAliment" id="idAlimentCacheCourses" value="" />

            <div id="autocompleteCourses" ref={zone}>
              <div className="champ-recherche-wrapper">
                <input
                  ref={champ}
                  type="text"
                  id="rechercheAlimentCourses"
                  name="rechercheAliment"
                  placeholder="Recherche un article..."
                  autoComplete="off"
                  className={termes !== "" && !aUneCorrespondance ? "recherche-invalide" : undefined}
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
              </div>
              <ul id="listeAlimentsCourses" hidden={!listeVisible}>
                {suggestions.map((s) => (
                  <li key={s.id} hidden={!s.visible} onClick={() => onChoisir(s)}>
                    {s.emoji} {s.nom}
                  </li>
                ))}
              </ul>
            </div>
            {/* N'apparaît que si le texte tapé ne correspond à aucun aliment connu. */}
            <button type="button" id="btnAjouterCourse" className={termes === "" || aUneCorrespondance ? "hidden" : undefined} onClick={tenterAjout}>
              Ajouter
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
