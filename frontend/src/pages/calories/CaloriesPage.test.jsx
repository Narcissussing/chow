import { act, fireEvent, screen, within } from "@testing-library/react";
import { abonnerToast } from "../../toast.js";
import { rendreApp, simulerApi } from "../../testUtils.jsx";

// Dernière fin de geste de chaque liste triable rendue (Cuisine, fiche recette).
const mockFinsDeGlisse = new Map();
jest.mock("@dnd-kit/core", () => {
  const reel = jest.requireActual("@dnd-kit/core");
  return {
    ...reel,
    DndContext: function DndContextTest({ onDragEnd, ...props }) {
      mockFinsDeGlisse.set(require("react").useId(), onDragEnd);
      return <reel.DndContext {...props} onDragEnd={onDragEnd} />;
    },
  };
});

const huile = { food_id: "huile", nom: "Huile", emoji: "🫒", categorie: "Lipides", grammes_par_cuil_a_cafe: "4.5", grammes_par_cuil_a_soupe: "13.5", poids_unite_g: "0.00", unite_piece: null, tracking_type: "cl" };
const oeuf = { food_id: "oeuf", nom: "Oeuf", emoji: "🥚", categorie: "Oeufs", grammes_par_cuil_a_cafe: null, grammes_par_cuil_a_soupe: null, poids_unite_g: "60.00", unite_piece: "pièce", tracking_type: "unite" };
const entree = (id, aliment, g, kcal) => ({ id, ...aliment, quantite_g: String(g), calories_calc: String(kcal), glucides_calc: "1.0", proteines_calc: "2.0", lipides_calc: "3.0" });

const JOURNAL = [entree(1, huile, 13.5, 120), entree(2, oeuf, 60, 85.8)];
const RECETTES = [
  { id: 7, nom: "Omelette", categorie: "plat", etapes: "Battre\nCuire", nb_ingredients: "2", kcal_total: "210", food_ids: ["huile", "oeuf"], emojis_ingredients: ["🫒", "🥚"] },
  { id: 8, nom: "Citronnade", categorie: "fraicheur", etapes: "", nb_ingredients: "2", kcal_total: "40", food_ids: ["citron", "eau"], emojis_ingredients: ["🍋", "💧"] },
];
const ALIMENTS = [
  { id: "huile", nom: "Huile", emoji: "🫒", tracking_type: "cl", grammes_par_cuil_a_cafe: "4.5", grammes_par_cuil_a_soupe: "13.5", poids_unite_g: "0.00", unite: null },
  { id: "oeuf", nom: "Oeuf", emoji: "🥚", tracking_type: "unite", grammes_par_cuil_a_cafe: null, grammes_par_cuil_a_soupe: null, poids_unite_g: "60.00", unite: "pièce" },
  { id: "riz", nom: "Riz", emoji: "🍚", tracking_type: "pack", grammes_par_cuil_a_cafe: null, grammes_par_cuil_a_soupe: null, poids_unite_g: "0.00", unite: null },
];

