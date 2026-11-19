import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import CustomSelect from "../../components/CustomSelect.jsx";
import Page from "../../components/Page.jsx";
import { useBodyClass } from "../../hooks/useBodyClass.js";
import { useClicExterieur } from "../../hooks/useClicExterieur.js";
import { useLocalStorage } from "../../hooks/useLocalStorage.js";
import { useMinuteurs } from "../../hooks/useMinuteurs.js";
import { usePageData } from "../../hooks/usePageData.js";
import { afficherToast } from "../../toast.js";
import { rangerAuStock, relancerClasse } from "../../utils/animation.js";
import BoutonMagasin from "./BoutonMagasin.jsx";
import TiroirMagasins from "./TiroirMagasins.jsx";
import CourseItem, { jouerPopPanier } from "./CourseItem.jsx";
import EstimationCourses from "./EstimationCourses.jsx";
import PanierMagasin from "./PanierMagasin.jsx";
import PanneauAjout from "./PanneauAjout.jsx";
import PhotoApercu from "./PhotoApercu.jsx";
import {
  cleArticlePreset,
  compresserImage,
  sauvegarderPhotoLocale,
  supprimerPhotoLocale,
  synchroniserPhotosLocales,
  srcPhoto,
} from "./photos.js";
import CoursesVide from "./CoursesVide.jsx";
import { fetchAvecRetry, gererErreurReseau } from "./reseau.js";
import "./CoursesPage.css";

const OPTIONS_TRI = [
  { value: "nom", label: "Nom" },
  { value: "categorie", label: "Catégorie" },
];

const libelleCategorie = (categorie) => (categorie === "zzz" ? "Autres" : categorie);
const categorieDe = (item) => item.categorie || "zzz";
const cleTri = (item, cle) => (cle === "nom" ? item.nom.toLowerCase() : categorieDe(item));
// Mode ponctuel du bouton + (double tap) : revient au mode normal en quittant Courses ou en fermant l'app.
const DOUBLE_TAP_MS = 320;

const mouvementReduit = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function trier(items, cle) {
  return [...items].sort((a, b) => cleTri(a, cle).localeCompare(cleTri(b, cle)));
}

function inserer(items, nouvel, cle) {
  const index = items.findIndex((i) => cleTri(i, cle).localeCompare(cleTri(nouvel, cle)) > 0);
  if (index === -1) return [...items, nouvel];
  return [...items.slice(0, index), nouvel, ...items.slice(index)];
}

const PHOTOS_PAR_ARTICLE = 10;
const PHOTOS_A_LA_FOIS = 5;

function preparer(ligne) {
  return { ...ligne, photos: ligne.photos || [], effets: {} };
}

