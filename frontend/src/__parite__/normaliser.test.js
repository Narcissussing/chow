import { DATA_CONSERVES, canoniser, premiereDifference } from "./normaliser.js";

test("la comparaison repère un conteneur manquant (erreur R3 de Check.Da.Train)", () => {
  const ejs = '<main><section class="grille-principale"><div class="carte">A</div></section></main>';
  const react = '<main><div class="carte">A</div></main>';
  expect(premiereDifference(canoniser(ejs), canoniser(react))).not.toBeNull();
});

test("…une classe en moins, un texte différent, un attribut accessible absent", () => {
  const ejs = '<main><button class="filter-btn active" title="Vue grille">Tous</button></main>';
  expect(premiereDifference(canoniser(ejs), canoniser('<main><button class="filter-btn" title="Vue grille">Tous</button></main>'))).not.toBeNull();
  expect(premiereDifference(canoniser(ejs), canoniser('<main><button class="filter-btn active" title="Vue grille">Toutes</button></main>'))).not.toBeNull();
  expect(premiereDifference(canoniser(ejs), canoniser('<main><button class="filter-btn active">Tous</button></main>'))).not.toBeNull();
});

test("…mais ignore l'ordre des attributs, l'indentation et les data-* des scripts vanilla", () => {
  const ejs = '<main>\n  <a href="/x" class="b a" data-nom="x">\n    Texte\n  </a>\n</main>';
  const react = '<main><a class="a b" href="/x">Texte</a></main>';
  expect(premiereDifference(canoniser(ejs), canoniser(react))).toBeNull();
});

test("les data-* lus par le CSS sont comparés (oubli de data-vue sur les boutons de vue des recettes)", () => {
  expect([...DATA_CONSERVES].sort()).toEqual(["data-a-photo", "data-for-select", "data-vue"]);
  const ejs = '<main><button class="recette-vue-icone" data-vue="grille"></button></main>';
  expect(premiereDifference(canoniser(ejs), canoniser('<main><button class="recette-vue-icone"></button></main>'))).not.toBeNull();
});
