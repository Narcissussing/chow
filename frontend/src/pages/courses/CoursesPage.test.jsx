import { act, fireEvent, screen, within } from "@testing-library/react";
import { abonnerToast } from "../../toast.js";
import { rendreApp, simulerApi } from "../../testUtils.jsx";

const COURSES = [
  { id: 1, food_id: "lait", nom: "Lait", emoji: "🥛", categorie: "Laitiers", tracking_type: "cl", quantite_stock: "vide", commentaire: null, has_photo: false },
  { id: 2, food_id: "riz", nom: "Riz", emoji: "🍚", categorie: "Féculents", tracking_type: "pack", quantite_stock: "1", commentaire: "Basmati", has_photo: false },
  { id: 3, food_id: null, nom: "Puck", emoji: "🆕", categorie: null, tracking_type: null, quantite_stock: null, commentaire: null, has_photo: true },
];
const ALIMENTS = [
  { id: "lait", nom: "Lait", emoji: "🥛" },
  { id: "pomme", nom: "Pomme", emoji: "🍎" },
];

let requetes;
function ouvrirCourses(surcharges = {}, { courses = COURSES, preset = [] } = {}) {
  requetes = [];
  const noter = (chemin, reponse) => (options) => {
    requetes.push({ chemin, corps: JSON.parse(options.body) });
    return typeof reponse === "function" ? reponse(options) : reponse;
  };
  const reponses = {
    "/session": [200, { utilisateur: { id: 1 } }],
    "/courses": [200, { courses, aliments: ALIMENTS, stock: [], presetHebdo: preset }],
    "/courses/acheter": noter("/courses/acheter", [200, { succes: true }]),
    "/courses/supprimer": noter("/courses/supprimer", [200, { succes: true }]),
    "/courses/commentaire": noter("/courses/commentaire", [200, { succes: true }]),
    "/courses/ajouter": noter("/courses/ajouter", (o) => {
      const corps = JSON.parse(o.body);
      return [200, { succes: true, item: corps.idAliment
        ? { id: 10, food_id: "pomme", nom: "Pomme", emoji: "🍎", categorie: "Fruits", tracking_type: "unite", quantite_stock: null }
        : { id: 11, food_id: null, nom: corps.rechercheAliment, emoji: "🆕", categorie: null, tracking_type: null, quantite_stock: null } }];
    }),
    "/courses/preset-hebdo": noter("/courses/preset-hebdo", [200, { succes: true, items: [] }]),
    "/courses/preset-hebdo/enregistrer": noter("/courses/preset-hebdo/enregistrer", [200, { succes: true }]),
  };
  for (const [chemin, reponse] of Object.entries(surcharges)) reponses[chemin] = noter(chemin, reponse);
  simulerApi(reponses);
  return rendreApp("/courses");
}

const attendrePage = () => screen.findByText("Chow — Fait maison 🏠");
const carte = (nom) => [...document.querySelectorAll(".course-item")].find((c) => c.querySelector(".course-nom").textContent.includes(nom));
const ordreListe = () => [...document.getElementById("listeCourses").children].map((e) => (e.classList.contains("course-categorie-entete") ? "#" + e.textContent : e.id || e.querySelector(".course-nom").textContent.trim()));
function choisirTri(libelle) {
  fireEvent.click(document.querySelector(".sort-wrapper .custom-select__button"));
  fireEvent.click(within(document.querySelector(".custom-select__list")).getByText(libelle));
}

afterEach(() => {
  jest.useRealTimers();
  localStorage.clear();
});

test("tri par nom au chargement, panneau d'ajout toujours dernier ; tri par catégorie avec en-têtes", async () => {
  ouvrirCourses();
  await attendrePage();
  expect(ordreListe()).toEqual(["🥛 Lait", "🆕 Puck", "🍚 Riz", "panneauAjoutCourse"]);
  choisirTri("Catégorie");
  expect(ordreListe()).toEqual(["#Féculents", "🍚 Riz", "#Laitiers", "🥛 Lait", "#Autres", "🆕 Puck", "panneauAjoutCourse"]);
});