let requetes;
function ouvrir(surcharges = {}, { journal = JOURNAL, recettes = RECETTES } = {}) {
  requetes = [];
  const noter = (chemin, reponse) => (options) => {
    if (options.body) requetes.push({ chemin, corps: JSON.parse(options.body) });
    return typeof reponse === "function" ? reponse(options) : reponse;
  };
  const reponses = {
    "/calories/ajouter": [200, { succes: true, item: entree(9, { food_id: "riz", nom: "Riz", emoji: "🍚", categorie: "Féculents", grammes_par_cuil_a_cafe: null, grammes_par_cuil_a_soupe: null, poids_unite_g: "0.00", unite_piece: null, tracking_type: "pack" }, 100, 130) }],
    "/calories/modifier": (o) => [200, { succes: true, item: { calories_calc: String(JSON.parse(o.body).nouvelleQuantite * 2), glucides_calc: "0", proteines_calc: "0", lipides_calc: "0" } }],
    "/calories/supprimer": [200, { succes: true }],
    "/calories/reordonner": [200, { succes: true }],
    "/calories/vider": [200, { succes: true }],
    "/calories/ajouter-recette": [200, { succes: true, items: [entree(20, huile, 5, 45)] }],
    "/recettes/7": [200, { succes: true, recette: { id: 7, nom: "Omelette", categorie: "plat", etapes: "Battre\nCuire" }, ingredients: [{ food_id: "huile", nom: "Huile", emoji: "🫒", quantite_g: "10.00", grammes_par_cuil_a_cafe: "4.5", grammes_par_cuil_a_soupe: "13.5", poids_unite_g: "0.00", unite_piece: null, tracking_type: "cl" }, { food_id: "oeuf", nom: "Oeuf", emoji: "🥚", quantite_g: "120.00", grammes_par_cuil_a_cafe: null, grammes_par_cuil_a_soupe: null, poids_unite_g: "60.00", unite_piece: "pièce", tracking_type: "unite" }] }],
    "/recettes/8": [200, { succes: true, recette: { id: 8, nom: "Citronnade", categorie: "fraicheur", etapes: "" }, ingredients: [] }],
    "/recettes/creer": [200, { succes: true, recette: { id: 30, nb_ingredients: "2", kcal_total: "99" } }],
    "/recettes/7/modifier": [200, { succes: true, recette: { etapes: "Battre", nb_ingredients: "2", kcal_total: "210" } }],
    "/recettes/7/supprimer": [200, { succes: true }],
    ...surcharges,
  };
  const simules = { "/session": [200, { utilisateur: { id: 1 } }], "/calories": [200, { journal, aliments: ALIMENTS, recettes }] };
  for (const [chemin, reponse] of Object.entries(reponses)) simules[chemin] = noter(chemin, reponse);
  simulerApi(simules);
  return rendreApp("/calories");
}

const attendrePage = () => screen.findByText("Chow — Fait maison 🏠");
const ligne = (nom) => [...document.querySelectorAll(".journal-item")].find((l) => l.querySelector(".journal-nom").textContent.includes(nom));
const total = (id) => document.getElementById(id).textContent;
const listeOuverte = () => document.querySelector(".custom-select__list");
const carteRecette = (nom) => [...document.querySelectorAll(".recette-card")].find((c) => c.querySelector(".recette-nom")?.textContent === nom);
function choisirDans(select, libelle) {
  fireEvent.click(select.nextElementSibling.querySelector(".custom-select__button"));
  fireEvent.click(within(listeOuverte()).getByText(libelle));
}

afterEach(() => {
  jest.useRealTimers();
  localStorage.clear();
  jest.restoreAllMocks();
});

test("totaux au format EJS ; unités tsp/tbs/pièce selon l'aliment ; poignée de glisser sur chaque ligne", async () => {
  ouvrir();
  await attendrePage();
  expect([total("totalKcal"), total("totalGlucides"), total("totalProteines"), total("totalLipides")]).toEqual(["206", "2.0g", "4.0g", "6.0g"]);
  const unites = (nom) => [...ligne(nom).querySelectorAll("select.journal-unite-select option")].map((o) => o.textContent);
  expect(unites("Huile")).toEqual(["g", "tsp", "tbs"]);
  expect(unites("Oeuf")).toEqual(["g", "pièce"]);
  expect(ligne("Huile").querySelector(".poignee-glisser")).toHaveAttribute("aria-label", "Glisser pour déplacer");
  expect(ligne("Oeuf").querySelector(".poignee-glisser")).toBeInTheDocument();
  expect(document.getElementById("noResultsJournal")).toHaveClass("hidden");
});

