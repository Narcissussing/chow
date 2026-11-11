import { classerRecherche, correspondRecherche, rangRecherche } from "./recherche.js";

const ALIMENTS = [
  { id: "sucre-glace", nom: "Sucre Glace", popularite: 1.8 },
  { id: "sucre-morceaux", nom: "Sucre en Morceaux", popularite: 3.7 },
  { id: "jus-orange", nom: "Jus d'orange sucré", popularite: 9 },
  { id: "sucre", nom: "Sucre en Poudre", popularite: 4.4 },
  { id: "poivron", nom: "Poivron Rouge", popularite: 15 },
];
const noms = (liste) => liste.filter((a) => a.visible).map((a) => a.nom);

test("les noms qui commencent par le texte d'abord, puis les plus utilisés", () => {
  expect(noms(classerRecherche(ALIMENTS, "sucr"))).toEqual(["Sucre en Poudre", "Sucre en Morceaux", "Sucre Glace", "Jus d'orange sucré"]);
});

test("mots dans n'importe quel ordre, accents ignorés", () => {
  expect(noms(classerRecherche(ALIMENTS, "morceaux sucre"))).toEqual(["Sucre en Morceaux"]);
  expect(correspondRecherche("Crème Fraîche", "creme fraiche")).toBe(true);
});

test("une faute de frappe tolérée sur les mots de 4 lettres et plus", () => {
  expect(correspondRecherche("Sucre en Morceaux", "morcaux")).toBe(true);
  expect(correspondRecherche("Sucre en Morceaux", "mor xyz")).toBe(false);
  expect(correspondRecherche("Poivron Rouge", "pov")).toBe(false);
});

test("limite : les suivants restent dans la liste mais cachés", () => {
  const liste = classerRecherche(ALIMENTS, "sucre", { limite: 2 });
  expect(liste).toHaveLength(5);
  expect(noms(liste)).toEqual(["Sucre en Poudre", "Sucre en Morceaux"]);
});

test("rangs", () => {
  expect(rangRecherche("Sucre en Morceaux", "sucre en")).toBe(0);
  expect(rangRecherche("Sucre en Morceaux", "morc")).toBe(1);
  expect(rangRecherche("Jus d'orange sucré", "ucr")).toBe(2);
  expect(rangRecherche("Poivron Rouge", "zz")).toBe(null);
});
