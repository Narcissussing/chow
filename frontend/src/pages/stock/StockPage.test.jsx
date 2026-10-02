import { act, fireEvent, screen, within } from "@testing-library/react";
import { abonnerToast } from "../../toast.js";
import { rendreApp, simulerApi } from "../../testUtils.jsx";

const STOCK = [
  { id: 1, food_id: "lait", nom: "Lait", emoji: "🥛", image: null, tracking_type: "cl", emplacement: "fg", quantite: "presque vide", jours_depuis: 3, deja_en_courses: false },
  { id: 2, food_id: "oeuf", nom: "Œuf", emoji: "🥚", image: null, tracking_type: "unite", emplacement: "fg", quantite: "6", jours_depuis: 0, deja_en_courses: false },
  { id: 3, food_id: "riz", nom: "Riz", emoji: "🍚", image: null, tracking_type: "pack", emplacement: "st", quantite: "1", jours_depuis: 10, deja_en_courses: true },
];
const ALIMENTS = [
  { id: "lait", nom: "Lait", emoji: "🥛", tracking_type: "cl" },
  { id: "pates", nom: "Pâtes", emoji: "🍝", tracking_type: "pack" },
];

let requetes;
function ouvrirStock(surcharges = {}) {
  requetes = [];
  const noter = (chemin, reponse) => (options) => {
    requetes.push({ chemin, corps: JSON.parse(options.body) });
    return typeof reponse === "function" ? reponse(options) : reponse;
  };
  simulerApi({
    "/session": [200, { utilisateur: { id: 1 } }],
    "/stock": [200, { stock: STOCK, aliments: ALIMENTS }],
    "/stock/modifier": noter("/stock/modifier", (o) => [200, { succes: true, quantite: JSON.parse(o.body).nouvelleQuantite }]),
    "/stock/supprimer": noter("/stock/supprimer", [200, { succes: true }]),
    "/stock/ajouter": noter("/stock/ajouter", [200, { succes: true, item: { id: 9, food_id: "pates", nom: "Pâtes", emoji: "🍝", image: null, quantite: 1, unite: "packs", tracking_type: "pack", emplacement: "st", jours_depuis: 0 } }]),
    "/courses/ajouter": noter("/courses/ajouter", [200, { succes: true, item: {} }]),
    ...surcharges,
  });
  rendreApp("/stock");
}

const carte = (nom) => screen.getByText(nom).closest(".stock-item");
const nomsVisibles = () => [...document.querySelectorAll(".stock-item:not(.hidden) .stock-nom")].map((n) => n.textContent);
const attendrePage = () => screen.findByText("Chow — Fait maison 🏠");

test("filtres à choix unique et recherche sans accents", async () => {
  ouvrirStock();
  await attendrePage();
  // localeCompare range « Œuf » comme « oeuf », entre Lait et Riz.
  expect(nomsVisibles()).toEqual(["Lait", "Œuf", "Riz"]);
  fireEvent.click(screen.getByRole("button", { name: "🫙 Niveau" }));
  expect(nomsVisibles()).toEqual(["Lait"]);
  fireEvent.click(screen.getByRole("button", { name: "📦 Réserve" }));
  expect(nomsVisibles()).toEqual(["Riz"]);
  expect(screen.getByRole("button", { name: "🫙 Niveau" })).not.toHaveClass("active");
  fireEvent.click(screen.getByRole("button", { name: "Tous" }));
  fireEvent.change(document.getElementById("searchInput"), { target: { value: "oeuf" } });
  expect(nomsVisibles()).toEqual([]);
  expect(document.getElementById("noResultsStock")).not.toHaveClass("hidden");
});

test("tri par quantité : niveaux « cl » rangés par remplissage, égalité départagée par nom", async () => {
  ouvrirStock();
  await attendrePage();
  fireEvent.click(document.querySelector(".sort-wrapper .custom-select__button"));
  fireEvent.click(within(document.querySelector(".custom-select__list")).getByText("Quantité ↗"));
  expect(nomsVisibles()).toEqual(["Lait", "Riz", "Œuf"]);
  fireEvent.click(document.querySelector(".sort-wrapper .custom-select__button"));
  fireEvent.click(within(document.querySelector(".custom-select__list")).getByText("Ancien"));
  expect(nomsVisibles()).toEqual(["Riz", "Lait", "Œuf"]);
});

test("vue liste mémorisée sous la clé vueStock", async () => {
  localStorage.removeItem("vueStock");
  ouvrirStock();
  await attendrePage();
  fireEvent.click(document.getElementById("btnVueListe"));
  expect(document.getElementById("listeStock")).toHaveClass("vue-liste");
  expect(localStorage.getItem("vueStock")).toBe("liste");
});

