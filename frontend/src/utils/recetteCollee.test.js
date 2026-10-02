import { lireRecette, noteIngredient, trouverAliment } from "./recetteCollee.js";

const ALIMENTS = [
  { id: "sucre", nom: "Sucre en Poudre" },
  { id: "sucre-glace", nom: "Sucre Glace" },
  { id: "sucre-vanille", nom: "Sucre Vanillé" },
  { id: "sucre-brun", nom: "Sucre Brun" },
  { id: "farine", nom: "Farine" },
  { id: "levure-chimique", nom: "Levure Chimique" },
  { id: "oeuf-large", nom: "Oeuf Large" },
  { id: "oeuf-moyen", nom: "Oeuf Moyen" },
  { id: "jaune-oeuf", nom: "Jaune d'Oeuf" },
  { id: "extrait-vanille", nom: "Extrait de Vanille" },
  { id: "gousse-vanille", nom: "Gousse de Vanille" },
  { id: "lait-entier", nom: "Lait Entier" },
  { id: "huile-olive", nom: "Huile d'Olive" },
];

test("format Marmiton : la quantité sur une ligne, l'ingrédient sur la suivante", () => {
  const texte = "2 cuillères à café\nde vanille en poudre\n\n140 g\nde sucre\n\n140 g\nde beurre\n\n1 sachet\nde levure\n\n200 g\nde farine\n\n3\noeufs";
  expect(lireRecette(texte).map(({ nom, quantite, unite, approx }) => [nom, quantite, unite, approx])).toEqual([
    ["vanille en poudre", 2, "cafe", false],
    ["sucre", 140, "g", false],
    ["beurre", 140, "g", false],
    ["levure", 1, "piece", true],
    ["farine", 200, "g", false],
    ["oeufs", 3, "piece", false],
  ]);
});

test("une ligne par ingrédient, fractions, kg/cl, cuillères abrégées, puces", () => {
  const texte = "- 1,5 kg de pommes de terre\n• ½ c. à s. d'huile d'olive\n25 cl de lait entier\n1 1/2 tsp sugar\n2 c. à café de sel\nsel";
  expect(lireRecette(texte).map(({ nom, quantite, unite }) => [nom, quantite, unite])).toEqual([
    ["pommes de terre", 1500, "g"],
    ["huile d olive", 0.5, "soupe"],
    ["lait entier", 250, "ml"],
    ["sugar", 1.5, "cafe"],
    ["sel", 2, "cafe"],
    ["sel", null, "g"],
  ]);
});

test("rapprochement : sûr, à choisir, inconnu", () => {
  const statut = (nom) => {
    const r = trouverAliment(nom, ALIMENTS);
    return [r.statut, r.aliment?.id ?? null];
  };
  expect(statut("sucre")).toEqual(["ok", "sucre"]);
  expect(statut("farine")).toEqual(["ok", "farine"]);
  expect(statut("levure")).toEqual(["ok", "levure-chimique"]);
  expect(statut("lait entier")).toEqual(["ok", "lait-entier"]);
  expect(statut("huile d olive")).toEqual(["ok", "huile-olive"]);
  // « moyen » est descriptif : l'oeuf moyen l'emporte sur le large quand rien d'autre n'est précisé.
  expect(statut("oeufs")).toEqual(["ok", "oeuf-moyen"]);
  expect(trouverAliment("oeufs", ALIMENTS).candidats.map((a) => a.id)).toEqual(expect.arrayContaining(["oeuf-large", "oeuf-moyen"]));
  expect(statut("vanille en poudre")).toEqual(["choix", null]);
  expect(statut("beurre")).toEqual(["inconnu", null]);
  expect(statut("farinne")).toEqual(["choix", null]);
});

test("« X ou Y » : chaque alternative est cherchée et proposée au choix ; gousse comptée à la pièce", () => {
  const [ligne] = lireRecette("1 gousse de vanille (ou 1 c. à café d'extrait de vanille)");
  expect([ligne.quantite, ligne.unite]).toEqual([1, "piece"]);
  const r = trouverAliment(ligne.nom, ALIMENTS);
  expect(r.statut).toBe("choix");
  expect(r.candidats.slice(0, 2).map((a) => a.id)).toEqual(["gousse-vanille", "extrait-vanille"]);
  const r2 = trouverAliment("gousse de vanille ou extrait de vanille", ALIMENTS);
  expect(r2.candidats.slice(0, 2).map((a) => a.id)).toEqual(["gousse-vanille", "extrait-vanille"]);
  // Une seule alternative connue : traitée comme une ligne simple.
  expect(trouverAliment("farine ou fécule de tapioca", ALIMENTS)).toMatchObject({ statut: "ok", aliment: { id: "farine" } });
});