test("ajout en tri par catégorie : l'article va sous son propre en-tête (correctif)", async () => {
  ouvrirCourses();
  await attendrePage();
  choisirTri("Catégorie");
  fireEvent.click(document.getElementById("btnToggleAjoutCourse"));
  fireEvent.change(document.getElementById("rechercheAlimentCourses"), { target: { value: "pomme" } });
  await act(async () => fireEvent.click(within(document.getElementById("listeAlimentsCourses")).getByText(/Pomme/)));
  expect(ordreListe()).toEqual(["#Féculents", "🍚 Riz", "#Fruits", "🍎 Pomme", "#Laitiers", "🥛 Lait", "#Autres", "🆕 Puck", "panneauAjoutCourse"]);
  expect(document.getElementById("badgeNbCourses")).toHaveTextContent("4");
  expect(document.getElementById("badgeNbCourses")).toHaveClass("badge-pop");
});

test("panneau : texte inconnu → « Ajouter » visible ; Entrée = article libre ; doublon par aliment → toast", async () => {
  const toasts = [];
  const desabonner = abonnerToast((m) => m && toasts.push(m));
  ouvrirCourses();
  await attendrePage();
  fireEvent.click(document.getElementById("btnToggleAjoutCourse"));
  expect(document.getElementById("panneauAjoutCourse")).toHaveClass("ouvert");
  const champ = document.getElementById("rechercheAlimentCourses");
  fireEvent.change(champ, { target: { value: "Fromage frais" } });
  expect(document.getElementById("btnAjouterCourse")).not.toHaveClass("hidden");
  expect(champ).toHaveClass("recherche-invalide");
  await act(async () => fireEvent.keyDown(champ, { key: "Enter" }));
  expect(requetes).toEqual([{ chemin: "/courses/ajouter", corps: { idAliment: null, rechercheAliment: "Fromage frais" } }]);
  expect(document.getElementById("panneauAjoutCourse")).not.toHaveClass("ouvert");

  fireEvent.click(document.getElementById("btnToggleAjoutCourse"));
  fireEvent.change(document.getElementById("rechercheAlimentCourses"), { target: { value: "lait" } });
  fireEvent.click(within(document.getElementById("listeAlimentsCourses")).getByText(/Lait/));
  expect(toasts).toEqual(["Déjà dans la liste de courses."]);
  expect(requetes).toHaveLength(1);
  desabonner();
});

test("armement : premier tap arme sans acheter ; zones exclues ; clic ailleurs désarme", async () => {
  ouvrirCourses();
  await attendrePage();
  fireEvent.click(carte("Lait").querySelector(".course-nom"));
  expect(carte("Lait")).toHaveClass("arme");
  expect(requetes).toHaveLength(0);
  fireEvent.click(carte("Riz").querySelector(".course-nom-emoji"));
  expect(carte("Lait")).not.toHaveClass("arme");
  expect(carte("Riz")).not.toHaveClass("arme");
  fireEvent.click(carte("Puck"));
  expect(carte("Puck")).toHaveClass("arme");
  fireEvent.click(document.body);
  expect(carte("Puck")).not.toHaveClass("arme");
});

test("quantité : « Acheté » désactivé tant que vide ; +2 achète 2 ; carte retirée à 300 ms", async () => {
  jest.useFakeTimers();
  ouvrirCourses();
  await act(async () => jest.runOnlyPendingTimers());
  await attendrePage();
  const bouton = carte("Riz").querySelector(".btn-enregistrer-achat");
  expect(bouton).toBeDisabled();
  fireEvent.change(carte("Riz").querySelector(".champ-quantite-achat"), { target: { value: "3" } });
  expect(bouton).not.toBeDisabled();
  expect(bouton).toHaveClass("vient-de-s-activer");
  await act(async () => fireEvent.click([...carte("Riz").querySelectorAll(".suggestion")].find((b) => b.textContent === "+2")));
  expect(requetes).toEqual([{ chemin: "/courses/acheter", corps: { idCourse: "2", quantiteAchetee: "2" } }]);
  expect(carte("Riz")).toHaveClass("disparait-achete");
  act(() => jest.advanceTimersByTime(300));
  expect(carte("Riz")).toBeUndefined();
  expect(document.getElementById("badgeNbCourses")).toHaveTextContent("2");
});