test("édition : ouvrir B sauvegarde A ; valeur inchangée = aucune requête", async () => {
  ouvrirStock();
  await attendrePage();
  fireEvent.click(carte("Œuf"));
  expect(carte("Œuf")).toHaveClass("en-edition");
  fireEvent.change(document.querySelector(".stock-quantite-edit"), { target: { value: "4" } });
  await act(async () => fireEvent.click(carte("Riz")));
  expect(requetes).toEqual([{ chemin: "/stock/modifier", corps: { idStock: "2", nouvelleQuantite: "4" } }]);
  expect(carte("Œuf").querySelector(".stock-quantite")).toHaveTextContent("4");
  expect(carte("Œuf")).toHaveClass("maj-flash");

  await act(async () => fireEvent.click(document.body));
  expect(carte("Riz")).not.toHaveClass("en-edition");
  expect(requetes).toHaveLength(1);
});

test("soustraction bornée : −5 absent sous 5, −1 enregistre et ferme", async () => {
  ouvrirStock();
  await attendrePage();
  fireEvent.click(carte("Riz"));
  const boutons = [...carte("Riz").querySelectorAll(".stock-quick-subtract .suggestion")].map((b) => b.textContent);
  expect(boutons).toEqual(["−1"]);
  await act(async () => fireEvent.click(carte("Riz").querySelector(".stock-quick-subtract .suggestion")));
  expect(requetes).toEqual([{ chemin: "/stock/modifier", corps: { idStock: "3", nouvelleQuantite: "0" } }]);
});

test("erreur serveur : alert et valeur précédente rétablie", async () => {
  const alerte = jest.spyOn(window, "alert").mockImplementation(() => {});
  ouvrirStock({ "/stock/modifier": [400, { erreur: "Champs requis." }] });
  await attendrePage();
  fireEvent.click(carte("Œuf"));
  fireEvent.change(document.querySelector(".stock-quantite-edit"), { target: { value: "2" } });
  await act(async () => fireEvent.click(document.body));
  expect(alerte).toHaveBeenCalledWith("Champs requis.");
  expect(carte("Œuf").querySelector(".stock-quantite")).toHaveTextContent("6");
  alerte.mockRestore();
});

test("niveau « cl » : sélecteur dans la carte, choisir n'ouvre ni ne ferme la carte", async () => {
  ouvrirStock();
  await attendrePage();
  fireEvent.click(carte("Lait"));
  fireEvent.click(carte("Lait").querySelector(".custom-select__button"));
  fireEvent.click(within(document.querySelector(".custom-select__list")).getByText("Plein"));
  expect(carte("Lait")).toHaveClass("en-edition");
  await act(async () => fireEvent.click(document.body));
  expect(requetes).toEqual([{ chemin: "/stock/modifier", corps: { idStock: "1", nouvelleQuantite: "plein" } }]);
});

test("« Ajouter aux courses » : seulement si bas et pas déjà en courses, sans fermer la carte", async () => {
  jest.useFakeTimers();
  ouvrirStock();
  await act(async () => jest.runOnlyPendingTimers());
  await attendrePage();
  fireEvent.click(carte("Riz"));
  expect(carte("Riz").querySelector(".btn-ajouter-courses")).toBeNull();
  fireEvent.click(carte("Lait"));
  const bouton = carte("Lait").querySelector(".btn-ajouter-courses");
  await act(async () => fireEvent.click(bouton));
  expect(requetes.filter((r) => r.chemin === "/courses/ajouter")).toEqual([{ chemin: "/courses/ajouter", corps: { idAliment: "lait" } }]);
  expect(carte("Lait")).toHaveClass("en-edition");
  expect(bouton).toHaveClass("disparait");
  act(() => jest.advanceTimersByTime(200));
  expect(carte("Lait").querySelector(".btn-ajouter-courses")).toBeNull();
  jest.useRealTimers();
});

test("suppression : animation puis retrait à 300 ms", async () => {
  jest.useFakeTimers();
  ouvrirStock();
  await act(async () => jest.runOnlyPendingTimers());
  await attendrePage();
  await act(async () => fireEvent.click(carte("Riz").querySelector(".btn-supprimer-icone")));
  expect(carte("Riz")).toHaveClass("disparait");
  expect(carte("Riz")).not.toHaveClass("en-edition");
  act(() => jest.advanceTimersByTime(300));
  expect(screen.queryByText("Riz")).toBeNull();
  jest.useRealTimers();
});