test("unités : tbs affiche 1 pour 13,5 g, minimum converti ; la sortie du champ envoie des grammes", async () => {
  ouvrir();
  await attendrePage();
  const champ = ligne("Huile").querySelector(".journal-grammes-input");
  choisirDans(ligne("Huile").querySelector("select.journal-unite-select"), "tbs");
  expect(champ).toHaveValue(1);
  expect(champ).toHaveAttribute("min", "0.0185");
  fireEvent.input(champ, { target: { value: "2" } });
  await act(async () => fireEvent.change(champ));
  expect(requetes).toEqual([{ chemin: "/calories/modifier", corps: { idEntree: "1", nouvelleQuantite: 27 } }]);
  expect(ligne("Huile").querySelector(".journal-kcal")).toHaveTextContent("54 kcal");
  expect(total("totalKcal")).toBe("140");
});

test("ajout : 100 g en fin de liste ; doublon → toast « Déjà en cuisine aujourd'hui. »", async () => {
  const toasts = [];
  const desabonner = abonnerToast((m) => m && toasts.push(m));
  ouvrir();
  await attendrePage();
  const champ = document.getElementById("rechercheAlimentCalories");
  fireEvent.change(champ, { target: { value: "huile" } });
  fireEvent.click(within(document.getElementById("listeAlimentsCalories")).getByText(/Huile/));
  expect(toasts).toEqual(["Déjà en cuisine aujourd'hui."]);
  fireEvent.change(champ, { target: { value: "riz" } });
  await act(async () => fireEvent.click(within(document.getElementById("listeAlimentsCalories")).getByText(/Riz/)));
  expect(requetes).toEqual([{ chemin: "/calories/ajouter", corps: { idAliment: "riz", quantiteG: 100 } }]);
  expect([...document.querySelectorAll(".journal-nom")].map((n) => n.textContent.trim())).toEqual(["🫒 Huile", "🥚 Oeuf", "🍚 Riz"]);
  expect(champ).toHaveValue("");
  desabonner();
});

test("glisser : ordre local immédiat et POST de l'ordre complet", async () => {
  mockFinsDeGlisse.clear();
  ouvrir();
  await attendrePage();
  // jsdom ne mesure aucune position : on déclenche directement la fin du geste (Oeuf lâché sur Huile).
  await act(async () => mockFinsDeGlisse.forEach((finir) => finir({ active: { id: 2 }, over: { id: 1 } })));
  expect([...document.querySelectorAll(".journal-nom")].map((n) => n.textContent.trim())).toEqual(["🥚 Oeuf", "🫒 Huile"]);
  expect(requetes).toEqual([{ chemin: "/calories/reordonner", corps: { ids: [2, 1] } }]);
});

test("retrait : totaux immédiats, ligne retirée à 300 ms ; « Tout effacer » demande confirmation", async () => {
  jest.useFakeTimers();
  ouvrir();
  await act(async () => jest.runOnlyPendingTimers());
  await attendrePage();
  await act(async () => fireEvent.click(ligne("Oeuf").querySelector(".form-supprimer-journal button")));
  expect(ligne("Oeuf")).toHaveClass("disparait");
  expect(total("totalKcal")).toBe("120");
  act(() => jest.advanceTimersByTime(300));
  expect(ligne("Oeuf")).toBeUndefined();

  const confirmer = jest.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.click(document.getElementById("btnToutEffacer"));
  expect(confirmer).toHaveBeenCalledWith("Vider la cuisine d'aujourd'hui ?");
  expect(requetes.some((r) => r.chemin === "/calories/vider")).toBe(false);
});

test("recette appliquée : remplace la Cuisine, sélecteur remis à vide ; panne → « Une erreur est survenue. »", async () => {
  ouvrir();
  await attendrePage();
  const select = document.getElementById("selectRecettePlat");
  expect(select.nextElementSibling.querySelector("button")).toHaveAttribute("aria-label", "Remplacer la cuisine du jour par une recette");
  fireEvent.click(select.nextElementSibling.querySelector(".custom-select__button"));
  await act(async () => fireEvent.click(within(listeOuverte()).getByText("Omelette")));
  expect(requetes).toEqual([{ chemin: "/calories/ajouter-recette", corps: { idRecette: "7" } }]);
  expect([...document.querySelectorAll(".journal-nom")].map((n) => n.textContent.trim())).toEqual(["🫒 Huile"]);
  expect(select).toHaveValue("");
});