test("synonyme du foyer : la gélatine mène à l'agar-agar ; un choix mémorisé est repris", () => {
  const avecAgar = [...ALIMENTS, { id: "agar-agar", nom: "Agar-Agar" }];
  expect(trouverAliment("gélatine", avecAgar)).toMatchObject({ statut: "ok", aliment: { id: "agar-agar" } });
  expect(trouverAliment("feuilles de gélatine", avecAgar).statut).not.toBe("inconnu");
  for (const nom of ["sucre de canne", "sucre roux", "cassonade", "brown sugar"]) {
    expect([nom, trouverAliment(nom, ALIMENTS)]).toMatchObject([nom, { statut: "ok", aliment: { id: "sucre-brun" } }]);
  }
  expect(trouverAliment("oeufs", ALIMENTS, { oeufs: "oeuf-moyen" })).toMatchObject({ statut: "ok", aliment: { id: "oeuf-moyen" } });
  expect(trouverAliment("Gousse de vanille ou extrait", ALIMENTS, { "gousse de vanille ou extrait": "extrait-vanille" })).toMatchObject({ statut: "ok", aliment: { id: "extrait-vanille" } });
});

const CATALOGUE = [
  { id: "poulet", nom: "Poulet (blanc)" }, { id: "carotte", nom: "Carotte" }, { id: "raisins-secs", nom: "Raisins Secs" },
  { id: "amande", nom: "Amande" }, { id: "abricots-secs", nom: "Abricots Secs" }, { id: "oignon", nom: "Oignon" },
  { id: "oignon-printemps", nom: "Oignon de Printemps" }, { id: "oignon-granule", nom: "Oignon Granulé" },
  { id: "ail", nom: "Ail" }, { id: "gousse-vanille", nom: "Gousse de Vanille" }, { id: "cannelle", nom: "Cannelle" },
  { id: "graines-coriandre", nom: "Graines de Coriandre" }, { id: "coriandre-fraiche", nom: "Coriandre Fraîche" },
  { id: "cumin-moulu", nom: "Cumin Moulu" }, { id: "muscade-poudre", nom: "Noix de Muscade en Poudre" },
  { id: "noix-cajou", nom: "Noix de Cajou" }, { id: "bouillon-boeuf", nom: "Bouillon de Bœuf" },
  { id: "bouillon-poulet", nom: "Bouillon de Poulet" }, { id: "huile-olive", nom: "Huile d'Olive" }, { id: "huile", nom: "Huile" },
  { id: "sel", nom: "Sel" }, { id: "poivre-noir", nom: "Poivre Noir" }, { id: "persil", nom: "Persil" }, { id: "thym", nom: "Thym" },
];

