import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { rendreApp, simulerApi } from "../../testUtils.jsx";
import { decaler, libellePeriode } from "./Filtres.jsx";

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
  derniersAchats: [{ jour: "2026-10-13", enseigne: "Marché Frais", total: 4.6, quantite: "1,846 kg", remise: 1.2 }],
  economiePromos: 8.4,
  periode: { achats: 12, depense: 48 },
  depenseTotale: 312.4,
  premierAchat: "2023-09-02",
  habitudes: { rythmeJours: 7, quantiteParAchat: 1.2, quantiteParMois: 4.3, depense12Mois: 210.8, achats12Mois: 35, dernierAchat: "2026-10-13", joursDepuis: 10, prochainAchat: "2026-10-20" },
};

const article = (i, extra = {}) => ({ id: "a" + i, nom: "Article " + i, emoji: "🍅", racine: "alimentation", quantite: "×1", depense: 1, niveau: null, economie: 0, alternative: null, ...extra });
const TICKETS = {
  periode: "semaine", ref: "2026-10-29", debut: "2026-10-26", fin: "2026-11-02", total: 116.3, nbArticles: 45,
  niveaux: [
    { niveau: 1, economie: 8.75, parAn: 236, noms: ["Chips"] },
    { niveau: 2, economie: 11.64, parAn: 211, noms: ["Petit Pot de Crème (vanille)"] },
    { niveau: 3, economie: 0, parAn: 0, noms: [] },
  ],
  articles: [article(0, { nom: "Chips", niveau: 1, economie: 8.75, depense: 8.75 }), ...Array.from({ length: 34 }, (_, i) => article(i + 1))],
  tickets: [{ id: 329, jour: "2026-10-29", magasin: "Leclerc Meaux", enseigne: "Leclerc", paye: 71.29, detaille: true, nbArticles: 30, economies: { 1: 8.75, 2: 11.64, 3: 0 }, articles: [article(0, { nom: "Chips", niveau: 1, economie: 8.75 })] }],
  precedent: "2026-10-24", suivant: null,
};

const PLAN = {
  economieMois: 0,
  articles: [
    { id: "chips", nom: "Chips", emoji: "🍟", section: "arreter", unite: "piece", quantiteMois: 3, depenseMois: 6, prixUnite: 2, changerMois: 0, alternative: null, jete: null, choix: null, economieMois: 0 },
    { id: "oeuf-moyen", nom: "Oeuf", emoji: "🥚", section: "choix", unite: "piece", quantiteMois: 30, depenseMois: 7, prixUnite: 0.23, changerMois: 1, alternative: null, jete: null, choix: { decision: "garder", quantiteVisee: null, preference: "Gros œufs, Marché Frais" }, economieMois: 0 },
  ],
};

let requetes, choixPlan;
function ouvrirStats() {
  requetes = [];
  choixPlan = {};
  simulerApi({
    "/session": [200, { utilisateur: { id: 1 } }],
    "/courses/estimation": [200, { estimation: 42, bas: 38, haut: 45, articles: 12, sansPrix: 0 }],
    "/courses/ajouter": (o) => { requetes.push(JSON.parse(o.body)); return [200, { succes: true, item: {} }]; },
  });
  const simule = global.fetch;
  global.fetch = jest.fn((url, options) => {
    if (url.startsWith("/api/stats/produit/tomate?")) {
      requetes.push(url);
      return Promise.resolve({ status: 200, ok: true, json: async () => ({ produit: FICHE }) });
    }
    if (url === "/api/plan") {
      requetes.push(url);
      const articles = PLAN.articles.map((a) => (choixPlan[a.id] ? { ...a, choix: choixPlan[a.id] } : a));
      return Promise.resolve({ status: 200, ok: true, json: async () => ({ ...PLAN, articles }) });
    }
    if (url.startsWith("/api/articles/")) {
      requetes.push({ url, corps: JSON.parse(options.body) });
      return Promise.resolve({ status: 200, ok: true, json: async () => ({ succes: true }) });
    }
    if (url.startsWith("/api/plan/")) {
      requetes.push({ url, corps: JSON.parse(options.body) });
      choixPlan[url.slice("/api/plan/".length)] = JSON.parse(options.body);
      return Promise.resolve({ status: 200, ok: true, json: async () => ({ succes: true }) });
    }
    if (url.startsWith("/api/stats/tickets?")) {
      requetes.push(url);
      return Promise.resolve({ status: 200, ok: true, json: async () => TICKETS });
    }
    if (url.startsWith("/api/stats?")) {
      requetes.push(url);
      const enseigne = new URLSearchParams(url.split("?")[1]).get("enseigne");
      return Promise.resolve({ status: 200, ok: true, json: async () => (enseigne === "tous" ? STATS : { ...STATS, parMagasin: [STATS.parMagasin[0]] }) });
    }
    return simule(url, options);
  });
  rendreApp("/stats");
}