test("« Enregistrer comme recette » : visible dès 3 aliments distincts hors combinaison connue", async () => {
  const trois = [...JOURNAL, entree(3, { food_id: "riz", nom: "Riz", emoji: "🍚", categorie: "Féculents", grammes_par_cuil_a_cafe: null, grammes_par_cuil_a_soupe: null, poids_unite_g: "0.00", unite_piece: null, tracking_type: "pack" }, 80, 104)];
  ouvrir({}, { journal: trois });
  await attendrePage();
  const bouton = document.getElementById("btnEnregistrerRecette");
  expect(bouton).not.toHaveClass("hidden");
  fireEvent.click(bouton);
  expect(document.getElementById("sheet")).toHaveClass("ouvert");
  expect(document.body).not.toHaveClass("scroll-bloque");
  expect([...document.querySelectorAll(".ingredient-nom-recette")].map((n) => n.textContent)).toEqual(["🫒 Huile", "🥚 Oeuf", "🍚 Riz"]);
  expect([...document.querySelectorAll(".ingredient-quantite-recette")].map((c) => c.value)).toEqual(["13.5", "60", "80"]);
});

test("grilles : deux sections, tri par icône (reclic inverse), vue mémorisée par section", async () => {
  ouvrir({}, { recettes: [...RECETTES, { id: 9, nom: "Blanquette", categorie: "plat", etapes: "", nb_ingredients: "5", kcal_total: "600", food_ids: [], emojis_ingredients: [] }] });
  await attendrePage();
  fireEvent.click(screen.getByRole("button", { name: "Recettes" }));
  const [plats, fraicheur] = document.querySelectorAll(".recette-groupe");
  const noms = () => [...plats.querySelectorAll(".recette-nom")].map((n) => n.textContent);
  expect(noms()).toEqual(["Blanquette", "Omelette"]);
  expect(plats.querySelector(".recette-card .icone-categorie-recette--plat")).not.toBeNull();
  const triKcal = plats.querySelector('.recette-tri-icone[title="Trier par calories"]');
  fireEvent.click(triKcal);
  expect(noms()).toEqual(["Omelette", "Blanquette"]);
  fireEvent.click(triKcal);
  expect(noms()).toEqual(["Blanquette", "Omelette"]);
  expect(triKcal.querySelector("img")).toHaveAttribute("src", "/images/svg/calorie-desc.svg");
  fireEvent.click(fraicheur.querySelector('.recette-vue-icone[title="Vue liste"]'));
  expect(fraicheur.querySelector(".recette-grid")).toHaveClass("vue-liste");
  expect(plats.querySelector(".recette-grid")).not.toHaveClass("vue-liste");
  expect(localStorage.getItem("vueRecettes-fraicheur")).toBe("liste");
});

test("lecture : ingrédients, étapes numérotées ou message vide ; A puis B rapide → B", async () => {
  ouvrir();
  await attendrePage();
  fireEvent.click(screen.getByRole("button", { name: "Recettes" }));
  await act(async () => {
    fireEvent.click(carteRecette("Omelette"));
    fireEvent.click(carteRecette("Citronnade"));
  });
  expect(document.getElementById("recetteLectureNom")).toHaveTextContent("Citronnade");
  expect(document.getElementById("recetteLectureEtapes")).toHaveClass("hidden");
  expect(document.getElementById("recetteLectureEtapesVides")).not.toHaveClass("hidden");

  await act(async () => fireEvent.click(carteRecette("Omelette")));
  expect(document.getElementById("recetteLectureMeta")).toHaveTextContent("2 ingrédients · 210 kcal");
  expect([...document.querySelectorAll("#recetteLectureEtapes li")].map((l) => l.textContent)).toEqual(["Battre", "Cuire"]);
  expect(document.getElementById("formRecette")).toHaveClass("hidden");
  fireEvent.click(document.getElementById("sheetBackdrop"));
  expect(document.getElementById("sheet")).not.toHaveClass("ouvert");
});