export function fusionnerListe(liste, lignes, cle, locaux = []) {
  const serveur = new Map(lignes.map((l) => [l.id, l]));
  const connus = new Set(liste.map((i) => i.id));
  let suivants = liste.map((item) => {
    if (item.effets.sortie) return item;
    const ligne = serveur.get(item.id);
    if (!ligne) return { ...item, effets: { ...item.effets, sortie: "disparait-achete" } };
    return { ...item, ...ligne, photos: ligne.photos || [] };
  });
  const nouveaux = lignes.filter((l) => !connus.has(l.id));
  nouveaux.forEach((ligne) => {
    suivants = inserer(suivants, { ...preparer(ligne), effets: { entree: true } }, cle);
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
  // Ajout en route : le caddie de la liste vide reste caché jusqu'à l'arrivée de l'article (pas de reflet entre les deux).
  const [ajoutEnAttente, setAjoutEnAttente] = useState(false);
  const typeAnimationBadge = useRef("achat");
  const nombrePrecedent = useRef(null);
  const badgeEnBarreActuel = useRef(false);

  const [cle, setCle] = useState("nom");
  const [items, setItems] = useState(() => trier(donnees.courses.map(preparer), "nom"));
  const [magasin, setMagasin] = useLocalStorage("modeMagasin", (v) => v === "true");
  // Magasin choisi par deux touchers sur le caddie, en mode magasin ou non ; sans choix = tous les magasins.
  // Seuls ses articles restent (et ceux sans magasin connu), et la fourchette ne compte que ses prix.
  const [enseigne, setEnseigne] = useLocalStorage("magasinCourses", (v) => v || "tous");
  const enseigneActive = enseigne !== "tous" ? enseigne : null;
  const [choixMagasin, setChoixMagasin] = useState(false);
  const [puces, setPuces] = useState(() => [...new Set(donnees.courses.map(categorieDe))].sort());
  const [actives, setActives] = useState(() => new Set(donnees.courses.map(categorieDe)));
  const [armeId, setArmeId] = useState(null);
  const [panneauEtat, setPanneauEtat] = useState({ ouvert: false, pret: false });
  const [modePonctuel, setModePonctuel] = useState(false);
  const dernierTapAjout = useRef(0);
  // Un tap ouvre ou ferme le panneau ; deux taps rapprochés entrent dans le mode ponctuel ou en sortent.
  function taperAjout() {
    const maintenant = Date.now();
    if (maintenant - dernierTapAjout.current < DOUBLE_TAP_MS) {
      dernierTapAjout.current = 0;
      const actif = !modePonctuel;
      setModePonctuel(actif);
      setPanneauEtat(actif ? { ouvert: true, pret: false } : { ouvert: false, pret: false });
      afficherToast(actif ? "Mode ponctuel" : "Mode normal");
      return;
    }
    dernierTapAjout.current = maintenant;
    setPanneauEtat(panneauEtat.ouvert ? { ouvert: false, pret: false } : { ouvert: true, pret: false });
  }
  const [estimation, setEstimation] = useState(null);
  const listeIds = items.map((i) => i.id).sort().join(",");

  // Fourchette de prix recalculée par le serveur à chaque ajout, achat ou retrait (habitudes × dernier prix).
  useEffect(() => {
    const controleur = new AbortController();
    const minuteur = setTimeout(() => {
      api("/courses/estimation" + (enseigneActive ? "?magasin=" + encodeURIComponent(enseigneActive) : ""), { signal: controleur.signal })
        .then(({ donnees: e }) => setEstimation(e))
        .catch(() => {});
    }, 400);
    return () => {
      clearTimeout(minuteur);
      controleur.abort();
    };
  }, [listeIds, enseigneActive]);
  // Panier de la tournée, relu à chaque changement de la liste tant qu'on est en mode magasin.
  const [panier, setPanier] = useState(null);
  useEffect(() => {
    if (!magasin) return;
    const controleur = new AbortController();
    const minuteur = setTimeout(() => {
      api("/courses/panier", { signal: controleur.signal })
        .then(({ donnees: p }) => {
          // Page restée ouverte en magasin au passage de minuit : la tournée vient d'être terminée.
          if (p?.termineeAMinuit) {
            setPanier(null);
            basculerMagasin();
            return;
          }
          if (p) setPanier(p);
        })
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(minuteur);
      controleur.abort();
    };
  }, [listeIds, magasin]);
  // Le mode magasin ouvre la tournée (aucun effet si elle l'est déjà) ; restée ouverte après minuit, elle est terminée
  // par le serveur et la page sort du mode magasin.
  useEffect(() => {
    if (!magasin) return;
    api("/courses/tournee/commencer", { method: "POST", body: {} })
      .then(({ donnees: r }) => {
        if (r?.termineeAMinuit) {
          setPanier(null);
          basculerMagasin();
          return;
        }
        if (r?.panier) setPanier(r.panier);
      })
      .catch(() => {});
  }, [magasin]);
  const [preset, setPreset] = useState(donnees.presetHebdo);
  const [presetConfirme, setPresetConfirme] = useState(false);
  const [badgeEnBarre, setBadgeEnBarre] = useState(false);
  const [tailleBadge, setTailleBadge] = useState(34);
  // Visionneuse : l'article ouvert, la photo affichée et celle qui s'efface pendant sa suppression.
  const [photo, setPhoto] = useState({ ouvert: false, idCourse: null, index: 0, sortante: null, fermeture: false, vers: null });
  const [aAmenerEnVue, setAAmenerEnVue] = useState(null);
  const [popPhoto, setPopPhoto] = useState(null);

  useBodyClass("mode-magasin", magasin);

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
      revelerNouveaux([...nouveaux].sort((a, b) => a.id - b.id));
    }
    if (retires.length > 0) {
      itemsActuels.current.filter((i) => retires.includes(i.id)).forEach((i) => i.photos.forEach(supprimerPhotoLocale));
      if (retires.map(String).includes(armeId)) setArmeId(null);
      planifier(() => setItems((liste) => liste.filter((i) => !retires.includes(i.id))), 300);
    }
  }

  function majEffets(id, effets) {
    setItems((liste) => liste.map((i) => (i.id === id ? { ...i, effets: { ...i.effets, ...effets } } : i)));
  }

  useEffect(() => {
    synchroniserPhotosLocales(donnees.courses.flatMap((c) => c.photos || []));
  }, [donnees]);

  const [aReveler, setAReveler] = useState(0);
  const [annonce, setAnnonce] = useState(null);
  const [fusion, setFusion] = useState(false);
  function revelerNouveaux(lignes) {
    const n = lignes.length;
    // Article ajouté pendant qu'on est au magasin : on sort du filtre pour le voir arriver.
    setEnseigne("tous");
    const reduit = mouvementReduit();
    const DUREE_ANNONCE = reduit ? 0 : 1000;
    const ECART = 1300;
    const HALO = 1560;
    setAReveler((r) => r + n);
    if (!reduit) {
      const cible = badge.current?.getBoundingClientRect();
      const dx = cible ? cible.left + cible.width / 2 - window.innerWidth / 2 : 0;
      const dy = cible ? cible.top + cible.height / 2 - window.innerHeight / 2 : 0;
      setAnnonce({ n, dx, dy, cle: Date.now() });
      planifier(() => setAnnonce(null), DUREE_ANNONCE);
    }
    lignes.forEach((ligne, index) => {
      planifier(() => {
        setActives((a) => (a.has(categorieDe(ligne)) ? a : new Set([...a, categorieDe(ligne)])));
        cartes.current[ligne.id]?.scrollIntoView?.({ behavior: reduit ? "auto" : "smooth", block: "center" });
        planifier(() => {
          cartes.current[ligne.id]?.style.setProperty("--duree-halo", HALO + "ms");
          majEffets(ligne.id, { vientDArriver: true });
          planifier(() => majEffets(ligne.id, { vientDArriver: false }), HALO);
        }, 450);
      }, DUREE_ANNONCE + 300 + index * ECART);
    });
    planifier(() => {
      setFusion(true);
      planifier(() => {
        setFusion(false);
        setAReveler((r) => Math.max(0, r - n));
      }, 350);
    }, DUREE_ANNONCE + 300 + (n - 1) * ECART + 450 + HALO);
  }
  const nombreAffiche = items.length - aReveler;

  // En mode magasin, la liste est relue toutes les 15 s : un article ajouté depuis l'autre téléphone arrive tout seul.
  const appliquerListeRef = useRef(appliquerListe);
  appliquerListeRef.current = appliquerListe;
  useEffect(() => {
    if (!magasin) return;
    const minuteur = setInterval(() => {
      const numero = ++sequence.current;
      api("/courses")
        .then(({ donnees: d }) => d && appliquerListeRef.current(d.courses, numero))
        .catch(() => {});
    }, 15000);
    return () => clearInterval(minuteur);
  }, [magasin]);

  // Ponctuel : l'étiquette change tout de suite, la liste du serveur suit.
  function changerPonctuel(item, ponctuel) {
    setItems((liste) => liste.map((i) => (i.id === item.id ? { ...i, ponctuel } : i)));
    const numero = ++sequence.current;
    fetchAvecRetry("/courses/ponctuel", { body: { idCourse: String(item.id), ponctuel } })
      .then((reponse) => appliquerListe(reponse.courses, numero, [item.id]))
      .catch((err) => {
        setItems((liste) => liste.map((i) => (i.id === item.id ? { ...i, ponctuel: !ponctuel } : i)));
        gererErreurReseau(err);
      });
  }

  function enregistrerNote(item, commentaire) {
    const numero = ++sequence.current;
    fetchAvecRetry("/courses/commentaire", { body: { idCourse: String(item.id), commentaire } })
      .then((reponse) => appliquerListe(reponse.courses, numero, [item.id]))
      .catch(gererErreurReseau);
  }

  useEffect(() => {
    const nombre = nombreAffiche;
    if (nombrePrecedent.current !== null && nombrePrecedent.current !== nombre) {
      nombreBadge.current?.classList.remove("badge-pop", "badge-shake");
      relancerClasse(nombreBadge.current, typeAnimationBadge.current === "suppression" ? "badge-shake" : "badge-pop");
    }
    nombrePrecedent.current = nombre;
    typeAnimationBadge.current = "achat";
  }, [nombreAffiche]);

  useEffect(() => {
    if (!("IntersectionObserver" in window) || !hero.current || !barreOutils.current) return;
    const hauteurHeader = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 65;
    const decalage = hauteurHeader + barreOutils.current.offsetHeight;
    const observateur = new IntersectionObserver(
      (entrees) => {
        const versBarre = !entrees[0].isIntersecting;
        if (badgeEnBarreActuel.current === versBarre) return;
        badgeEnBarreActuel.current = versBarre;
        avantDeplacement.current = badge.current?.getBoundingClientRect() ?? null;
        if (versBarre) setTailleBadge(document.querySelector(".sort-wrapper .custom-select__button")?.offsetHeight || 34);
        setBadgeEnBarre(versBarre);
      },
      { rootMargin: `-${decalage}px 0px 0px 0px`, threshold: 0 }
    );
    observateur.observe(hero.current);
    return () => observateur.disconnect();
  }, []);

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
        {nombreAffiche}
      </span>
      {aReveler > 0 && !annonce && (
        <span key={aReveler} className={"badge-ajout" + (fusion ? " fusion" : "")} aria-live="polite">
          +{aReveler}
        </span>
      )}
    </div>
  );

  const cleCategories = [...new Set(items.map(categorieDe))].sort().join("|");
  useEffect(() => {
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
  // Filtre « Ponctuel » : en plus des catégories, ne garde que les achats ponctuels ; il disparaît quand il n'y en a plus.
  const [ponctuelSeul, setPonctuelSeul] = useState(false);
  const aDesPonctuels = items.some((i) => i.ponctuel && !i.effets?.sortie);
  const [puceSort, setPuceSort] = useState(false);
  const puceAffichee = aDesPonctuels || puceSort;
  const dejaPonctuels = useRef(aDesPonctuels);
  useEffect(() => {
    if (dejaPonctuels.current && !aDesPonctuels) {
      setPonctuelSeul(false);
      setPuceSort(true);
      planifier(() => setPuceSort(false), 200);
    }
    dejaPonctuels.current = aDesPonctuels;
  }, [aDesPonctuels]);

  function cliquerPuce(categorie) {
    if (categorie === "tous") {
      setActives(toutSelectionne ? new Set() : new Set(puces));
    } else if (toutSelectionne) {
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

  const estIci = (item) => !enseigneActive || !item.magasins?.length || item.magasins.includes(enseigneActive);
  const estVisible = (item) =>
    (!puces.includes(categorieDe(item)) || actives.has(categorieDe(item))) && estIci(item) && (!ponctuelSeul || item.ponctuel);

  // Panier filtré par le magasin choisi : ce qui y a été coché, et ce qui reste à y prendre.
  const lignesPanier = (panier?.lignes || []).filter((l) =>
    l.achete ? !enseigneActive || l.enseigne === enseigneActive : estIci(l)
  );

  function terminerTournee() {
    api("/courses/tournee/terminer", { method: "POST", body: {} })
      .then(() => {
        setPanier(null);
        if (magasin) basculerMagasin();
        afficherToast("Courses terminées.");
      })
      .catch(gererErreurReseau);
  }

  // Entrer ou sortir du mode magasin garde le magasin choisi : les deux se règlent séparément.
  function basculerMagasin() {
    const actif = !magasin;
    setMagasin(actif);
    if (!actif) setActives(new Set(puces));
  }

  const cleListe = new Set(items.map((i) => cleArticlePreset(i.food_id, i.nom, i.article_id)));
  const clePreset = new Set(preset.map((a) => cleArticlePreset(a.food_id, a.nom_libre, a.article_id)));
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
        setPreset(items.map((i) => ({ food_id: i.food_id || null, article_id: i.food_id ? null : i.article_id || null, nom_libre: i.food_id || i.article_id ? null : i.nom.toLowerCase() })));
        setPresetConfirme(true);
        planifier(() => setPresetConfirme(false), 1500);
      })
      .catch(gererErreurReseau);
  }

  function fermerPanneau() {
    dernierTapAjout.current = 0;
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

  function ajouterArticle(idAliment, texteLibre, idArticle = null) {
    if (ajoutEnCours.current) return;
    ajoutEnCours.current = true;
    setAjoutEnAttente(true);
    const numero = ++sequence.current;
    fetchAvecRetry("/courses/ajouter", { body: { idAliment, rechercheAliment: texteLibre, ...(idArticle && { idArticle }), ...(modePonctuel && { ponctuel: true }) } })
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
        setAjoutEnAttente(false);
      });
  }

  function choisirSuggestion(choix) {
    fermerPanneau();
    const existant = items.find((i) => (choix.cle ? i.article_id === choix.id : i.food_id === choix.id));
    if (existant) {
      afficherToast("Déjà dans la liste de courses.");
      setAAmenerEnVue(existant.id);
      return;
    }
    if (choix.cle) ajouterArticle(null, null, choix.id);
    else ajouterArticle(choix.id, null);
  }

  const surClicDocument = useRef(null);
  surClicDocument.current = (event) => {
    const carte = event.target.closest?.(".course-item");
    if (!carte) {
      setArmeId(null);
      return;
    }
    const id = carte.dataset.id;
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

  async function envoyer(item, type, quantiteAchetee) {
    const corps = { idCourse: String(item.id) };
    if (type === "achat" && quantiteAchetee !== undefined) corps.quantiteAchetee = quantiteAchetee;
    // Acheté dans ce magasin : la ligne garde l'enseigne, qui rejoint les magasins habituels de l'article.
    if (type === "achat" && magasin && enseigneActive) corps.magasin = enseigneActive;
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
    item.photos.forEach(supprimerPhotoLocale);
    // Acheté : la carte devient son aliment, qui file dans le lien Stock changé en boîte ; l'originale se replie aussitôt.
    const envolee = type === "achat" && item.emoji && rangerAuStock(document.querySelector(`.course-item[data-id="${item.id}"]`), item.emoji);
    majEffets(item.id, { sortie: type === "achat" ? (envolee ? "disparait-achete envolee" : "disparait-achete") : "disparait-supprimer" });
    if (reponse.courses) appliquerListe(reponse.courses, numero, [item.id]);
    planifier(() => {
      typeAnimationBadge.current = type;
      setItems((liste) => liste.filter((i) => i.id !== item.id));
    }, 300);
    return true;
  }

  useEffect(() => {
    if (popPhoto === null) return;
    relancerClasse(boutonsPhoto.current[popPhoto], "photo-pop");
    setPopPhoto(null);
  }, [popPhoto]);

  function ouvrirApercu(id) {
    idPhotoActuelle.current = id;
    setPhoto({ ouvert: true, idCourse: id, index: 0, sortante: null, fermeture: false, vers: null });
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

  function choisirPhoto() {
    inputPhoto.current.value = "";
    inputPhoto.current.click();
  }

  function surPhoto(item) {
    idPhotoActuelle.current = item.id;
    if (item.photos.length) ouvrirApercu(item.id);
    else choisirPhoto();
  }

  // Photos choisies dans la photothèque : 5 au plus à la fois, et pas plus de 10 par article (limite du serveur).
  async function photoChoisie(event) {
    const idCourse = idPhotoActuelle.current;
    const choisis = [...(event.target.files || [])];
    if (!choisis.length || idCourse === null) return;
    const deja = itemsActuels.current.find((i) => i.id === idCourse)?.photos.length ?? 0;
    const place = Math.max(0, PHOTOS_PAR_ARTICLE - deja);
    const fichiers = choisis.slice(0, Math.min(PHOTOS_A_LA_FOIS, place));
    if (!fichiers.length) {
      afficherToast(`${PHOTOS_PAR_ARTICLE} photos au plus par article.`);
      return;
    }
    if (fichiers.length < choisis.length) {
      afficherToast(fichiers.length === place && place < PHOTOS_A_LA_FOIS ? `${PHOTOS_PAR_ARTICLE} photos au plus : ${fichiers.length} ajoutée${fichiers.length > 1 ? "s" : ""}.` : `${PHOTOS_A_LA_FOIS} photos à la fois : les ${PHOTOS_A_LA_FOIS} premières sont ajoutées.`);
    }
    const dansLaVisionneuse = photo.ouvert && photo.idCourse === idCourse;
    let premiere = true;
    // Une à une, dans l'ordre choisi : chacune apparaît dès qu'elle est enregistrée.
    for (const fichier of fichiers) {
      try {
        const base64 = await compresserImage(fichier);
        const reponse = await fetchAvecRetry("/courses/photo", { body: { idCourse: String(idCourse), photo: base64 } });
        if (reponse.erreur) {
          alert(reponse.erreur);
          return;
        }
        sauvegarderPhotoLocale(reponse.idPhoto, base64);
        const avant = itemsActuels.current.find((i) => i.id === idCourse)?.photos.length ?? 0;
        setItems((liste) => liste.map((i) => (i.id === idCourse ? { ...i, photos: [...i.photos, reponse.idPhoto] } : i)));
        // Ajoutées depuis la visionneuse : elle glisse jusqu'à la première nouvelle. Sinon l'œil apparaît d'un bond.
        if (premiere) {
          if (dansLaVisionneuse) setPhoto((p) => ({ ...p, index: avant }));
          else setPopPhoto(idCourse);
          premiere = false;
        }
      } catch (err) {
        gererErreurReseau(err);
        return;
      }
    }
  }

  function supprimerPhoto() {
    const idCourse = photo.idCourse;
    const photos = itemsActuels.current.find((i) => i.id === idCourse)?.photos || [];
    const idPhoto = photos[photo.index];
    if (!idPhoto) return;
    fetchAvecRetry("/courses/photo/supprimer", { body: { idPhoto: String(idPhoto) } })
      .then((reponse) => {
        if (reponse.erreur) {
          alert(reponse.erreur);
          return;
        }
        supprimerPhotoLocale(idPhoto);
        const retirer = () => setItems((liste) => liste.map((i) => (i.id === idCourse ? { ...i, photos: i.photos.filter((p) => p !== idPhoto) } : i)));
        if (photos.length > 1) {
          // Il en reste : celle-ci s'efface, la suivante prend sa place (la précédente si c'était la dernière).
          setPhoto((p) => ({ ...p, sortante: idPhoto }));
          planifier(() => {
            retirer();
            setPhoto((p) => ({ ...p, sortante: null, index: Math.min(p.index, photos.length - 2) }));
          }, mouvementReduit() ? 0 : 200);
          return;
        }
        // C'était la seule : la visionneuse rentre dans l'œil, qui se ferme.
        fermerApercu();
        planifier(() => {
          boutonsPhoto.current[idCourse]?.classList.add("oeil-fermeture");
          planifier(() => {
            boutonsPhoto.current[idCourse]?.classList.remove("oeil-fermeture");
            retirer();
          }, 300);
        }, 300);
      })
      .catch(gererErreurReseau);
  }

  const photosOuvertes = (items.find((i) => i.id === photo.idCourse)?.photos || []).map((id) => ({ id, src: srcPhoto(id) }));

  const enfantsListe = [];
  let derniereCategorie = null;
  items.forEach((item) => {
    if (cle === "categorie" && categorieDe(item) !== derniereCategorie) {
      derniereCategorie = categorieDe(item);
      // Titre masqué quand le filtre cache tous les articles de sa catégorie.
      const categorieVisible = items.some((i) => categorieDe(i) === derniereCategorie && estVisible(i));
      enfantsListe.push(
        <p key={"entete-" + derniereCategorie} className={"course-categorie-entete" + (categorieVisible ? "" : " hidden")}>
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
        nbPhotos={item.photos.length}
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
        onPonctuel={item.food_id || item.article_id || item.nom_libre ? (ponctuel) => changerPonctuel(item, ponctuel) : undefined}
        onFinEntree={() => majEffets(item.id, { entree: false })}
      />
    );
  });

  // Puce « Ponctuel » : dans la rangée normale et dans les filtres du mode magasin.
  const boutonPonctuel = puceAffichee && (
    <button
                type="button"
                className={"filter-btn filter-btn--ponctuel filter-btn--icone-seule" + (ponctuelSeul ? " active" : "") + (aDesPonctuels ? "" : " sortie")}
                aria-pressed={ponctuelSeul}
                aria-label="Ponctuel"
                title="Ponctuel"
                onClick={() => setPonctuelSeul((p) => !p)}
              >
                <span className="filter-btn__icone" style={{ "--icone": 'url("/images/svg/ponctuel.svg")' }} aria-hidden="true" />
              </button>
  );

  return (
    <main>
      <section className="page-header titre-page" id="heroCourses" ref={hero}>
        {/* En magasin, le panier pousse le titre : l'un sort par la gauche pendant que l'autre entre. */}
        <div className="courses-entete-pile">
          <div className={"courses-titre" + (magasin ? " cache" : "")} aria-hidden={magasin}>
            <h1>Courses</h1>
            {estimation && items.length > 0 && estimation.haut > 0 && <EstimationCourses estimation={estimation} />}
          </div>
          <div className={"courses-panier-zone" + (magasin ? "" : " cache")} aria-hidden={!magasin}>
            {panier && <PanierMagasin lignes={lignesPanier} onTerminer={terminerTournee} />}
          </div>
        </div>
        {badgeEnBarre ? <div className="hero__badge hero__badge--courses" style={{ visibility: "hidden" }} aria-hidden="true" /> : badgeCourses}
      </section>

      <div className="courses-section">
        <div className={"courses-controls-row" + (magasin && badgeEnBarre && panier ? " avec-panier" : "")} ref={barreOutils}>
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
            <span className={"magasin-zone" + (choixMagasin ? " ouvert" : "")}>
              <BoutonMagasin actif={magasin} logosSortis={choixMagasin} enseigne={choixMagasin ? "tous" : enseigne} onBasculer={basculerMagasin} onChoisirMagasin={() => setChoixMagasin(true)} />
              {choixMagasin && <TiroirMagasins enseigne={enseigne} onChoisir={setEnseigne} onFermer={() => setChoixMagasin(false)} />}
            </span>
            <span id="badgeCoursesAncre"></span>
            {badgeEnBarre && badgeCourses}
            <button
              ref={boutonAjout}
              type="button"
              id="btnToggleAjoutCourse"
              className={"btn-ajout-icone" + (panneauEtat.ouvert ? " actif" : "") + (modePonctuel ? " ponctuel" : "")}
              title={modePonctuel ? "Ajouter (ponctuel) · double tap pour revenir" : "Ajouter un article · double tap : ponctuel"}
              aria-pressed={modePonctuel}
              onClick={taperAjout}
            >
              Ajouter un article
            </button>
          </div>
          <div className={"courses-panier-fin" + (magasin && badgeEnBarre && panier ? " visible" : "")} aria-hidden={!(magasin && badgeEnBarre)}>
            <div className="courses-panier-fin__inner">{panier && <PanierMagasin lignes={lignesPanier} reduit />}</div>
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
            {boutonPonctuel}
          </div>
          <div className="preset-hebdo-row__filtres filter-buttons" id="courseFiltresMagasin">
            <button type="button" className={"filter-btn" + (toutSelectionne ? " active" : "")} onClick={() => cliquerPuce("tous")}>
              Tous
            </button>
            {boutonPonctuel}
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
            articles={donnees.articles}
            onChoisir={choisirSuggestion}
            onAjouterTexte={(texte) => ajouterArticle(null, texte)}
            ponctuel={modePonctuel}
          />
        </div>

        {items.length === 0 && !panneauEtat.ouvert && !ajoutEnAttente && <CoursesVide />}

        <input type="file" id="inputPhotoCourse" accept="image/*" multiple hidden ref={inputPhoto} onChange={photoChoisie} />

        <PhotoApercu
          ouvert={photo.ouvert}
          photos={photosOuvertes}
          index={photo.index}
          onIndex={(index) => setPhoto((p) => ({ ...p, index }))}
          sortante={photo.sortante}
          fermeture={photo.fermeture}
          vers={photo.vers}
          refApercu={apercu}
          onFermer={fermerApercu}
          onAjouter={choisirPhoto}
          onSupprimer={supprimerPhoto}
        />
      </div>
      {annonce && (
        <div key={annonce.cle} className="annonce-ajout" style={{ "--dx": annonce.dx + "px", "--dy": annonce.dy + "px" }} aria-hidden="true">
          +{annonce.n}
        </div>
      )}
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