test("suppression : animation de suppression, badge qui tremble", async () => {
  jest.useFakeTimers();
  ouvrirCourses();
  await act(async () => jest.runOnlyPendingTimers());
  await attendrePage();
  await act(async () => fireEvent.click(carte("Lait").querySelector(".form-supprimer button")));
  expect(carte("Lait")).toHaveClass("disparait-supprimer");
  act(() => jest.advanceTimersByTime(300));
  expect(document.getElementById("badgeNbCourses")).toHaveClass("badge-shake");
});

test("réseau du magasin : un réessai après 800 ms, puis toast ; le bouton redevient cliquable", async () => {
  jest.useFakeTimers();
  const toasts = [];
  const desabonner = abonnerToast((m) => m && toasts.push(m));
  ouvrirCourses({
    "/courses/acheter": () => {
      throw new TypeError("Failed to fetch");
    },
  });
  await act(async () => jest.runOnlyPendingTimers());
  await attendrePage();
  fireEvent.click(carte("Lait").querySelector(".course-nom"));
  const bouton = carte("Lait").querySelector(".btn-acheter-icone");
  await act(async () => fireEvent.click(bouton));
  expect(bouton).toBeDisabled();
  expect(requetes).toHaveLength(1);
  await act(async () => jest.advanceTimersByTime(800));
  expect(requetes).toHaveLength(2);
  expect(toasts).toEqual(["Connexion instable : réessaie dans un instant."]);
  expect(bouton).not.toBeDisabled();
  desabonner();
});

test("notes : l'émoji ouvre le champ, le blur enregistre, vider supprime la note", async () => {
  jest.useFakeTimers();
  ouvrirCourses();
  await act(async () => jest.runOnlyPendingTimers());
  await attendrePage();
  expect(carte("Riz").querySelector(".note-affichee")).toHaveTextContent("Basmati");
  fireEvent.click(carte("Riz").querySelector(".course-nom-emoji"));
  act(() => jest.advanceTimersByTime(150));
  expect(carte("Riz").querySelector(".ligne-commentaire")).not.toHaveClass("hidden");
  const champ = carte("Riz").querySelector(".input-commentaire");
  fireEvent.change(champ, { target: { value: "  " } });
  await act(async () => fireEvent.blur(champ));
  expect(requetes).toEqual([{ chemin: "/courses/commentaire", corps: { idCourse: "2", commentaire: "" } }]);
  expect(carte("Riz").querySelector(".note-affichee")).toBeNull();
  act(() => jest.advanceTimersByTime(150));
  expect(carte("Riz").querySelector(".ligne-commentaire")).toHaveClass("hidden");
});

test("mode magasin : classe sur body, mémorisé, puces de rayon, remise à zéro en sortant", async () => {
  const { unmount } = ouvrirCourses();
  await attendrePage();
  fireEvent.click(document.getElementById("toggleMagasin"));
  expect(document.body).toHaveClass("mode-magasin");
  expect(localStorage.getItem("modeMagasin")).toBe("true");
  const puces = document.getElementById("courseFiltresMagasin");
  expect([...puces.children].map((b) => b.textContent)).toEqual(["Tous", "Féculents", "Laitiers", "Autres"]);
  expect(within(puces).getByText("Tous")).toHaveClass("active");

  fireEvent.click(within(puces).getByText("Laitiers"));
  expect(carte("Riz")).toHaveClass("hidden");
  expect(carte("Lait")).not.toHaveClass("hidden");
  fireEvent.click(within(puces).getByText("Féculents"));
  expect(carte("Riz")).not.toHaveClass("hidden");
  fireEvent.click(within(puces).getByText("Tous"));
  expect([...document.querySelectorAll(".course-item.hidden")]).toHaveLength(0);
  fireEvent.click(within(puces).getByText("Tous"));
  expect([...document.querySelectorAll(".course-item.hidden")]).toHaveLength(3);

  fireEvent.click(document.getElementById("toggleMagasin"));
  expect(document.body).not.toHaveClass("mode-magasin");
  expect([...document.querySelectorAll(".course-item.hidden")]).toHaveLength(0);
  fireEvent.click(document.getElementById("toggleMagasin"));
  unmount();
  expect(document.body).not.toHaveClass("mode-magasin");
});

test("rayon vidé : sa puce disparaît après l'achat", async () => {
  jest.useFakeTimers();
  ouvrirCourses();
  await act(async () => jest.runOnlyPendingTimers());
  await attendrePage();
  fireEvent.click(carte("Lait").querySelector(".course-nom"));
  await act(async () => fireEvent.click(carte("Lait").querySelector(".btn-acheter-icone")));
  act(() => jest.advanceTimersByTime(300));
  expect([...document.getElementById("courseFiltresMagasin").children].map((b) => b.textContent)).toEqual(["Tous", "Féculents", "Autres"]);
});

