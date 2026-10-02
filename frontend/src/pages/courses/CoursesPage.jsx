import { useEffect, useLayoutEffect, useRef, useState } from "react";
import CustomSelect from "../../components/CustomSelect.jsx";
import Page from "../../components/Page.jsx";
import { useBodyClass } from "../../hooks/useBodyClass.js";
import { useClicExterieur } from "../../hooks/useClicExterieur.js";
import { useLocalStorage } from "../../hooks/useLocalStorage.js";
import { useMinuteurs } from "../../hooks/useMinuteurs.js";
import { usePageData } from "../../hooks/usePageData.js";
import { afficherToast } from "../../toast.js";
import { relancerClasse } from "../../utils/animation.js";
import CourseItem, { jouerPopPanier } from "./CourseItem.jsx";
import PanneauAjout from "./PanneauAjout.jsx";
import PhotoApercu from "./PhotoApercu.jsx";
import {
  cleArticlePreset,
  compresserImage,
  lirePhotoLocale,
  sauvegarderPhotoLocale,
  supprimerPhotoLocale,
  synchroniserPhotosLocales,
} from "./photos.js";
import { fetchAvecRetry, gererErreurReseau } from "./reseau.js";

const OPTIONS_TRI = [
  { value: "nom", label: "Nom" },
  { value: "categorie", label: "Catégorie" },
];

const libelleCategorie = (categorie) => (categorie === "zzz" ? "Autres" : categorie);
const categorieDe = (item) => item.categorie || "zzz";
const cleTri = (item, cle) => (cle === "nom" ? item.nom.toLowerCase() : categorieDe(item));
const mouvementReduit = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Tri stable par clé seule, comme trierPar (courses.js).
function trier(items, cle) {
  return [...items].sort((a, b) => cleTri(a, cle).localeCompare(cleTri(b, cle)));
}

// Insère avant le premier article dont la clé est plus grande, sinon en fin (inserrerSelonTri).
function inserer(items, nouvel, cle) {
  const index = items.findIndex((i) => cleTri(i, cle).localeCompare(cleTri(nouvel, cle)) > 0);
  if (index === -1) return [...items, nouvel];
  return [...items.slice(0, index), nouvel, ...items.slice(index)];
}

function preparer(ligne) {
  return { ...ligne, aPhoto: ligne.has_photo === true, effets: {} };
}

// Liste du serveur fusionnée dans l'écran : cartes gardées (place, animations), données et Stock à jour,
// nouveautés insérées selon le tri, disparues sorties en animation. locaux = articles de l'action faite ici.
export function fusionnerListe(liste, lignes, cle, locaux = []) {
  const serveur = new Map(lignes.map((l) => [l.id, l]));
  const connus = new Set(liste.map((i) => i.id));
  let suivants = liste.map((item) => {
    if (item.effets.sortie) return item;
    const ligne = serveur.get(item.id);
    if (!ligne) return { ...item, effets: { ...item.effets, sortie: "disparait-achete" } };
    return { ...item, ...ligne, aPhoto: ligne.has_photo === true };
  });
  const nouveaux = lignes.filter((l) => !connus.has(l.id));
  nouveaux.forEach((ligne) => {
    suivants = inserer(suivants, { ...preparer(ligne), effets: { entree: true, miseEnAvant: !locaux.includes(ligne.id) } }, cle);
  });
  return {
    items: suivants,
    nouveaux: nouveaux.filter((l) => !locaux.includes(l.id)),
    retires: liste.filter((i) => !i.effets.sortie && !locaux.includes(i.id) && !serveur.has(i.id)).map((i) => i.id),
  };
}

