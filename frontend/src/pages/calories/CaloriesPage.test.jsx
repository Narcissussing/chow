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

test("unités : tbs affiche 1 pour 13,5 g, minimum converti ; unité enregistrée, la sortie du champ envoie des grammes", async () => {
  ouvrir();
  await attendrePage();
  const champ = ligne("Huile").querySelector(".journal-grammes-input");
  choisirDans(ligne("Huile").querySelector("select.journal-unite-select"), "tbs");
  expect(champ).toHaveValue(1);
  expect(champ).toHaveAttribute("min", "0.0185");
  fireEvent.input(champ, { target: { value: "2" } });
  await act(async () => fireEvent.change(champ));
  expect(requetes).toEqual([
    { chemin: "/calories/modifier", corps: { idEntree: "1", nouvelleQuantite: 13.5, unite: "soupe" } },
    { chemin: "/calories/modifier", corps: { idEntree: "1", nouvelleQuantite: 27, unite: "soupe" } },
  ]);
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
    corps: { nom: "Œufs à l'huile", categorie: "plat", etapes: "", ingredients: [{ food_id: "huile", quantite_g: 13.5, unite: "soupe" }, { food_id: "oeuf", quantite_g: 120, unite: "piece" }] },
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

test("unité enregistrée : reprise dans la Cuisine et dans la lecture d'une recette", async () => {
  const huileEnTbs = { ...entree(1, huile, 27, 240), unite: "soupe" };
  ouvrir(
    { "/recettes/7": [200, { succes: true, recette: { id: 7, nom: "Omelette", categorie: "plat", etapes: "" }, ingredients: [{ food_id: "huile", nom: "Huile", emoji: "🫒", quantite_g: "27.00", unite: "soupe", grammes_par_cuil_a_cafe: "4.5", grammes_par_cuil_a_soupe: "13.5", poids_unite_g: "0.00", unite_piece: null, tracking_type: "cl" }, { food_id: "oeuf", nom: "Oeuf", emoji: "🥚", quantite_g: "120.00", unite: "piece", grammes_par_cuil_a_cafe: null, grammes_par_cuil_a_soupe: null, poids_unite_g: "60.00", unite_piece: "pièce", tracking_type: "unite" }] }] },
    { journal: [huileEnTbs] }
  );
  await attendrePage();
  expect(ligne("Huile").querySelector(".journal-grammes-input")).toHaveValue(2);
  expect(ligne("Huile").querySelector("select.journal-unite-select")).toHaveValue("soupe");
  fireEvent.click(screen.getByRole("button", { name: "Recettes" }));
  await act(async () => fireEvent.click(carteRecette("Omelette")));
  expect([...document.querySelectorAll(".recette-lecture-ing-qte")].map((q) => q.textContent)).toEqual(["2 tbs", "2 pièce"]);
});

test("RègleX : recette collée lue et reliée aux aliments, aliment manquant créé, adaptée puis envoyée à la Cuisine", async () => {
  const beurre = { id: "beurre", nom: "Beurre", emoji: "🧈", tracking_type: "unite", grammes_par_cuil_a_cafe: null, grammes_par_cuil_a_soupe: null, poids_unite_g: "0.00", unite: "g", calories: "717" };
  ouvrir({
    "/aliments": [200, { succes: true, aliment: beurre }],
    "/calories/ajouter-ingredients": [200, { succes: true, items: [entree(30, huile, 54, 486)] }],
  });
  await attendrePage();
  fireEvent.click(screen.getByRole("button", { name: "RègleX" }));
  const panneau = document.getElementById("panneauAdapter");
  expect(within(panneau).queryByLabelText("Ingrédients de la recette")).toBeNull();
  fireEvent.click(within(panneau).getByRole("button", { name: "Coller une recette" }));
  fireEvent.change(within(panneau).getByLabelText("Ingrédients de la recette"), { target: { value: "2 c. à soupe\nd'huile\n\n3\noeufs\n\n100 g\nde beurre" } });
  const qtes = () => [...panneau.querySelectorAll(".adapter__qte")].map((q) => q.textContent);
  // huile et oeuf reconnus (cuillères et pièces gardées), beurre inconnu.
  expect(qtes()).toEqual(["2 tbs", "3 pièce", "—"]);
  expect(panneau.querySelector(".adapter__reste")).toHaveTextContent("1 à compléter");
  expect(within(panneau).getByRole("button", { name: "Ajouter à la Cuisine" })).toBeDisabled();
  // Création du beurre (valeurs pour 100 g).
  fireEvent.click(within(panneau).getByRole("button", { name: "Ajouter « beurre » aux aliments" }));
  fireEvent.change(panneau.querySelector(".adapter__valeurs input"), { target: { value: "717" } });
  await act(async () => fireEvent.submit(panneau.querySelector(".adapter__creation")));
  expect(requetes.at(-1)).toEqual({ chemin: "/aliments", corps: { nom: "Beurre", categorie: "Divers", calories: "717", proteines: "", glucides: "", lipides: "" } });
  expect(qtes()).toEqual(["2 tbs", "3 pièce", "100 g"]);
  expect(panneau.querySelector(".adapter__reste")).toBeNull();
  // ×2 : sens visible, quantités de la recette grisées.
  fireEvent.click(within(panneau).getByRole("button", { name: "2" }));
  expect(qtes()).toEqual(["4 tbs", "6 pièce", "200 g"]);
  expect(within(panneau).getByRole("img", { name: "Recette agrandie" })).toBeInTheDocument();
  expect(panneau.querySelector(".adapter__base")).toHaveClass("grisee");
  // « J'ai seulement 40 g de beurre » : 40 / 100 = 0,4 pour tout.
  fireEvent.click(panneau.querySelectorAll(".adapter__qte")[2]);
  const champ = within(panneau).getByLabelText("Quantité de beurre que j'ai");
  fireEvent.change(champ, { target: { value: "40" } });
  fireEvent.blur(champ);
  expect(qtes()).toEqual(["0.8 tbs", "1.2 pièce", "40 g"]);
  expect(within(panneau).getByRole("img", { name: "Recette réduite" })).toBeInTheDocument();
  await act(async () => fireEvent.click(within(panneau).getByRole("button", { name: "Ajouter à la Cuisine" })));
  expect(requetes.at(-1)).toEqual({
    chemin: "/calories/ajouter-ingredients",
    corps: { ingredients: [{ food_id: "huile", quantite_g: 10.8, unite: "soupe" }, { food_id: "oeuf", quantite_g: 72, unite: "piece" }, { food_id: "beurre", quantite_g: 40, unite: "g" }] },
  });
  expect(document.querySelector(".calories-tab-panel.actif #listeJournal")).not.toBeNull();
});

test("RègleX, bouton recettes (plats) : la recette enregistrée garde ses unités et s'adapte", async () => {
  ouvrir();
  await attendrePage();
  fireEvent.click(screen.getByRole("button", { name: "RègleX" }));
  const panneau = document.getElementById("panneauAdapter");
  choisirDans(panneau.querySelector("select.select-recette-icone"), "Omelette");
  await act(async () => {});
  const qtes = () => [...panneau.querySelectorAll(".adapter__qte")].map((q) => q.textContent);
  expect(qtes()).toEqual(["10 g", "120 g"]);
  fireEvent.click(within(panneau).getByRole("button", { name: "1½" }));
  expect(qtes()).toEqual(["15 g", "180 g"]);
  expect(within(panneau).queryByRole("button", { name: "Enregistrer en recette" })).toBeNull();
});

test("recette ouverte : l'icône de cuisson l'envoie à la Cuisine, ferme le panneau et ouvre l'onglet Cuisine", async () => {
  ouvrir({ "/calories/ajouter-recette": [200, { succes: true, items: [entree(40, huile, 10, 90)] }] });
  await attendrePage();
  fireEvent.click(screen.getByRole("button", { name: "Recettes" }));
  await act(async () => fireEvent.click(carteRecette("Omelette")));
  const bouton = within(document.getElementById("recetteLecture")).getByRole("button", { name: "Ajouter à la Cuisine" });
  await act(async () => fireEvent.click(bouton));
  expect(requetes.at(-1)).toEqual({ chemin: "/calories/ajouter-recette", corps: { idRecette: "7" } });
  expect(document.getElementById("sheet")).not.toHaveClass("ouvert");
  expect(document.querySelector(".calories-tab-panel.actif #listeJournal")).not.toBeNull();
});

test("RègleX : un choix fait une fois est repris au collage suivant", async () => {
  localStorage.clear();
  ouvrir();
  await attendrePage();
  fireEvent.click(screen.getByRole("button", { name: "RègleX" }));
  const panneau = document.getElementById("panneauAdapter");
  fireEvent.click(within(panneau).getByRole("button", { name: "Coller une recette" }));
  const coller = (texte) => fireEvent.change(within(panneau).getByLabelText("Ingrédients de la recette"), { target: { value: texte } });
  coller("200 g de grains");
  expect(panneau.querySelector(".adapter__qte")).toHaveTextContent("—");
  choisirDans(panneau.querySelector("select.adapter__choix"), "🍚 Riz");
  expect(panneau.querySelector(".adapter__qte")).toHaveTextContent("200 g");
  coller("");
  coller("150 g de grains");
  expect(panneau.querySelector(".adapter__qte")).toHaveTextContent("150 g");
  localStorage.clear();
});

test("envoyer dans RègleX : depuis une recette ouverte et depuis la Cuisine du jour", async () => {
  ouvrir();
  await attendrePage();
  const panneau = () => document.getElementById("panneauAdapter");
  const qtes = () => [...panneau().querySelectorAll(".adapter__qte")].map((q) => q.textContent);
  // Cuisine du jour (Huile 13.5 g en tbs enregistrée ou non, Oeuf 60 g) → RègleX.
  fireEvent.click(within(document.querySelector(".journal-actions-row")).getByRole("button", { name: "Adapter dans RègleX" }));
  expect(panneau()).toHaveClass("actif");
  expect(qtes()).toEqual(["13.5 g", "60 g"]);
  // Recette ouverte → RègleX : panneau fermé, recette chargée.
  fireEvent.click(screen.getByRole("button", { name: "Recettes" }));
  await act(async () => fireEvent.click(carteRecette("Omelette")));
  fireEvent.click(within(document.getElementById("recetteLecture")).getByRole("button", { name: "Adapter dans RègleX" }));
  await act(async () => {});
  expect(document.getElementById("sheet")).not.toHaveClass("ouvert");
  expect(panneau()).toHaveClass("actif");
  expect(qtes()).toEqual(["10 g", "120 g"]);
  expect(panneau().querySelector("select.select-recette-icone")).toHaveClass("actif");
});

test("RègleX : « Tout effacer » fait tomber les lignes puis vide le texte, les lignes et le facteur", async () => {
  jest.useFakeTimers();
  ouvrir();
  await act(async () => jest.runOnlyPendingTimers());
  await attendrePage();
  fireEvent.click(screen.getByRole("button", { name: "RègleX" }));
  const panneau = document.getElementById("panneauAdapter");
  // Toujours présent pour que la rangée ne bouge pas : seulement désactivé quand il n'y a rien.
  expect(panneau.querySelector("#adapterEffacer")).toBeDisabled();
  const ordre = [...panneau.querySelector(".adapter__sources").children].map((e) => e.getAttribute("aria-label") || e.className);
  expect(ordre[0]).toBe("Coller une recette");
  expect(ordre.at(-1)).toBe("btn-x-rond");
  fireEvent.click(within(panneau).getByRole("button", { name: "Coller une recette" }));
  fireEvent.change(within(panneau).getByLabelText("Ingrédients de la recette"), { target: { value: "100 g de riz" } });
  fireEvent.click(within(panneau).getByRole("button", { name: "2" }));
  fireEvent.click(panneau.querySelector("#adapterEffacer"));
  expect(panneau.querySelector(".adapter__liste")).toHaveClass("adapter__liste--vidage");
  act(() => jest.advanceTimersByTime(420));
  expect(panneau.querySelectorAll(".adapter__ligne")).toHaveLength(0);
  expect(within(panneau).queryByLabelText("Ingrédients de la recette")).toBeNull();
  fireEvent.click(within(panneau).getByRole("button", { name: "Coller une recette" }));
  expect(within(panneau).getByLabelText("Ingrédients de la recette")).toHaveValue("");
});

test("RègleX : ✕ retire une ligne inutile (« sel » sans quantité) et débloque l'envoi à la Cuisine", async () => {
  ouvrir();
  await attendrePage();
  fireEvent.click(screen.getByRole("button", { name: "RègleX" }));
  const panneau = document.getElementById("panneauAdapter");
  fireEvent.click(within(panneau).getByRole("button", { name: "Coller une recette" }));
  fireEvent.change(within(panneau).getByLabelText("Ingrédients de la recette"), { target: { value: "100 g de riz\nsel" } });
  expect(within(panneau).getByRole("button", { name: "Ajouter à la Cuisine" })).toBeDisabled();
  fireEvent.click(within(panneau).getByRole("button", { name: "Retirer « sel »" }));
  expect(panneau.querySelectorAll(".adapter__ligne")).toHaveLength(1);
  expect(within(panneau).getByRole("button", { name: "Ajouter à la Cuisine" })).not.toBeDisabled();
});

test("RègleX : la précision de la recette s'affiche sous l'aliment (« de tournesol » → Huile + « tournesol »)", async () => {
  ouvrir();
  await attendrePage();
  fireEvent.click(screen.getByRole("button", { name: "RègleX" }));
  const panneau = document.getElementById("panneauAdapter");
  fireEvent.click(within(panneau).getByRole("button", { name: "Coller une recette" }));
  fireEvent.change(within(panneau).getByLabelText("Ingrédients de la recette"), { target: { value: "6 cuillères à soupe d’Huile de tournesol" } });
  expect(panneau.querySelector(".adapter__note")).toHaveTextContent("tournesol");
  expect(panneau.querySelector(".adapter__qte")).toHaveTextContent("6 tbs");
});

test("RègleX vide : l'animation des ingrédients s'affiche, puis disparaît dès qu'on colle", async () => {
  ouvrir();
  await attendrePage();
  fireEvent.click(screen.getByRole("button", { name: "RègleX" }));
  const panneau = document.getElementById("panneauAdapter");
  expect(panneau.querySelectorAll(".adapter__vide .adapter__vide-ing")).toHaveLength(3);
  fireEvent.click(within(panneau).getByRole("button", { name: "Coller une recette" }));
  expect(panneau.querySelector(".adapter__vide")).toBeNull();
});

test("Cuisine : double-tap sur une carte = ingrédient ajouté au plat (coché, enregistré) ; un double-tap de plus l'enlève", async () => {
  ouvrir({ "/calories/ajoute": [200, { succes: true }] });
  await attendrePage();
  const carte = ligne("Huile");
  // Un seul tap ne fait rien ; un tap sur le champ de quantité non plus.
  fireEvent.click(carte.querySelector(".journal-nom"));
  expect(carte).not.toHaveClass("ajoute");
  fireEvent.click(carte.querySelector(".journal-grammes-input"));
  fireEvent.click(carte.querySelector(".journal-grammes-input"));
  expect(carte).not.toHaveClass("ajoute");
  await act(async () => fireEvent.click(carte.querySelector(".journal-nom")));
  expect(ligne("Huile")).toHaveClass("ajoute");
  expect(ligne("Huile").querySelector(".journal-coche")).not.toBeNull();
  expect(requetes.at(-1)).toEqual({ chemin: "/calories/ajoute", corps: { idEntree: "1", ajoute: true } });
  await new Promise((r) => setTimeout(r, 400));
  fireEvent.click(ligne("Huile").querySelector(".journal-nom"));
  await act(async () => fireEvent.click(ligne("Huile").querySelector(".journal-nom")));
  expect(ligne("Huile")).not.toHaveClass("ajoute");
  expect(requetes.at(-1)).toEqual({ chemin: "/calories/ajoute", corps: { idEntree: "1", ajoute: false } });
});

test("RègleX : « Huile d’olive-10 ml (2 c. à thé) » → 2 tbs/tsp pour un solide mesuré à la cuillère, ml gardés pour un liquide", async () => {
  ouvrir();
  await attendrePage();
  fireEvent.click(screen.getByRole("button", { name: "RègleX" }));
  const panneau = document.getElementById("panneauAdapter");
  fireEvent.click(within(panneau).getByRole("button", { name: "Coller une recette" }));
  // L'huile du jeu de test n'est pas un liquide (unité g) et connaît la cuillère à café : la cuillère l'emporte.
  fireEvent.change(within(panneau).getByLabelText("Ingrédients de la recette"), { target: { value: "Huile d’olive-10 ml (2 c. à thé)\nRiz-150 ml (½ tasse)" } });
  expect([...panneau.querySelectorAll(".adapter__qte")].map((q) => q.textContent)).toEqual(["2 tsp", "150 g"]);
});

test("Cuisine vide : une des quatre animations de cuisson, tirée au hasard ; disparaît dès qu'un aliment est ajouté", async () => {
  ouvrir({}, { journal: [] });
  await attendrePage();
  const animation = document.querySelector(".cuisine-vide");
  expect(["marmite", "couvercle", "poele", "recette"]).toContain(animation.dataset.animation);
  expect(document.getElementById("noResultsJournal")).not.toHaveClass("hidden");
});

test("Calories : badge marmite avec le nombre d'aliments de la Cuisine du jour", async () => {
  ouvrir();
  await attendrePage();
  expect(document.querySelector(".badge-compteur--cuisine")).toHaveTextContent("2");
  expect(document.querySelector(".cuisine-vide")).toBeNull();
});

test("badge du titre : marmite (aliments de la Cuisine) sauf sur RègleX, où une balance compte les ingrédients", async () => {
  ouvrir();
  await attendrePage();
  const marmite = document.querySelector(".titre-page .badge-compteur--cuisine");
  expect(marmite).toHaveTextContent(String(document.querySelectorAll(".journal-item").length));
  fireEvent.click(screen.getByRole("button", { name: "RègleX" }));
  expect(document.querySelector(".titre-page .badge-compteur--cuisine")).toBeNull();
  const panneau = document.getElementById("panneauAdapter");
  fireEvent.click(within(panneau).getByRole("button", { name: "Coller une recette" }));
  fireEvent.change(within(panneau).getByLabelText("Ingrédients de la recette"), { target: { value: "100 g de riz\n2 oeufs" } });
  expect(document.querySelector(".titre-page .badge-compteur--regle")).toHaveTextContent("2");
  fireEvent.click(screen.getByRole("button", { name: "Recettes" }));
  expect(document.querySelector(".titre-page .badge-compteur--cuisine")).not.toBeNull();
});
