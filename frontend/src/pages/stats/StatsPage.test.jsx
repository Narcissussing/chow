import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { rendreApp, simulerApi } from "../../testUtils.jsx";

const seau = (debut, etiquette, total) => ({ debut, etiquette, total });
const STATS = {
  periode: { debut: "2026-01-01", fin: "2026-12-31", nature: "annee" },
  dernierAchat: "2026-10-13",
  premierAchat: "2025-03-02",
  kpi: { depense: 3195, variation: -6, parSemaine: 61, ecartSemaine: -4, inflation: 4.1 },
  barres: { pas: "mois", seaux: [seau("2026-01-01", "J", 372), seau("2026-02-01", "F", 298), seau("2026-03-01", "M", 412)], moyenne: 320, pic: "2026-03-01", selection: "2026-03-01", enCours: "2026-03-01" },
  semaineMax: { debut: "2026-03-09", total: 142, causes: [{ nom: "Steak haché", semaine: 40, moyenne: 16, ecart: 24, semaineAvant: 10 }] },
  inflation: [{ mois: "2026-01", etiquette: "J", indice: 100, national: 100, nationalEnsemble: 100 }, { mois: "2026-02", etiquette: "F", indice: 102, national: 100.6, nationalEnsemble: 100.3 }, { mois: "2026-03", etiquette: "M", indice: 104.1, national: null }],
  inflationNationale: { variation: 0.6, jusqua: "2026-02" },
  inflationNationaleEnsemble: { variation: 0.3, jusqua: "2026-02" },
  panierMensuel: 300,
  panierMensuelTout: 400,
  detailInflation: { nbProduits: 42, hausses: [{ nom: "Tomate", emoji: "🍅", unite: "kg", achats: 9, avant: 1.89, apres: 2.49, variation: 32 }], baisses: [] },
  parRayon: [{ nom: "Fruits & légumes", total: 500 }, { nom: "Autres", total: 300 }, { nom: "Non Chow", total: 200 }],
  parMagasin: [{ nom: "Leclerc", total: 790 }, { nom: "Carrefour", total: 210 }],
  produits: [
    { id: "tomate", nom: "Tomate", emoji: "🍅", achats: 78, depense: 120, prix: 2.49, unite: "kg", variation: 22, courbe: [1.89, 2.49] },
    { id: "mangue", nom: "Mangue", emoji: "🥭", achats: 100, depense: 200, prix: 2.19, unite: null, variation: -3, courbe: [2.29, 2.19] },
  ],
};
const FICHE = {
  id: "tomate", nom: "Tomate", emoji: "🍅", unite: "kg", prix: 2.49, variation: 31, depuis: "2025", achats: 78,
  courbe: [{ mois: "2026-01", etiquette: "janv.", prix: 1.89 }, { mois: "2026-02", etiquette: "févr.", prix: 2.49 }],
  parEnseigne: [{ nom: "Leclerc", prix: 1.89 }, { nom: "Marché Frais", prix: 2.49 }],
  derniersAchats: [{ jour: "2026-10-13", enseigne: "Marché Frais", total: 4.6, quantite: "1,846 kg" }],
  habitudes: { rythmeJours: 7, quantiteParAchat: 1.2, quantiteParMois: 4.3, depense12Mois: 210.8, achats12Mois: 35, dernierAchat: "2026-10-13", joursDepuis: 10, prochainAchat: "2026-10-20" },
};

let requetes;
function ouvrirStats() {
  requetes = [];
  simulerApi({
    "/session": [200, { utilisateur: { id: 1 } }],
    "/courses/estimation": [200, { estimation: 42, bas: 38, haut: 45, articles: 12, sansPrix: 0 }],
    "/stats/produit/tomate": [200, { produit: FICHE }],
    "/courses/ajouter": (o) => { requetes.push(JSON.parse(o.body)); return [200, { succes: true, item: {} }]; },
  });
  const simule = global.fetch;
  global.fetch = jest.fn((url, options) => {
    if (url.startsWith("/api/stats?")) {
      requetes.push(url);
      const enseigne = new URLSearchParams(url.split("?")[1]).get("enseigne");
      return Promise.resolve({ status: 200, ok: true, json: async () => (enseigne === "tous" ? STATS : { ...STATS, parMagasin: [STATS.parMagasin[0]] }) });
    }
    return simule(url, options);
  });
  rendreApp("/stats");
}