test("ajout : doublon par nom → toast ; nouvel aliment → un seul POST au double tap", async () => {
  const toasts = [];
  const desabonner = abonnerToast((m) => m && toasts.push(m));
  ouvrirStock();
  await attendrePage();
  fireEvent.click(document.getElementById("btnToggleAjout"));
  expect(document.getElementById("autocomplete")).not.toHaveAttribute("hidden");
  expect(document.getElementById("rechercheStockWrapper")).toHaveAttribute("hidden");
  fireEvent.change(document.getElementById("rechercheAliment"), { target: { value: "lait" } });
  fireEvent.click(within(document.getElementById("listeAliments")).getByText(/Lait/));
  expect(toasts).toEqual(["Déjà dans le stock."]);
  expect(document.getElementById("autocomplete")).toHaveAttribute("hidden");

  fireEvent.click(document.getElementById("btnToggleAjout"));
  fireEvent.change(document.getElementById("rechercheAliment"), { target: { value: "pates" } });
  const suggestion = within(document.getElementById("listeAliments")).getByText(/Pâtes/);
  await act(async () => {
    fireEvent.click(suggestion);
    fireEvent.click(suggestion);
  });
  expect(requetes.filter((r) => r.chemin === "/stock/ajouter")).toEqual([{ chemin: "/stock/ajouter", corps: { idAliment: "pates", quantiteAliment: 1 } }]);
  expect(carte("Pâtes")).toHaveClass("entree");
  expect(nomsVisibles()).toEqual(["Lait", "Œuf", "Pâtes", "Riz"]);
  desabonner();
});

test("ajout : panne réseau → toast « Connexion instable »", async () => {
  const toasts = [];
  const desabonner = abonnerToast((m) => m && toasts.push(m));
  ouvrirStock({
    "/stock/ajouter": () => {
      throw new TypeError("Failed to fetch");
    },
  });
  await attendrePage();
  fireEvent.click(document.getElementById("btnToggleAjout"));
  fireEvent.change(document.getElementById("rechercheAliment"), { target: { value: "pates" } });
  await act(async () => fireEvent.click(within(document.getElementById("listeAliments")).getByText(/Pâtes/)));
  expect(toasts).toEqual(["Connexion instable : réessaie dans un instant."]);
  desabonner();
});

test("ajout : clic sur le fond assombri referme la recherche d'ajout", async () => {
  ouvrirStock();
  await attendrePage();
  fireEvent.click(document.getElementById("btnToggleAjout"));
  expect(document.getElementById("ajoutBackdropStock")).toHaveClass("ouvert");
  fireEvent.click(document.getElementById("ajoutBackdropStock"));
  expect(document.getElementById("autocomplete")).toHaveAttribute("hidden");
  expect(document.getElementById("btnToggleAjout")).not.toHaveClass("actif");
});

const SUGGESTIONS = [
  { food_id: "lait", nom: "Lait", emoji: "🥛", tracking_type: "cl", quantite: "presque vide", achats_30j: 0, achats_total: 9 },
  { food_id: "beurre", nom: "Beurre", emoji: "🧈", tracking_type: "unite", quantite: null, achats_30j: 2, achats_total: 4 },
  { food_id: "oeuf", nom: "Œuf", emoji: "🥚", tracking_type: "unite", quantite: "6", achats_30j: 5, achats_total: 20 },
];

test("À racheter : bas ou épuisés seulement, achetés ce mois d'abord, « + » envoie aux Courses", async () => {
  ouvrirStock({ "/stock": [200, { stock: STOCK, aliments: ALIMENTS, suggestions: SUGGESTIONS }] });
  await attendrePage();
  const encart = screen.getByRole("region", { name: "À racheter" });
  const noms = [...encart.querySelectorAll(".stock-suggestions__nom")].map((n) => n.textContent);
  // Œuf (6 restants) n'est pas bas ; Beurre acheté ce mois passe avant Lait.
  expect(noms).toEqual(["🧈 Beurre", "🥛 Lait"]);
  expect(within(encart).getByText("épuisé")).toBeInTheDocument();
  expect(within(encart).getByText("2× ce mois")).toBeInTheDocument();
  fireEvent.click(within(encart).getByRole("button", { name: "Ajouter « Lait » aux courses" }));
  await act(async () => {});
  expect(requetes).toContainEqual({ chemin: "/courses/ajouter", corps: { idAliment: "lait" } });
});

test("filtre Bas et compteur : ambre et nombre filtré dès qu'un filtre est actif", async () => {
  ouvrirStock();
  await attendrePage();
  const badge = document.querySelector(".badge-compteur--stock");
  expect(badge).toHaveTextContent("3");
  expect(badge).not.toHaveClass("badge-compteur--filtre");
  fireEvent.click(screen.getByRole("button", { name: "🔻 Bas" }));
  expect(nomsVisibles()).toEqual(["Lait", "Riz"]);
  expect(badge).toHaveTextContent("2");
  expect(badge).toHaveClass("badge-compteur--filtre");
  fireEvent.click(screen.getByRole("button", { name: "Tous" }));
  expect(badge).toHaveTextContent("3");
  expect(badge).not.toHaveClass("badge-compteur--filtre");
});