test("création : « Enregistrer » à partir de 2 ingrédients, unités converties en grammes, carte et option ajoutées", async () => {
  ouvrir({}, { recettes: [RECETTES[1]] });
  await attendrePage();
  const select = document.getElementById("selectRecettePlat");
  expect(select).toBeDisabled();
  expect(select).toHaveTextContent("Aucune recette de plat");
  fireEvent.click(screen.getByRole("button", { name: "Recettes" }));
  fireEvent.click(document.querySelectorAll(".btn-nouvelle-recette")[0]);
  const enregistrer = document.getElementById("btnEnregistrerSheet");
  expect(enregistrer).toBeDisabled();

  const ajouterIngredient = (texte, nom) => {
    fireEvent.click(document.getElementById("btnToggleAjoutIngredient"));
    fireEvent.change(document.getElementById("rechercheIngredient"), { target: { value: texte } });
    fireEvent.click(within(document.getElementById("listeIngredientsRecherche")).getByText(nom));
  };
  ajouterIngredient("huile", /Huile/);
  ajouterIngredient("oeuf", /Oeuf/);
  expect(enregistrer).not.toBeDisabled();
  const [qteHuile, qteOeuf] = document.querySelectorAll(".ingredient-quantite-recette");
  fireEvent.change(qteHuile, { target: { value: "1" } });
  choisirDans(document.querySelectorAll("select.ingredient-unite-recette")[0], "tbs");
  fireEvent.change(qteHuile, { target: { value: "1" } });
  choisirDans(document.querySelectorAll("select.ingredient-unite-recette")[1], "pièce");
  fireEvent.change(qteOeuf, { target: { value: "2" } });
  fireEvent.change(document.getElementById("recetteNom"), { target: { value: "Œufs à l'huile" } });

  await act(async () => fireEvent.submit(document.getElementById("formRecette")));
  expect(requetes.at(-1)).toEqual({
    chemin: "/recettes/creer",
    corps: { nom: "Œufs à l'huile", categorie: "plat", etapes: "", ingredients: [{ food_id: "huile", quantite_g: 13.5 }, { food_id: "oeuf", quantite_g: 120 }] },
  });
  expect(document.getElementById("sheet")).not.toHaveClass("ouvert");
  expect(carteRecette("Œufs à l'huile")).not.toBeUndefined();
  expect(select).not.toBeDisabled();
  expect([...select.options].map((o) => o.textContent)).toEqual(["", "Œufs à l'huile"]);
});

test("édition puis suppression : carte et option retirées, confirmation demandée", async () => {
  jest.useFakeTimers();
  ouvrir();
  await act(async () => jest.runOnlyPendingTimers());
  await attendrePage();
  fireEvent.click(screen.getByRole("button", { name: "Recettes" }));
  await act(async () => fireEvent.click(carteRecette("Omelette")));
  fireEvent.click(document.getElementById("btnModifierRecette"));
  expect(document.getElementById("recetteNom")).toHaveValue("Omelette");
  expect(document.getElementById("btnSupprimerRecetteSheet")).not.toHaveClass("hidden");
  // En édition, Entrée dans le nom n'enregistre rien.
  const entree = fireEvent.keyDown(document.getElementById("recetteNom"), { key: "Enter" });
  expect(entree).toBe(false);

  jest.spyOn(window, "confirm").mockReturnValue(true);
  await act(async () => fireEvent.click(document.getElementById("btnSupprimerRecetteSheet")));
  expect(requetes.at(-1)).toEqual({ chemin: "/recettes/7/supprimer", corps: {} });
  expect(carteRecette("Omelette")).toHaveClass("disparait");
  expect([...document.getElementById("selectRecettePlat").options].map((o) => o.textContent)).toEqual([""]);
  act(() => jest.advanceTimersByTime(300));
  expect(carteRecette("Omelette")).toBeUndefined();
});