test("preset : « Enregistrer » caché sous 5 articles, désactivé si identique ; « Tout est déjà… »", async () => {
  const cinq = [1, 2, 3, 4, 5].map((n) => ({ id: n, food_id: "f" + n, nom: "Article " + n, emoji: "🍎", categorie: "Fruits", tracking_type: "unite", quantite_stock: null, commentaire: null, has_photo: false }));
  const alerte = jest.spyOn(window, "alert").mockImplementation(() => {});
  ouvrirCourses({}, { courses: cinq, preset: cinq.map((c) => ({ food_id: c.food_id, nom_libre: null })) });
  await attendrePage();
  const enregistrer = document.getElementById("btnEnregistrerPresetHebdo");
  expect(enregistrer).not.toHaveClass("hidden");
  expect(enregistrer).toBeDisabled();
  await act(async () => fireEvent.click(document.getElementById("btnPresetHebdo")));
  expect(alerte).toHaveBeenCalledWith("Tout est déjà dans la liste de courses.");
  alerte.mockRestore();
});

test("photo : bouton œil en dernier enfant de la carte ; aperçu lu depuis le cache local", async () => {
  localStorage.setItem("chow-photo-course-3", "QUJD");
  ouvrirCourses();
  await attendrePage();
  expect(carte("Puck").lastElementChild).toHaveClass("btn-photo-course");
  expect(carte("Lait").querySelector(".ligne-commentaire .btn-photo-course")).not.toBeNull();
  fireEvent.click(carte("Puck").querySelector(".btn-photo-course"));
  expect(document.getElementById("photoBackdrop")).toHaveClass("ouvert");
  expect(document.getElementById("imgApercuPhoto")).toHaveAttribute("src", "data:image/jpeg;base64,QUJD");
});

test("achat : la liste du serveur apporte l'article ajouté ailleurs, le Stock à jour et retire celui acheté ailleurs", async () => {
  jest.useFakeTimers();
  const toasts = [];
  const desabonner = abonnerToast((m) => m && toasts.push(m));
  const pain = { id: 20, food_id: "pain", nom: "Pain", emoji: "🍞", categorie: "Boulangerie", tracking_type: "unite", quantite_stock: null, commentaire: null, has_photo: false };
  // Serveur après l'achat du Riz : Puck acheté sur l'autre téléphone, Pain ajouté, Lait passé à "plein".
  const apres = [{ ...COURSES[0], quantite_stock: "plein" }, pain];
  ouvrirCourses({ "/courses/acheter": [200, { succes: true, courses: apres }] });
  await act(async () => jest.runOnlyPendingTimers());
  await attendrePage();
  await act(async () => fireEvent.click([...carte("Riz").querySelectorAll(".suggestion")].find((b) => b.textContent === "+2")));
  expect(carte("Pain")).toHaveClass("entree");
  expect(carte("Puck")).toHaveClass("disparait-achete");
  expect(carte("Lait").querySelector(".course-stock-dot")).toHaveAttribute("title", "En stock : plein");
  expect(toasts.some((t) => t.includes("entre-temps"))).toBe(false);
  expect(document.querySelector(".badge-ajout")).toHaveTextContent("+1");
  act(() => jest.advanceTimersByTime(300));
  expect(ordreListe()).toEqual(["🥛 Lait", "🍞 Pain", "panneauAjoutCourse"]);
  desabonner();
});