// Les Stats s'ouvrent sur la semaine ; ces tests lisent l'année.
async function passerEnAnnee() {
  await screen.findByText("3 195 €");
  fireEvent.click(document.querySelector(".periode__choix"));
  await act(async () => fireEvent.click(screen.getByRole("menuitem", { name: "Année" })));
}

test("Stats : KPIs, estimation, inflation, prix et semaine la plus chère", async () => {
  ouvrirStats();
  await passerEnAnnee();
  expect(await screen.findByText("3 195 €")).toBeInTheDocument();
  expect(screen.getByText(/−6 % vs 2025/)).toBeInTheDocument();
  expect(screen.getByText("38 € – 45 €")).toBeInTheDocument();
  expect(screen.getByText("+4,1 %")).toBeInTheDocument();
  fireEvent.click(screen.getByText(/🇫🇷 \+0,6 %/));
  expect(screen.getByRole("dialog", { name: "Ligne France" })).toHaveTextContent("De janvier à février 2026");
  expect(screen.getByRole("dialog", { name: "Ligne France" })).toHaveTextContent("Foyer +2 %");
  expect(screen.getByRole("dialog", { name: "Ligne France" })).toHaveTextContent("plus vite que la moyenne (+1,4 pt)");
  fireEvent.click(document.body);
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Ligne France" })).not.toBeInTheDocument());
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
  fireEvent.click(screen.getByRole("button", { name: /Steak haché \+24 €/ }));
  expect(screen.getByRole("dialog", { name: "Steak haché" })).toHaveTextContent("40 € cette semaine16 € en moyenne (2026) · 10 € la semaine d’avant");
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Steak haché" })).not.toBeInTheDocument());
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
  expect(screen.getByText("200 € dépensés")).toBeInTheDocument();
  fireEvent.click(document.querySelector(".prix__tri .custom-select__button"));
  fireEvent.click(within(document.querySelector(".custom-select__list")).getByText("Plus fortes hausses"));
  expect(noms()).toEqual(["Tomate", "Mangue"]);
  fireEvent.change(screen.getByPlaceholderText("Rechercher un aliment…"), { target: { value: "TOMATE" } });
  expect(noms()).toEqual(["Tomate"]);
});

test("période et magasin rechargent les stats ; un seul magasin masque Par magasin", async () => {
  ouvrirStats();
  await passerEnAnnee();
  await screen.findByText("3 195 €");
  await act(async () => fireEvent.click(screen.getByLabelText("Période précédente")));
  expect(requetes.at(-1)).toContain("ref=" + (new Date().getFullYear() - 1));
  await act(async () => fireEvent.click(screen.getByLabelText("Leclerc")));
  expect(requetes.at(-1)).toContain("enseigne=Leclerc");
  expect(screen.queryByText("Par magasin")).not.toBeInTheDocument();
});

test("la flèche précédente s'arrête à l'année du premier achat", async () => {
  ouvrirStats();
  await passerEnAnnee();
  await screen.findByText("3 195 €");
  expect(screen.getByLabelText("Période précédente")).not.toBeDisabled();
  await act(async () => fireEvent.click(screen.getByLabelText("Période précédente")));
  expect(screen.getByLabelText("Période précédente")).toBeDisabled();
});

test("Stats s'ouvre sur la semaine en cours ; Semaine choisie ensuite va à la dernière semaine avec des achats", async () => {
  ouvrirStats();
  await screen.findByText("3 195 €");
  expect(requetes[0]).toContain("periode=semaine");
  await passerEnAnnee();
  fireEvent.click(document.querySelector(".periode__choix"));
  await act(async () => fireEvent.click(screen.getByRole("menuitem", { name: "Semaine" })));
  expect(requetes.at(-1)).toContain("periode=semaine");
  expect(requetes.at(-1)).toContain("ref=2026-10-13");
});