test("format « nom puis quantité » (nom répété, pluriels « (s) ») : la recette de tajine est lue et reliée", () => {
  const texte = "Poulet\nPoulet\n1,5 kg\nCarotte(s)\nCarotte(s)\n1,2 kg\nRaisins secs\nRaisins secs\n100 g\nAmande(s) mondée(s)\nAmande(s) mondée(s)\n100 g\nAbricots secs\nAbricots secs\n6\nOignon(s)\nOignon(s)\n4\nAil\nAil\n2 gousse(s)\nBouquet(s) garni(s) (persil, thym, laurier)\nBouquet(s) garni(s) (persil, thym, laurier)\n1\nGraine de coriandre\nGraine de coriandre\n1 c. à café\nCumin en poudre\nCumin en poudre\n1 c. à café\nCannelle\nCannelle\n1 bâton(s)\nNoix de muscade râpée\nNoix de muscade râpée\n1 pincée(s)\nBouillon cube(s)\nBouillon cube(s)\n1 cube(s)\nHuile d'olive\nHuile d'olive\n5 cl\nSel\nSel\n1 pincée(s)\nPoivre\nPoivre\n1 pincée(s)";
  const lignes = lireRecette(texte);
  expect(lignes.map(({ nom, quantite, unite }) => [nom, quantite, unite])).toEqual([
    ["poulet", 1500, "g"],
    ["carotte", 1200, "g"],
    ["raisins secs", 100, "g"],
    ["amande mondee", 100, "g"],
    ["abricots secs", 6, "piece"],
    ["oignon", 4, "piece"],
    ["gousse ail", 2, "piece"],
    ["bouquet garni", 1, "piece"],
    ["graine de coriandre", 1, "cafe"],
    ["cumin en poudre", 1, "cafe"],
    ["cannelle", 3, "g"],
    ["noix de muscade rapee", 0.5, "g"],
    ["bouillon cube", 1, "piece"],
    ["huile d olive", 50, "ml"],
    ["sel", 0.5, "g"],
    ["poivre", 0.5, "g"],
  ]);
  const resultat = lignes.map((l) => {
    const r = trouverAliment(l.nom, CATALOGUE);
    return [l.nom, r.statut, r.aliment?.id ?? r.candidats.map((a) => a.id).slice(0, 2).join("|")];
  });
  expect(resultat).toEqual([
    ["poulet", "ok", "poulet"],
    ["carotte", "ok", "carotte"],
    ["raisins secs", "ok", "raisins-secs"],
    ["amande mondee", "ok", "amande"],
    ["abricots secs", "ok", "abricots-secs"],
    ["oignon", "ok", "oignon"],
    ["gousse ail", "ok", "ail"],
    ["bouquet garni", "inconnu", ""],
    ["graine de coriandre", "ok", "graines-coriandre"],
    ["cumin en poudre", "ok", "cumin-moulu"],
    ["cannelle", "ok", "cannelle"],
    ["noix de muscade rapee", "ok", "muscade-poudre"],
    ["bouillon cube", "choix", "bouillon-boeuf|bouillon-poulet"],
    ["huile d olive", "ok", "huile-olive"],
    ["sel", "ok", "sel"],
    ["poivre", "ok", "poivre-noir"],
  ]);
});

test("Marmiton : un ingrédient sans quantité suivi de « 200 g / de farine » n'est pas lu comme 200 g de sel", () => {
  expect(lireRecette("sel\n200 g\nde farine").map(({ nom, quantite }) => [nom, quantite])).toEqual([
    ["sel", null],
    ["farine", 200],
  ]);
});

const CUISINE = [
  { id: "oignon", nom: "Oignon" }, { id: "oignon-granule", nom: "Oignon Granulé" }, { id: "ail", nom: "Ail" },
  { id: "tomate", nom: "Tomate" }, { id: "concentre-tomates", nom: "Concentré de Tomates" }, { id: "persil", nom: "Persil" },
  { id: "cumin-moulu", nom: "Cumin Moulu" }, { id: "paprika", nom: "Paprika" }, { id: "paprika-fume", nom: "Paprika Fumé" },
  { id: "huile", nom: "Huile" }, { id: "huile-olive", nom: "Huile d'Olive" }, { id: "huile-argan", nom: "Huile d'Argan" },
  { id: "eau", nom: "Eau" }, { id: "sel", nom: "Sel" }, { id: "poivre-noir", nom: "Poivre Noir" },
  { id: "farine", nom: "Farine" }, { id: "semoule", nom: "Semoule" }, { id: "levure-chimique", nom: "Levure Chimique" },
  { id: "levure-boulangere-fraiche", nom: "Levure Boulangère Fraîche" }, { id: "levure-boulangere-seche", nom: "Levure Boulangère Sèche" },
  { id: "feuille-brik", nom: "Feuille de Brik" }, { id: "poulet", nom: "Poulet (blanc)" }, { id: "citron-confit", nom: "Citron Confit" },
  { id: "citron", nom: "Citron" }, { id: "fromage", nom: "Fromage" }, { id: "fromage-brebis", nom: "Fromage Brebis" },
  { id: "coriandre-fraiche", nom: "Coriandre Fraîche" }, { id: "graines-coriandre", nom: "Graines de Coriandre" },
  { id: "gingembre", nom: "Gingembre" }, { id: "safran", nom: "Safran" },
];
const lire = (texte) =>
  lireRecette(texte).map((l) => {
    const r = trouverAliment(l.nom, CUISINE);
    return [l.quantite, l.unite, r.statut, r.aliment?.id ?? r.candidats.map((a) => a.id).slice(0, 2).join("|"), r.aliment ? noteIngredient(l.nomAffiche, r.aliment) : ""];
  });

