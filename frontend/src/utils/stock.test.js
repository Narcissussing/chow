import { correspondFiltres, estAVerifier, joursAvantVerification } from "./stock.js";

const aliment = (champs) => ({ nom: "Tomate", quantite: "3", tracking_type: "unite", emplacement: "fg", categorie: "Légumes", jours_depuis: 0, ...champs });

test("fruits et légumes hors congélateur : à vérifier après 4 jours", () => {
  expect(joursAvantVerification(aliment())).toBe(4);
  expect(estAVerifier(aliment({ jours_depuis: 3 }))).toBe(false);
  expect(estAVerifier(aliment({ jours_depuis: 4 }))).toBe(true);
});

test("légumes au congélateur et autres aliments : après 3 semaines", () => {
  expect(joursAvantVerification(aliment({ emplacement: "fz" }))).toBe(21);
  expect(joursAvantVerification(aliment({ categorie: "Sauces", emplacement: "st" }))).toBe(21);
  expect(estAVerifier(aliment({ categorie: "Sauces", jours_depuis: 10 }))).toBe(false);
});

test("reste ponctuel : à vérifier après 4 jours, quelle que soit sa catégorie", () => {
  expect(joursAvantVerification(aliment({ categorie: "Sauces", ponctuel: true }))).toBe(4);
});

test("un aliment vide n'est jamais à vérifier", () => {
  expect(estAVerifier(aliment({ quantite: "0", jours_depuis: 30 }))).toBe(false);
});

test("filtre Ponctuel du Stock", () => {
  const filtres = { emplacement: "tous", type: "ponctuel", termes: "" };
  expect(correspondFiltres(aliment({ ponctuel: true }), filtres)).toBe(true);
  expect(correspondFiltres(aliment({ ponctuel: false }), filtres)).toBe(false);
});