test("fiche produit : prix par magasin, derniers achats, ajout aux Courses", async () => {
  ouvrirStats();
  await passerEnAnnee();
  await screen.findByText("3 195 €");
  await act(async () => fireEvent.click(screen.getByText("Tomate").closest("button")));
  const fiche = await screen.findByRole("dialog", { name: "Tomate" });
  expect(within(fiche).getByText("+31 % depuis 2025")).toBeInTheDocument();
  expect(within(fiche).getByText(/312 € dépensés depuis 2023/)).toBeInTheDocument();
  expect(within(fiche).getByText("8 € économisés en promo")).toBeInTheDocument();
  expect(requetes.at(-1)).toMatch(/^\/api\/stats\/produit\/tomate\?periode=annee&ref=.*&enseigne=tous$/);
  expect(await within(fiche).findByText("12 achats", {}, { timeout: 2000 })).toBeInTheDocument();
  expect(within(fiche).getByText(String(new Date().getFullYear()))).toBeInTheDocument();
  expect(within(fiche).getByText("−1,20 € promo")).toBeInTheDocument();
  expect(within(fiche).getByText("Marché Frais · 1,846 kg")).toBeInTheDocument();
  expect(within(fiche).getByText("Chaque semaine")).toBeInTheDocument();
  expect(within(fiche).getByText("4,05 €")).toBeInTheDocument();
  expect(within(fiche).getByText("18 €")).toBeInTheDocument();
  expect(within(fiche).getByText("211 €")).toBeInTheDocument();
  await act(async () => fireEvent.click(within(fiche).getByText("Ajouter aux Courses")));
  expect(requetes).toContainEqual({ idAliment: "tomate" });
  expect(within(fiche).getByText("Ajouté aux Courses ✓")).toBeInTheDocument();
  fireEvent.click(within(fiche).getByLabelText("Fermer"));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

test("Les prix : la liste complète s'ouvre dans une feuille qui se ferme", async () => {
  const avant = STATS.produits;
  STATS.produits = [...avant, ...["a", "b", "c", "d", "e"].map((id, i) => ({ id, nom: "Produit " + id, emoji: "🥫", achats: 1, depense: 10 - i, prix: 1, unite: null, variation: 0, courbe: [1, 1] }))];
  try {
    ouvrirStats();
    await screen.findByText("3 195 €");
    expect(document.querySelectorAll(".prix .prix__entree")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Voir les 7 produits →" }));
    const liste = screen.getByRole("dialog", { name: "Tous les produits" });
    expect(liste.querySelectorAll(".prix__entree")).toHaveLength(7);
    fireEvent.click(within(liste).getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Tous les produits" })).not.toBeInTheDocument());
    expect(document.querySelectorAll(".prix .prix__entree")).toHaveLength(5);
  } finally {
    STATS.produits = avant;
  }
});

test("Dates… : un seul calendrier, deux touchers suffisent, pas de jour futur", async () => {
  ouvrirStats();
  await screen.findByText("3 195 €");
  fireEvent.click(document.querySelector(".periode__choix"));
  fireEvent.click(screen.getByRole("menuitem", { name: "Dates…" }));
  const auj = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const demain = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() + 1);
  if (demain.getMonth() === auj.getMonth()) expect(document.querySelector(`[data-jour="${iso(demain)}"]`)).toBeDisabled();
  expect(screen.getByLabelText("Suivant")).toBeDisabled();
  fireEvent.click(screen.getByLabelText("Précédent"));
  const mois = iso(new Date(auj.getFullYear(), auj.getMonth() - 1, 1)).slice(0, 8);
  fireEvent.click(document.querySelector(`[data-jour="${mois}10"]`));
  // Un jour avant le début devient le début : la plage va du 3 au 10.
  fireEvent.click(document.querySelector(`[data-jour="${mois}03"]`));
  await waitFor(() => expect(requetes.at(-1)).toContain("periode=dates"));
  expect(requetes.at(-1)).toContain(`debut=${mois}03`);
  expect(requetes.at(-1)).toContain(`fin=${mois}10`);
  await waitFor(() => expect(document.querySelector(".calendrier")).toBeNull());
});

test("Dates… : le mois ouvre les mois, l'année ouvre les années", async () => {
  ouvrirStats();
  await screen.findByText("3 195 €");
  fireEvent.click(document.querySelector(".periode__choix"));
  fireEvent.click(screen.getByRole("menuitem", { name: "Dates…" }));
  fireEvent.click(document.querySelector(".calendrier__titre"));
  expect(document.querySelectorAll("[data-mois]")).toHaveLength(12);
  fireEvent.click(document.querySelector(".calendrier__titre"));
  const annees = [...document.querySelectorAll("[data-annee]")].map((b) => b.textContent);
  expect(annees.at(-1)).toBe(String(new Date().getFullYear()));
  fireEvent.click(document.querySelector("[data-annee]"));
  expect(document.querySelectorAll("[data-mois]")).toHaveLength(12);
  fireEvent.click(document.querySelector("[data-mois]:not(:disabled)"));
  expect(document.querySelector("[data-jour]")).not.toBeNull();
});

test("une semaine va du lundi au dimanche, quel que soit le jour de référence", () => {
  const semaine = { periode: "semaine", ref: "2026-10-21" };
  expect(libellePeriode(semaine)).toBe("19–25 oct.");
  expect(libellePeriode(decaler(semaine, -1))).toBe("12–18 oct.");
  expect(libellePeriode(decaler(semaine, 1))).toBe("26–1 nov.");
});

test("Tickets : total en haut, niveaux qui retirent la dépense, liste par paliers de 10, 20 et 30", async () => {
  ouvrirStats();
  await screen.findByText("3 195 €");
  fireEvent.click(screen.getByRole("button", { name: "Tickets" }));
  const feuille = await screen.findByRole("dialog", { name: "Tickets" });
  expect(await within(feuille).findByText("116,30 €")).toBeInTheDocument();
  expect(requetes.some((u) => u.startsWith("/api/stats/tickets?periode=semaine"))).toBe(true);
  expect(within(feuille).getAllByRole("listitem")).toHaveLength(10);
  fireEvent.click(within(feuille).getByRole("button", { name: /Voir 10 de plus/ }));
  expect(within(feuille).getAllByRole("listitem")).toHaveLength(20);
  fireEvent.click(within(feuille).getByRole("button", { name: /Voir 15 de plus/ }));
  expect(within(feuille).getAllByRole("listitem")).toHaveLength(35);
  fireEvent.click(within(feuille).getByRole("button", { name: "Retirer du total À arrêter" }));
  expect(within(feuille).getByRole("button", { name: "Remettre À arrêter" })).toHaveAttribute("aria-pressed", "true");
  expect(await within(feuille).findByText("−8,75 €", { selector: ".tickets__badge" })).toBeInTheDocument();
  expect(within(feuille.querySelector(".tickets__liste")).getByText("Chips").closest("li")).toHaveClass("retire");
  expect(within(feuille).getByRole("button", { name: "Retirer du total Moins cher" })).toBeDisabled();
  // Toucher le niveau ouvre sa liste ; décocher un article ne le compte pas cette fois, ✕ le sort du niveau.
  fireEvent.click(within(feuille).getByRole("button", { name: "Voir la liste À arrêter" }));
  const liste = within(feuille).getByRole("list", { name: "Liste À arrêter" });
  expect(within(liste).getByText("−8,75 €")).toBeInTheDocument();
  fireEvent.click(within(liste).getByRole("button", { name: "Ne pas compter Chips" }));
  expect(feuille.querySelector(".tickets__badge")).toBeNull();
  expect(within(feuille.querySelector(".tickets__liste")).getByText("Chips").closest("li")).not.toHaveClass("retire");
  await act(async () => fireEvent.click(within(liste).getByRole("button", { name: "Sortir Chips de À arrêter" })));
  await waitFor(() => expect(requetes.find((r) => r.url === "/api/articles/a0/a-reduire")?.corps).toEqual({ niveau: null }));
});

test("Mon plan : choisir « Moins » montre l'économie par mois et l'enregistre", async () => {
  ouvrirStats();
  await screen.findByText("3 195 €");
  fireEvent.click(screen.getByRole("button", { name: "Tickets" }));
  const tickets = await screen.findByRole("dialog", { name: "Tickets" });
  fireEvent.click(await within(tickets).findByRole("button", { name: "Mon plan →" }));
  const plan = await screen.findByRole("dialog", { name: "Mon plan" });
  expect(await within(plan).findByText("Gros œufs, Marché Frais")).toBeInTheDocument();
  const choix = within(plan).getByRole("group", { name: "Choix pour Chips" });
  await act(async () => fireEvent.click(within(choix).getByRole("button", { name: "Moins" })));
  expect(requetes.find((r) => r.url === "/api/plan/chips").corps).toEqual({ decision: "moins", quantiteVisee: 2 });
  expect(within(plan).getByText("2 / mois")).toBeInTheDocument();
  expect(within(plan).getAllByText("−2,00 €").length).toBeGreaterThan(0);
});

test("Tickets : un toucher sur la date ouvre le calendrier, la plage choisie remplace jour, semaine ou mois", async () => {
  ouvrirStats();
  await screen.findByText("3 195 €");
  fireEvent.click(screen.getByRole("button", { name: "Tickets" }));
  const feuille = await screen.findByRole("dialog", { name: "Tickets" });
  fireEvent.click(await within(feuille).findByRole("button", { name: "26 oct. – 1 nov." }));
  const jours = [...feuille.querySelectorAll("[data-jour]:not(:disabled)")];
  fireEvent.click(jours[0]);
  fireEvent.click(jours[2]);
  await waitFor(() => expect(requetes.some((u) => typeof u === "string" && u.includes("periode=dates") && u.includes("debut=" + jours[0].dataset.jour) && u.includes("fin=" + jours[2].dataset.jour))).toBe(true));
  expect(within(feuille).getByRole("button", { name: "Semaine" })).toHaveAttribute("aria-pressed", "false");
});