test("ajout : son propre article n'est pas signalé ; une réponse plus ancienne que la dernière est ignorée", async () => {
  const toasts = [];
  const desabonner = abonnerToast((m) => m && toasts.push(m));
  let liberer;
  const pomme = { id: 10, food_id: "pomme", nom: "Pomme", emoji: "🍎", categorie: "Fruits", tracking_type: "unite", quantite_stock: null, commentaire: null, has_photo: false };
  ouvrirCourses({
    // Achat lent (réponse périmée qui contient encore Riz), puis ajout rapide.
    "/courses/acheter": () => new Promise((r) => { liberer = () => r([200, { succes: true, courses: COURSES }]); }),
    "/courses/ajouter": [200, { succes: true, item: pomme, courses: [COURSES[0], COURSES[2], pomme] }],
  });
  await attendrePage();
  fireEvent.click([...carte("Riz").querySelectorAll(".suggestion")].find((b) => b.textContent === "+2"));
  fireEvent.click(document.getElementById("btnToggleAjoutCourse"));
  fireEvent.change(document.getElementById("rechercheAlimentCourses"), { target: { value: "pomme" } });
  await act(async () => fireEvent.click(within(document.getElementById("listeAlimentsCourses")).getByText(/Pomme/)));
  expect(carte("Pomme")).not.toHaveClass("mise-en-avant");
  expect(toasts.some((t) => t.includes("entre-temps"))).toBe(false);
  await act(async () => liberer());
  expect(carte("Pomme")).toBeDefined();
  desabonner();
});

test("suppression et note : la réponse rafraîchit la liste ; une note changée ailleurs s'affiche si le champ est fermé", async () => {
  const lait = { ...COURSES[0], commentaire: "Demi-écrémé" };
  ouvrirCourses({
    "/courses/commentaire": [200, { succes: true, courses: [lait, COURSES[1], COURSES[2]] }],
  });
  await attendrePage();
  fireEvent.click(carte("Riz").querySelector(".course-nom-emoji"));
  const champ = carte("Riz").querySelector(".input-commentaire");
  fireEvent.change(champ, { target: { value: "Thaï" } });
  await act(async () => fireEvent.blur(champ));
  expect(requetes).toEqual([{ chemin: "/courses/commentaire", corps: { idCourse: "2", commentaire: "Thaï" } }]);
  expect(carte("Lait").querySelector(".note-affichee")).toHaveTextContent("Demi-écrémé");
});

test("articles de l'autre téléphone : un par un dans l'ordre d'ajout, rythme selon leur nombre, halo à l'arrivée, compteur +1", async () => {
  jest.useFakeTimers();
  const pain = { id: 21, food_id: "pain", nom: "Pain", emoji: "🍞", categorie: "Boulangerie", tracking_type: "unite", quantite_stock: null, commentaire: null, has_photo: false };
  const beurre = { id: 20, food_id: "beurre", nom: "Beurre", emoji: "🧈", categorie: "Laitiers", tracking_type: "unite", quantite_stock: null, commentaire: null, has_photo: false };
  ouvrirCourses({ "/courses/commentaire": [200, { succes: true, courses: [...COURSES, pain, beurre] }] });
  await act(async () => jest.runOnlyPendingTimers());
  await attendrePage();
  const vus = [];
  Element.prototype.scrollIntoView = function () { vus.push(this.querySelector(".course-nom").textContent.trim()); };
  const compteur = () => document.getElementById("badgeNbCourses").textContent;
  fireEvent.click(carte("Riz").querySelector(".course-nom-emoji"));
  const champ = carte("Riz").querySelector(".input-commentaire");
  fireEvent.change(champ, { target: { value: "Thaï" } });
  await act(async () => fireEvent.blur(champ));
  const bulle = () => document.querySelector(".badge-ajout")?.textContent ?? null;
  expect(compteur()).toBe("3");
  expect(bulle()).toBe("+2");
  act(() => jest.advanceTimersByTime(499));
  expect(vus).toEqual([]);
  act(() => jest.advanceTimersByTime(1));
  expect(vus).toEqual(["🧈 Beurre"]);
  expect(compteur()).toBe("4");
  expect(bulle()).toBe("+1");
  expect(carte("Beurre")).not.toHaveClass("vient-d-arriver");
  act(() => jest.advanceTimersByTime(450));
  expect(carte("Beurre")).toHaveClass("vient-d-arriver");
  // 2 articles : 2 s d'écart.
  act(() => jest.advanceTimersByTime(1549));
  expect(vus).toEqual(["🧈 Beurre"]);
  act(() => jest.advanceTimersByTime(1));
  expect(vus).toEqual(["🧈 Beurre", "🍞 Pain"]);
  expect(compteur()).toBe("5");
  expect(bulle()).toBeNull();
  act(() => jest.advanceTimersByTime(450 + 2400));
  expect(carte("Pain")).not.toHaveClass("vient-d-arriver");
  delete Element.prototype.scrollIntoView;
});