test("sauce tomate : aliment le plus proche + note (« pulpe en conserve », « tournesol »), « sel et poivre » séparés", () => {
  expect(lire("1 gros oignon haché\n2 gousses d'ail hachées\n400 g de pulpe de tomates en conserve\n2 cuillères à soupe de persil haché\n1 cuillère à café de cumin\n1 cuillère à café de paprika\n6 cuillères à soupe d’Huile de tournesol\n50 cl d’eau\nSel et poivre")).toEqual([
    [1, "piece", "ok", "oignon", "gros haché"],
    [2, "piece", "ok", "ail", "hachées"],
    [400, "g", "ok", "tomate", "pulpe en conserve"],
    [2, "soupe", "ok", "persil", "haché"],
    [1, "cafe", "ok", "cumin-moulu", ""],
    [1, "cafe", "ok", "paprika", ""],
    [6, "soupe", "ok", "huile", "tournesol"],
    [500, "ml", "ok", "eau", ""],
    [null, "g", "ok", "sel", ""],
    [null, "g", "ok", "poivre-noir", ""],
  ]);
});

test("pâte : farine T45, semoule fine, levure fraîche ou sèche au choix, eau tiède, ¼ c. à café de sel", () => {
  expect(lire("200 g de farine T45\n50 g de semoule fine\n8 g de levure boulangère fraîche ou 1 càc de levure sèche\n15 cl d'eau tiède\n1/4 cuillère à café de sel")).toEqual([
    [200, "g", "ok", "farine", "T45"],
    [50, "g", "ok", "semoule", "fine"],
    [8, "g", "choix", "levure-boulangere-fraiche|levure-boulangere-seche", ""],
    [150, "ml", "ok", "eau", "tiède"],
    [0.25, "cafe", "ok", "sel", ""],
  ]);
});

test("briouates : feuilles de brick (orthographe brik), fromage + note « Kiri », pistils de safran, huile pour friture", () => {
  expect(lire("10 feuilles de brick\n250 g de blanc de poulet\n1 oignon haché\n1/2 citron confit haché\n4 portions de fromage Kiri\n2 gousses d'ail hachées\n2 cuillères à soupe de persil haché\n2 cuillères à soupe de coriandre hachée\n3 cuillères à soupe d'huile d'olive\n1 cuillère à café de gingembre en poudre\n2 pistils de safran\nSel et poivre\nHuile pour friture")).toEqual([
    [10, "piece", "ok", "feuille-brik", ""],
    [250, "g", "ok", "poulet", ""],
    [1, "piece", "ok", "oignon", "haché"],
    [0.5, "piece", "ok", "citron-confit", "haché"],
    [80, "g", "ok", "fromage", "Kiri"],
    [2, "piece", "ok", "ail", "hachées"],
    [2, "soupe", "ok", "persil", "haché"],
    [2, "soupe", "ok", "coriandre-fraiche", "hachée"],
    [3, "soupe", "ok", "huile-olive", ""],
    [1, "cafe", "ok", "gingembre", "en poudre"],
    [0.006, "g", "ok", "safran", ""],
    [null, "g", "ok", "sel", ""],
    [null, "g", "ok", "poivre-noir", ""],
    [null, "g", "ok", "huile", "pour friture"],
  ]);
});

test("litres : « 1,5 l d'eau » reste en litres", () => {
  expect(lireRecette("1,5 l d'eau\n2 litres de lait").map(({ nom, quantite, unite }) => [nom, quantite, unite])).toEqual([
    ["eau", 1.5, "l"],
    ["lait", 2, "l"],
  ]);
});