test("Stats : KPIs, estimation, inflation, prix et semaine la plus chère", async () => {
  ouvrirStats();
  expect(await screen.findByText("3 195 €")).toBeInTheDocument();
  expect(screen.getByText(/−6 % vs 2025/)).toBeInTheDocument();
  expect(screen.getByText("38 € – 45 €")).toBeInTheDocument();
  expect(screen.getByText("+4,1 %")).toBeInTheDocument();
  fireEvent.click(screen.getByText(/🇫🇷 \+0,6 %/));
  expect(screen.getByRole("dialog", { name: "Ligne France" })).toHaveTextContent("De janvier à février 2026");
  expect(screen.getByRole("dialog", { name: "Ligne France" })).toHaveTextContent("Foyer +2 %");
  expect(screen.getByRole("dialog", { name: "Ligne France" })).toHaveTextContent("plus vite que la moyenne (+1,4 pt)");
  fireEvent.click(document.body);
  expect(screen.queryByRole("dialog", { name: "Ligne France" })).not.toBeInTheDocument();
  const axe = () => [...document.querySelectorAll(".courbe__graduation")].map((g) => g.textContent);
  const axeAlimentation = axe();
  fireEvent.click(screen.getByRole("button", { name: "Tout" }));
  expect(screen.getByText(/🇫🇷 \+0,3 %/)).toBeInTheDocument();
  await waitFor(() => expect(axe()).not.toEqual(axeAlimentation));
  fireEvent.doubleClick(document.querySelector(".inflation .courbe"));
  expect(await screen.findByText("0 €", {}, { timeout: 2000 })).toHaveClass("courbe__graduation");
  fireEvent.doubleClick(document.querySelector(".inflation .courbe"));
  await waitFor(() => expect(screen.queryByText("0 €")).not.toBeInTheDocument(), { timeout: 2000 });
  expect(screen.getByText("Tomate")).toBeInTheDocument();
  expect(screen.getByText("Steak haché +24 €", { exact: false })).toBeInTheDocument();
  expect(screen.getByRole("tooltip", { hidden: true })).toHaveTextContent("40 € cette semaine16 € en moyenne (2026) · 10 € la semaine d’avant");
  expect(screen.getByText(/42 produits suivis/)).toBeInTheDocument();
  expect([...document.querySelectorAll(".courbe__graduation")].every((g) => g.textContent.endsWith("€"))).toBe(true);
  fireEvent.click(screen.getByText(/Foyer \+4,1 %/));
  expect(screen.getByRole("dialog", { name: "Ce qui fait bouger l’inflation" })).toHaveTextContent("Ont le plus monté");
  expect(screen.getByText("Leclerc 79 %")).toBeInTheDocument();
});

test("période courte : pas de courbe, Les prix prend la place du bloc Inflation", async () => {
  ouvrirStats();
  const court = { ...STATS, inflation: [{ mois: "2026-10", etiquette: "O", indice: 100 }], kpi: { ...STATS.kpi, inflation: 2.3, inflationRef: "12mois" } };
  global.fetch = ((avant) => jest.fn((url, o) => (url.startsWith("/api/stats?") ? Promise.resolve({ status: 200, ok: true, json: async () => court }) : avant(url, o))))(global.fetch);
  await screen.findByText("3 195 €");
  await act(async () => fireEvent.click(screen.getByLabelText("Période précédente")));
  expect(await screen.findByText("vs 12 mois")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Inflation" })).not.toBeInTheDocument();
  expect(document.querySelector(".stats__grille .prix")).not.toBeNull();
});

test("Les prix : tri par hausse et recherche sans accents", async () => {
  ouvrirStats();
  await screen.findByText("3 195 €");
  const noms = () => [...document.querySelectorAll(".prix__nom b")].map((n) => n.textContent);
  expect(noms()).toEqual(["Mangue", "Tomate"]);
  fireEvent.click(document.querySelector(".prix__tri .custom-select__button"));
  fireEvent.click(within(document.querySelector(".custom-select__list")).getByText("Plus fortes hausses"));
  expect(noms()).toEqual(["Tomate", "Mangue"]);
  fireEvent.change(screen.getByPlaceholderText("Rechercher un aliment…"), { target: { value: "TOMATE" } });
  expect(noms()).toEqual(["Tomate"]);
});

test("période et magasin rechargent les stats ; un seul magasin masque Par magasin", async () => {
  ouvrirStats();
  await screen.findByText("3 195 €");
  await act(async () => fireEvent.click(screen.getByLabelText("Période précédente")));
  expect(requetes.at(-1)).toContain("ref=" + (new Date().getFullYear() - 1));
  await act(async () => fireEvent.click(screen.getByLabelText("Leclerc")));
  expect(requetes.at(-1)).toContain("enseigne=Leclerc");
  expect(screen.queryByText("Par magasin")).not.toBeInTheDocument();
});

test("la flèche précédente s'arrête à l'année du premier achat", async () => {
  ouvrirStats();
  await screen.findByText("3 195 €");
  expect(screen.getByLabelText("Période précédente")).not.toBeDisabled();
  await act(async () => fireEvent.click(screen.getByLabelText("Période précédente")));
  expect(screen.getByLabelText("Période précédente")).toBeDisabled();
});

test("Semaine s'ouvre sur la dernière semaine avec des achats", async () => {
  ouvrirStats();
  await screen.findByText("3 195 €");
  fireEvent.click(screen.getByRole("button", { name: /2026/ }));
  await act(async () => fireEvent.click(screen.getByRole("menuitem", { name: "Semaine" })));
  expect(requetes.at(-1)).toContain("periode=semaine");
  expect(requetes.at(-1)).toContain("ref=2026-10-13");
});

test("fiche produit : prix par magasin, derniers achats, ajout aux Courses", async () => {
  ouvrirStats();
  await screen.findByText("3 195 €");
  await act(async () => fireEvent.click(screen.getByText("Tomate").closest("button")));
  const fiche = await screen.findByRole("dialog", { name: "Tomate" });
  expect(within(fiche).getByText("+31 % depuis 2025")).toBeInTheDocument();
  expect(within(fiche).getByText("Marché Frais · 1,846 kg")).toBeInTheDocument();
  expect(within(fiche).getByText("Chaque semaine")).toBeInTheDocument();
  expect(within(fiche).getByText("4,05 €")).toBeInTheDocument();
  expect(within(fiche).getByText("18 €")).toBeInTheDocument();
  expect(within(fiche).getByText("211 €")).toBeInTheDocument();
  await act(async () => fireEvent.click(within(fiche).getByText("Ajouter aux Courses")));
  expect(requetes).toContainEqual({ idAliment: "tomate" });
  expect(within(fiche).getByText("Ajouté aux Courses ✓")).toBeInTheDocument();
  fireEvent.click(within(fiche).getByLabelText("Fermer"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