function Courses({ donnees }) {
  const planifier = useMinuteurs();
  const hero = useRef(null);
  const barreOutils = useRef(null);
  const badge = useRef(null);
  const nombreBadge = useRef(null);
  const avantDeplacement = useRef(null);
  const panneau = useRef(null);
  const champAjout = useRef(null);
  const boutonAjout = useRef(null);
  const inputPhoto = useRef(null);
  const apercu = useRef(null);
  const cartes = useRef({});
  const paniers = useRef({});
  const boutonsPhoto = useRef({});
  const idPhotoActuelle = useRef(null);
  const ajoutEnCours = useRef(false);
  const typeAnimationBadge = useRef("achat");
  const nombrePrecedent = useRef(null);
  const badgeEnBarreActuel = useRef(false);

  const [cle, setCle] = useState("nom");
  const [items, setItems] = useState(() => trier(donnees.courses.map(preparer), "nom"));
  const [magasin, setMagasin] = useLocalStorage("modeMagasin", (v) => v === "true");
  const [puces, setPuces] = useState(() => [...new Set(donnees.courses.map(categorieDe))].sort());
  const [actives, setActives] = useState(() => new Set(donnees.courses.map(categorieDe)));
  const [armeId, setArmeId] = useState(null);
  const [panneauEtat, setPanneauEtat] = useState({ ouvert: false, pret: false });
  const [preset, setPreset] = useState(donnees.presetHebdo);
  const [presetConfirme, setPresetConfirme] = useState(false);
  const [badgeEnBarre, setBadgeEnBarre] = useState(false);
  const [tailleBadge, setTailleBadge] = useState(34);
  const [photo, setPhoto] = useState({ ouvert: false, src: null, fermeture: false, vers: null });
  const [aAmenerEnVue, setAAmenerEnVue] = useState(null);
  const [popPhoto, setPopPhoto] = useState(null);

  useBodyClass("mode-magasin", magasin);

  // Réponses d'ajout/achat numérotées : une réponse plus ancienne que la dernière appliquée est ignorée.
  const itemsActuels = useRef(items);
  itemsActuels.current = items;
  const sequence = useRef(0);
  const derniereAppliquee = useRef(0);

  function appliquerListe(lignes, numero, locaux = []) {
    if (!Array.isArray(lignes) || numero < derniereAppliquee.current) return;
    derniereAppliquee.current = numero;
    const { nouveaux, retires } = fusionnerListe(itemsActuels.current, lignes, cle, locaux);
    setItems((liste) => fusionnerListe(liste, lignes, cle, locaux).items);
    if (nouveaux.length > 0) {
      afficherToast(nouveaux.length === 1 ? `Ajouté entre-temps : ${nouveaux[0].nom}` : `${nouveaux.length} articles ajoutés entre-temps`);
      planifier(() => nouveaux.forEach((n) => majEffets(n.id, { miseEnAvant: false })), 1500);
    }
    if (retires.length > 0) {
      retires.forEach(supprimerPhotoLocale);
      if (retires.map(String).includes(armeId)) setArmeId(null);
      planifier(() => setItems((liste) => liste.filter((i) => !retires.includes(i.id))), 300);
    }
  }

  function majEffets(id, effets) {
    setItems((liste) => liste.map((i) => (i.id === id ? { ...i, effets: { ...i.effets, ...effets } } : i)));
  }

  useEffect(() => {
    synchroniserPhotosLocales(donnees.courses.filter((c) => c.has_photo).map((c) => c.id));
  }, [donnees]);

  // Note : affichage déjà mis à jour par la carte ; la réponse apporte la liste à jour.
  function enregistrerNote(item, commentaire) {
    const numero = ++sequence.current;
    fetchAvecRetry("/courses/commentaire", { body: { idCourse: String(item.id), commentaire } })
      .then((reponse) => appliquerListe(reponse.courses, numero, [item.id]))
      .catch(gererErreurReseau);
  }

  // ---------- Badge : nombre, animation, navette hero <-> barre d'outils ----------

  useEffect(() => {
    const nombre = items.length;
    if (nombrePrecedent.current !== null && nombrePrecedent.current !== nombre) {
      nombreBadge.current?.classList.remove("badge-pop", "badge-shake");
      relancerClasse(nombreBadge.current, typeAnimationBadge.current === "suppression" ? "badge-shake" : "badge-pop");
    }
    nombrePrecedent.current = nombre;
    typeAnimationBadge.current = "achat";
  }, [items.length]);

  useEffect(() => {
    if (!("IntersectionObserver" in window) || !hero.current || !barreOutils.current) return;
    // rootMargin = zone cachée derrière header + barre sticky : le badge ne bouge qu'une fois le hero vraiment hors champ.
    const hauteurHeader = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 65;
    const decalage = hauteurHeader + barreOutils.current.offsetHeight;
    const observateur = new IntersectionObserver(
      (entrees) => {
        const versBarre = !entrees[0].isIntersecting;
        if (badgeEnBarreActuel.current === versBarre) return;
        badgeEnBarreActuel.current = versBarre;
        // Mesuré avant le déplacement : point de départ du glissement FLIP.
        avantDeplacement.current = badge.current?.getBoundingClientRect() ?? null;
        // Taille imposée pour matcher le bouton "Trier par", mesurée en direct.
        if (versBarre) setTailleBadge(document.querySelector(".sort-wrapper .custom-select__button")?.offsetHeight || 34);
        setBadgeEnBarre(versBarre);
      },
      { rootMargin: `-${decalage}px 0px 0px 0px`, threshold: 0 }
    );
    observateur.observe(hero.current);
    return () => observateur.disconnect();
  }, []);

  // FLIP : le badge part de son ancienne position et glisse vers la nouvelle.
  useLayoutEffect(() => {
    const avant = avantDeplacement.current;
    avantDeplacement.current = null;
    const element = badge.current;
    if (!avant || !element || mouvementReduit()) return;
    const apres = element.getBoundingClientRect();
    element.style.transition = "none";
    element.style.transform = `translate(${avant.left - apres.left}px, ${avant.top - apres.top}px) scale(${avant.width / apres.width}, ${avant.height / apres.height})`;
    void element.offsetWidth;
    element.style.transition = "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
    element.style.transform = "";
  }, [badgeEnBarre]);

  const badgeCourses = (
    <div
      ref={badge}
      className={"hero__badge hero__badge--courses" + (badgeEnBarre ? " badge-courses-toolbar" : "")}
      id="badgeCoursesContainer"
      style={badgeEnBarre ? { width: tailleBadge + "px", height: tailleBadge + "px", paddingBottom: ((tailleBadge * 8) / 65).toFixed(1) + "px" } : undefined}
    >
      <span id="badgeNbCourses" ref={nombreBadge}>
        {items.length}
      </span>
    </div>
  );

  // ---------- Filtres par rayon (mode magasin) ----------

  const cleCategories = [...new Set(items.map(categorieDe))].sort().join("|");
  useEffect(() => {
    // Un rayon vidé perd sa puce ; un nouveau rayon en reçoit une, cochée (synchroniserChipsFiltreCourses).
    const presentes = new Set(cleCategories ? cleCategories.split("|") : []);
    const gardees = puces.filter((c) => presentes.has(c));
    const nouvelles = [...presentes].filter((c) => !puces.includes(c));
    if (gardees.length === puces.length && nouvelles.length === 0) return;
    setPuces([...gardees, ...nouvelles]);
    setActives((a) => {
      const suivantes = new Set([...a].filter((c) => presentes.has(c)));
      nouvelles.forEach((c) => suivantes.add(c));
      return suivantes;
    });
  }, [cleCategories]);

  const toutSelectionne = actives.size === puces.length;

  function cliquerPuce(categorie) {
    if (categorie === "tous") {
      setActives(toutSelectionne ? new Set() : new Set(puces));
    } else if (toutSelectionne) {
      // Cliquer un rayon depuis "Tous" = "je choisis CE rayon", pas "je retire celui-ci".
      setActives(new Set([categorie]));
    } else {
      setActives((a) => {
        const suivantes = new Set(a);
        if (suivantes.has(categorie)) suivantes.delete(categorie);
        else suivantes.add(categorie);
        return suivantes;
      });
    }
  }

  // Un rayon apparu sans puce n'est jamais filtré, sinon il disparaîtrait sans repère.
  const estVisible = (item) => !puces.includes(categorieDe(item)) || actives.has(categorieDe(item));

  function basculerMagasin() {
    const actif = !magasin;
    setMagasin(actif);
    // En quittant le mode magasin, plus aucun rayon filtré (sinon des articles resteraient cachés sans repère).
    if (!actif) setActives(new Set(puces));
  }

  // ---------- Preset "Semaine" ----------

  const cleListe = new Set(items.map((i) => cleArticlePreset(i.food_id, i.nom)));
  const clePreset = new Set(preset.map((a) => cleArticlePreset(a.food_id, a.nom_libre)));
  const presetIdentique = cleListe.size === clePreset.size && [...cleListe].every((c) => clePreset.has(c));

  function appliquerPreset() {
    const numero = ++sequence.current;
    fetchAvecRetry("/courses/preset-hebdo", { body: {} })
      .then((reponse) => {
        if (reponse.erreur) {
          alert(reponse.erreur);
          return;
        }
        if (reponse.items.length === 0) {
          appliquerListe(reponse.courses, numero);
          alert("Tout est déjà dans la liste de courses.");
          return;
        }
        if (reponse.courses) appliquerListe(reponse.courses, numero, reponse.items.map((i) => i.id));
        else setItems((liste) => reponse.items.reduce((acc, ligne) => inserer(acc, { ...preparer(ligne), effets: { entree: true } }, cle), liste));
      })
      .catch(gererErreurReseau);
  }

  function enregistrerPreset() {
    if (!confirm('Remplacer "Courses de la semaine" par la liste actuelle ?')) return;
    fetchAvecRetry("/courses/preset-hebdo/enregistrer", {})
      .then((reponse) => {
        if (reponse.erreur) {
          alert(reponse.erreur);
          return;
        }
        setPreset(items.map((i) => (i.food_id ? { food_id: i.food_id, nom_libre: null } : { food_id: null, nom_libre: i.nom.toLowerCase() })));
        setPresetConfirme(true);
        planifier(() => setPresetConfirme(false), 1500);
      })
      .catch(gererErreurReseau);
  }

  // ---------- Panneau d'ajout ----------

  function fermerPanneau() {
    setPanneauEtat({ ouvert: false, pret: false });
  }

  useEffect(() => {
    if (!panneauEtat.ouvert) return;
    panneau.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    champAjout.current?.focus();
  }, [panneauEtat.ouvert]);

  useClicExterieur([panneau, boutonAjout], fermerPanneau, panneauEtat.ouvert);

  useEffect(() => {
    if (aAmenerEnVue === null) return;
    const id = aAmenerEnVue;
    cartes.current[id]?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    majEffets(id, { miseEnAvant: true });
    planifier(() => majEffets(id, { miseEnAvant: false }), 1500);
    setAAmenerEnVue(null);
  }, [aAmenerEnVue, planifier]);

  function ajouterArticle(idAliment, texteLibre) {
    if (ajoutEnCours.current) return;
    ajoutEnCours.current = true;
    const numero = ++sequence.current;
    fetchAvecRetry("/courses/ajouter", { body: { idAliment, rechercheAliment: texteLibre } })
      .then((reponse) => {
        if (reponse.erreur) {
          alert(reponse.erreur);
          return;
        }
        if (reponse.courses) appliquerListe(reponse.courses, numero, [reponse.item.id]);
        else setItems((liste) => inserer(liste, { ...preparer(reponse.item), effets: { entree: true } }, cle));
        fermerPanneau();
      })
      .catch(gererErreurReseau)
      .finally(() => {
        ajoutEnCours.current = false;
      });
  }

  function choisirSuggestion(aliment) {
    fermerPanneau();
    const existant = items.find((i) => i.food_id === aliment.id);
    if (existant) {
      afficherToast("Déjà dans la liste de courses.");
      setAAmenerEnVue(existant.id);
      return;
    }
    ajouterArticle(aliment.id, null);
  }

  // ---------- Armement : un seul écouteur global, comme courses.js ----------

  const surClicDocument = useRef(null);
  surClicDocument.current = (event) => {
    const carte = event.target.closest?.(".course-item");
    if (!carte) {
      setArmeId(null);
      return;
    }
    const id = carte.dataset.id;
    // Zones à comportement propre : ne (dés)arment jamais leur carte, mais désarment une autre carte armée.
    if (event.target.closest(".course-nom-emoji, .input-commentaire, .note-affichee, .form-supprimer, .course-item__quantite-groupe, .btn-photo-course")) {
      if (id !== armeId) setArmeId(null);
      return;
    }
    if (id === armeId) {
      setArmeId(null);
    } else {
      setArmeId(id);
      jouerPopPanier(paniers.current[id]);
    }
  };
  useEffect(() => {
    const ecouter = (event) => surClicDocument.current(event);
    document.addEventListener("click", ecouter);
    return () => document.removeEventListener("click", ecouter);
  }, []);

  // ---------- Achat / suppression ----------

  async function envoyer(item, type, quantiteAchetee) {
    const corps = { idCourse: String(item.id) };
    if (type === "achat" && quantiteAchetee !== undefined) corps.quantiteAchetee = quantiteAchetee;
    const numero = ++sequence.current;
    let reponse;
    try {
      reponse = await fetchAvecRetry(type === "achat" ? "/courses/acheter" : "/courses/supprimer", { body: corps });
      if (reponse.erreur) {
        alert(reponse.erreur);
        return false;
      }
    } catch (err) {
      gererErreurReseau(err);
      return false;
    }
    // La photo de référence n'a plus lieu d'être : le serveur l'efface aussi.
    supprimerPhotoLocale(item.id);
    majEffets(item.id, { sortie: type === "achat" ? "disparait-achete" : "disparait-supprimer" });
    if (reponse.courses) appliquerListe(reponse.courses, numero, [item.id]);
    planifier(() => {
      typeAnimationBadge.current = type;
      setItems((liste) => liste.filter((i) => i.id !== item.id));
    }, 300);
    return true;
  }

  // ---------- Photos ----------

  useEffect(() => {
    if (popPhoto === null) return;
    relancerClasse(boutonsPhoto.current[popPhoto], "photo-pop");
    setPopPhoto(null);
  }, [popPhoto]);

  function ouvrirApercu(id) {
    idPhotoActuelle.current = id;
    const locale = lirePhotoLocale(id);
    setPhoto({ ouvert: true, src: locale ? "data:image/jpeg;base64," + locale : `/api/courses/${id}/photo?t=${Date.now()}`, fermeture: false, vers: null });
  }

  function fermerApercu() {
    const bouton = boutonsPhoto.current[idPhotoActuelle.current];
    if (bouton && apercu.current && !mouvementReduit()) {
      const cible = bouton.getBoundingClientRect();
      const source = apercu.current.getBoundingClientRect();
      const vers = {
        x: cible.left + cible.width / 2 - (source.left + source.width / 2),
        y: cible.top + cible.height / 2 - (source.top + source.height / 2),
      };
      setPhoto((p) => ({ ...p, ouvert: false, fermeture: true, vers }));
      planifier(() => setPhoto((p) => ({ ...p, fermeture: false })), 350);
    } else {
      setPhoto((p) => ({ ...p, ouvert: false }));
    }
  }

  function surPhoto(item) {
    idPhotoActuelle.current = item.id;
    if (item.aPhoto) {
      ouvrirApercu(item.id);
    } else {
      // Sinon rechoisir le même fichier ne redéclenche pas "change".
      inputPhoto.current.value = "";
      inputPhoto.current.click();
    }
  }

  function photoChoisie(event) {
    const fichier = event.target.files[0];
    const idCourse = idPhotoActuelle.current;
    if (!fichier || idCourse === null) return;
    let base64Compressee = null;
    compresserImage(fichier)
      .then((base64) => {
        base64Compressee = base64;
        return fetchAvecRetry("/courses/photo", { body: { idCourse: String(idCourse), photo: base64 } });
      })
      .then((reponse) => {
        if (reponse.erreur) {
          alert(reponse.erreur);
          return;
        }
        setItems((liste) => liste.map((i) => (i.id === idCourse ? { ...i, aPhoto: true } : i)));
        setPopPhoto(idCourse);
        sauvegarderPhotoLocale(idCourse, base64Compressee);
      })
      .catch(gererErreurReseau);
  }

  function supprimerPhoto() {
    const idCourse = idPhotoActuelle.current;
    if (idCourse === null) return;
    fetchAvecRetry("/courses/photo/supprimer", { body: { idCourse: String(idCourse) } })
      .then((reponse) => {
        if (reponse.erreur) {
          alert(reponse.erreur);
          return;
        }
        // Fermer AVANT de déplacer le bouton : l'animation "vers l'œil" a besoin de sa position actuelle.
        fermerApercu();
        supprimerPhotoLocale(idCourse);
        planifier(() => {
          boutonsPhoto.current[idCourse]?.classList.add("oeil-fermeture");
          planifier(() => {
            boutonsPhoto.current[idCourse]?.classList.remove("oeil-fermeture");
            setItems((liste) => liste.map((i) => (i.id === idCourse ? { ...i, aPhoto: false } : i)));
          }, 300);
        }, 300);
      })
      .catch(gererErreurReseau);
  }

  // ---------- Rendu ----------

  const enfantsListe = [];
  let derniereCategorie = null;
  items.forEach((item) => {
    if (cle === "categorie" && categorieDe(item) !== derniereCategorie) {
      derniereCategorie = categorieDe(item);
      enfantsListe.push(
        <p key={"entete-" + derniereCategorie} className="course-categorie-entete">
          {libelleCategorie(derniereCategorie)}
        </p>
      );
    }
    enfantsListe.push(
      <CourseItem
        key={item.id}
        item={item}
        visible={estVisible(item)}
        arme={String(item.id) === armeId}
        effets={item.effets}
        aPhoto={item.aPhoto}
        refCarte={(el) => {
          if (el) cartes.current[item.id] = el;
          else delete cartes.current[item.id];
        }}
        refPanier={(el) => {
          if (el) paniers.current[item.id] = el;
          else delete paniers.current[item.id];
        }}
        refPhoto={(el) => {
          if (el) boutonsPhoto.current[item.id] = el;
          else delete boutonsPhoto.current[item.id];
        }}
        onEnvoyer={(type, quantite) => envoyer(item, type, quantite)}
        onPhoto={() => surPhoto(item)}
        onNote={(commentaire) => enregistrerNote(item, commentaire)}
        onFinEntree={() => majEffets(item.id, { entree: false })}
      />
    );
  });

  return (
    <main>
      <section className="page-header titre-page" id="heroCourses" ref={hero}>
        <h1>Courses</h1>
        {!badgeEnBarre && badgeCourses}
      </section>

      <div className="courses-section">
        <div className="courses-controls-row" ref={barreOutils}>
          <div className="courses-controls-row__inner">
            <div className="sort-wrapper">
              <label htmlFor="sortSelectCourses">Trier par :</label>
              <CustomSelect
                id="sortSelectCourses"
                value={cle}
                options={OPTIONS_TRI}
                onChange={(valeur) => {
                  setCle(valeur);
                  setItems((liste) => trier(liste, valeur));
                }}
              />
            </div>
            <button type="button" id="toggleMagasin" className={"toggle-ios" + (magasin ? " actif" : "")} onClick={basculerMagasin}>
              <span className="toggle-ios__track">
                <span className="toggle-ios__thumb"></span>
              </span>
              <span className="toggle-ios__label">Au magasin</span>
            </button>
            <span id="badgeCoursesAncre"></span>
            {badgeEnBarre && badgeCourses}
            <button
              ref={boutonAjout}
              type="button"
              id="btnToggleAjoutCourse"
              className={"btn-ajout-icone" + (panneauEtat.ouvert ? " actif" : "")}
              title="Ajouter un article"
              onClick={() => (panneauEtat.ouvert ? fermerPanneau() : setPanneauEtat({ ouvert: true, pret: false }))}
            >
              Ajouter un article
            </button>
          </div>
        </div>

        <div className="preset-hebdo-row">
          <div className="preset-hebdo-row__normal">
            <button
              type="button"
              id="btnEnregistrerPresetHebdo"
              className={"btn-enregistrer-preset" + (items.length < 5 ? " hidden" : "") + (presetConfirme ? " confirme" : "")}
              title="Mettre à jour le preset avec la liste actuelle"
              disabled={items.length >= 5 && presetIdentique}
              onClick={enregistrerPreset}
            >
              Enregistrer
            </button>
            <button type="button" id="btnPresetHebdo" className="filter-btn btn-preset-hebdo" onClick={appliquerPreset}>
              🧺 Semaine
            </button>
          </div>
          <div className="preset-hebdo-row__filtres filter-buttons" id="courseFiltresMagasin">
            <button type="button" className={"filter-btn" + (toutSelectionne ? " active" : "")} onClick={() => cliquerPuce("tous")}>
              Tous
            </button>
            {puces.map((categorie) => (
              <button
                key={categorie}
                type="button"
                className={"filter-btn" + (!toutSelectionne && actives.has(categorie) ? " active" : "")}
                onClick={() => cliquerPuce(categorie)}
              >
                {libelleCategorie(categorie)}
              </button>
            ))}
          </div>
        </div>

        <div id="listeCourses">
          {enfantsListe}
          <PanneauAjout
            ref={panneau}
            ouvert={panneauEtat.ouvert}
            pret={panneauEtat.pret}
            onPret={() => setPanneauEtat((p) => (p.ouvert ? { ...p, pret: true } : p))}
            champ={champAjout}
            aliments={donnees.aliments}
            onChoisir={choisirSuggestion}
            onAjouterTexte={(texte) => ajouterArticle(null, texte)}
          />
        </div>

        <p className={"no-results" + (items.length > 0 ? " hidden" : "")} id="noResultsCourses">Aucun article dans la liste de courses.</p>

        <input type="file" id="inputPhotoCourse" accept="image/*" hidden ref={inputPhoto} onChange={photoChoisie} />

        <PhotoApercu
          ouvert={photo.ouvert}
          src={photo.src}
          fermeture={photo.fermeture}
          vers={photo.vers}
          refApercu={apercu}
          onFermer={fermerApercu}
          onSupprimer={supprimerPhoto}
        />
      </div>
    </main>
  );
}

export default function CoursesPage() {
  const { etat, donnees } = usePageData("/courses");
  return (
    <Page titre="Courses" etat={etat}>
      {donnees && <Courses donnees={donnees} />}
    </Page>
  );
}