test("hachis parmentier : pièces, « bonne pincée », viande hachée, fromage à tartiner, feuilles de brick", () => {
  const CATALOGUE2 = [
    ...CUISINE,
    { id: "pomme-de-terre", nom: "Pomme de Terre" }, { id: "pomme", nom: "Pomme" }, { id: "oeuf-moyen", nom: "Oeuf" },
    { id: "boeuf-hache-5", nom: "Boeuf Haché 5%" }, { id: "boeuf-hache-20", nom: "Boeuf Haché 15%" }, { id: "viande-bovine", nom: "Viande Bovine" },
    { id: "muscade-poudre", nom: "Noix de Muscade en Poudre" }, { id: "cannelle", nom: "Cannelle" }, { id: "beurre", nom: "Beurre" },
    { id: "fromage-tartiner", nom: "Fromage à Tartiner" },
  ];
  const lignes = lireRecette("6 pommes de terre\n6 œufs\n300 g viande hachée\n1 gros oignon\n2 gousses d’ail\n1 bonne pincée de noix de muscade\n1 bonne pincée de cannelle\n2 cuil à soupe d’huile\n1 cuil à soupe de beurre\n6 fromages à tartiner de type kiri, vache qui rit\n6 feuilles de brick");
  expect(
    lignes.map((l) => {
      const r = trouverAliment(l.nom, CATALOGUE2);
      return [l.quantite, l.unite, r.statut, r.aliment?.id ?? r.candidats.map((a) => a.id).slice(0, 2).join("|"), r.aliment ? noteIngredient(l.nomAffiche, r.aliment) : ""];
    })
  ).toEqual([
    [6, "piece", "ok", "pomme-de-terre", ""],
    [6, "piece", "ok", "oeuf-moyen", ""],
    [300, "g", "ok", "boeuf-hache-20", ""],
    [1, "piece", "ok", "oignon", "gros"],
    [2, "piece", "ok", "ail", ""],
    [0.5, "g", "ok", "muscade-poudre", ""],
    [0.5, "g", "ok", "cannelle", ""],
    [2, "soupe", "ok", "huile", ""],
    [1, "soupe", "ok", "beurre", ""],
    [6, "piece", "ok", "fromage-tartiner", "type kiri, vache qui rit"],
    [6, "piece", "ok", "feuille-brik", ""],
  ]);
});

test("contenants : pot, tranches, bouquet, sachet (poids de secours si l'aliment n'en a pas)", () => {
  expect(lireRecette("1 pot de yaourt\n2 tranches de pain\n1 bouquet de persil\n1 sachet de levure").map(({ nom, quantite, unite, poidsSecours }) => [nom, quantite, unite, poidsSecours])).toEqual([
    ["yaourt", 1, "piece", null],
    ["pain", 2, "piece", null],
    ["persil", 1, "piece", null],
    ["levure", 1, "piece", 11],
  ]);
});

test("quantité en fin de ligne : « Harissa - 150g », « Sucre : 100 g », « Lait 25 cl », « oeufs 3 » ; « farine T45 » intact", () => {
  expect(lireRecette("Harissa - 150g\nSucre : 100 g\nLait 25 cl\noeufs 3\nfarine T45\nHuile pour friture").map(({ nom, nomAffiche, quantite, unite }) => [nom, nomAffiche, quantite, unite])).toEqual([
    ["harissa", "Harissa", 150, "g"],
    ["sucre", "Sucre", 100, "g"],
    ["lait", "Lait", 250, "ml"],
    ["oeufs", "oeufs", 3, "piece"],
    ["farine t45", "farine T45", null, "g"],
    ["huile pour friture", "Huile pour friture", null, "g"],
  ]);
  const [harissa] = lireRecette("harissa - 150g");
  expect(noteIngredient(harissa.nomAffiche, { id: "harissa", nom: "Harissa" })).toBe("");
});

test("houmous (format québécois) : « Nom-750 ml (3 tasses) », virgules gardées, cuillère entre parenthèses retenue", () => {
  const texte = "Pois chiches en conserve, rincés et égouttés-750 ml (3 tasses)\nBicarbonate de soude-5 ml (1 c. à thé)\nGousses d’ail, hachées-2\nTahini-250 ml (1 tasse)\nJus de lime-125 ml (½ tasse)\nEau bien froide-40 ml (8 c. à thé)\nHarissa-10 ml (2 c. à thé)\nCumin moulu-5 ml (1 c. à thé)\nSel-5 ml (1 c. à thé)\nHuile d’olive-10 ml (2 c. à thé)";
  expect(lireRecette(texte).map(({ nom, quantite, unite, alternative }) => [nom, quantite, unite, alternative ? `${alternative.quantite} ${alternative.unite}` : null])).toEqual([
    ["pois chiches en conserve, rinces et egouttes", 750, "ml", null],
    ["bicarbonate de soude", 5, "ml", "1 cafe"],
    ["gousse ail, hachees", 2, "piece", null],
    ["tahini", 250, "ml", null],
    ["jus de lime", 125, "ml", null],
    ["eau bien froide", 40, "ml", "8 cafe"],
    ["harissa", 10, "ml", "2 cafe"],
    ["cumin moulu", 5, "ml", "1 cafe"],
    ["sel", 5, "ml", "1 cafe"],
    ["huile d olive", 10, "ml", "2 cafe"],
  ]);
  const notes = lireRecette(texte).slice(0, 3).map((l) => {
    const r = trouverAliment(l.nom, [...CUISINE, { id: "pois-chiches", nom: "Pois Chiches" }]);
    return [r.aliment?.id ?? null, r.aliment ? noteIngredient(l.nomAffiche, r.aliment) : ""];
  });
  expect(notes).toEqual([
    ["pois-chiches", "en conserve, rincés et égouttés"],
    [null, ""],
    ["ail", "hachées"],
  ]);
});

test("riz djondjon : « cuill. », « dilués dans » coupé en deux, oignons verts, brins, crevettes, viande hachée 15 %", () => {
  const CATALOGUE3 = [
    ...CUISINE,
    { id: "riz", nom: "Riz" }, { id: "bouillon-boeuf", nom: "Bouillon de Bœuf" }, { id: "bouillon-poulet", nom: "Bouillon de Poulet" },
    { id: "poivron-vert", nom: "Poivron Vert" }, { id: "carotte", nom: "Carotte" }, { id: "oignon-printemps", nom: "Oignon de Printemps" },
    { id: "mais-en-conserve", nom: "Maïs en Conserve" }, { id: "curry-poudre", nom: "Curry en Poudre" }, { id: "curcuma", nom: "Curcuma" },
    { id: "thym", nom: "Thym" }, { id: "lait-coco", nom: "Lait de Coco" }, { id: "crevettes", nom: "Crevettes" },
    { id: "boeuf-hache-20", nom: "Boeuf Haché 15%" }, { id: "boeuf-hache-5", nom: "Boeuf Haché 5%" },
  ];
  const lignes = lireRecette("500 g de riz basmati\n2 cubes de bouillon djondjon dilués dans 750 ml d’eau\n1 poivron vert\n2 oignons verts\n2 cuill. à café de poudre de curry nigérian\n½ cuill. à café de curcuma en poudre\n3 brins de thym séché\n125 ml de lait de coco\n12 crevettes décortiquées\n5 brins de coriandre\n4 cuill. à soupe d’huile végétale\n300 g de viande hachée");
  expect(
    lignes.map((l) => {
      const r = trouverAliment(l.nom, CATALOGUE3);
      return [l.quantite, l.unite, r.statut, r.aliment?.id ?? r.candidats.map((a) => a.id).slice(0, 2).join("|"), r.aliment ? noteIngredient(l.nomAffiche, r.aliment) : ""];
    })
  ).toEqual([
    [500, "g", "ok", "riz", "basmati"],
    [2, "piece", "choix", "bouillon-boeuf|bouillon-poulet", ""],
    [750, "ml", "ok", "eau", ""],
    [1, "piece", "ok", "poivron-vert", ""],
    [2, "piece", "ok", "oignon-printemps", ""],
    [2, "cafe", "ok", "curry-poudre", "nigérian"],
    [0.5, "cafe", "ok", "curcuma", "en poudre"],
    [3, "g", "ok", "thym", "séché"],
    [125, "ml", "ok", "lait-coco", ""],
    [12, "piece", "ok", "crevettes", "décortiquées"],
    [5, "g", "ok", "coriandre-fraiche", ""],
    [4, "soupe", "ok", "huile", "végétale"],
    [300, "g", "ok", "boeuf-hache-20", ""],
  ]);
});
