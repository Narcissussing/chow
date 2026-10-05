const FRACTIONS = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

const UNITES = [
  { motif: /^(kg|kilos?|kilogrammes?)$/, unite: "g", facteur: 1000 },
  { motif: /^(mg|milligrammes?)$/, unite: "g", facteur: 0.001 },
  { motif: /^(g|gr|grs|grammes?)$/, unite: "g", facteur: 1 },
  { motif: /^(l|litres?|liters?)$/, unite: "l", facteur: 1 },
  { motif: /^(dl|decilitres?)$/, unite: "ml", facteur: 100 },
  { motif: /^(cl|centilitres?)$/, unite: "ml", facteur: 10 },
  { motif: /^(ml|millilitres?)$/, unite: "ml", facteur: 1 },
  { motif: /^(cups?|tasses?)$/, unite: "ml", facteur: 240 },
  { motif: /^(cuilleres? a (cafe|the)|cuill?\.? a (cafe|the)|c\.? ?a (cafe|the)|c\.? ?a\.? ?c\.?|cac|cc|tsp|teaspoons?)$/, unite: "cafe", facteur: 1 },
  { motif: /^(cuilleres? a soupe|cuill?\.? a soupe|c\.? ?a soupe|c\.? ?a\.? ?s\.?|cas|cs|tbsp|tbs|tablespoons?)$/, unite: "soupe", facteur: 1 },
  { motif: /^(brins?)$/, unite: "g", facteur: 1, approx: true },
  { motif: /^(sachets?)$/, unite: "piece", facteur: 1, secours: 11 },
  { motif: /^(cubes?)$/, unite: "piece", facteur: 1, secours: 10 },
  { motif: /^(filets?)$/, unite: "piece", facteur: 1, secours: 5 },
  { motif: /^(pots?|tranches?|bouquets?|bottes?|feuilles?|paves?|boules?|paquets?|morceaux?)$/, unite: "piece", facteur: 1 },
  { motif: /^(pincees?|pinch(es)?)$/, unite: "g", facteur: 0.5, approx: true },
  { motif: /^(batons?)$/, unite: "g", facteur: 3, approx: true },
  { motif: /^(portions?)$/, unite: "g", facteur: 20, approx: true },
  { motif: /^(pistils?)$/, unite: "g", facteur: 0.003, approx: true },
  { motif: /^(gousses?)$/, unite: "piece", facteur: 1, garderMot: "gousse" },
  { motif: /^(pieces?|pcs?|unites?)$/, unite: "piece", facteur: 1 },
];

const MOTS_UNITES = "kg|kilos?|kilogrammes?|mg|milligrammes?|g|gr|grs|grammes?|l|litres?|liters?|dl|decilitres?|cl|centilitres?|ml|millilitres?|cups?|tasses?|cuilleres? a (?:cafe|the)|cuill?\\.? a (?:cafe|the)|c\\.? ?a (?:cafe|the)|cuilleres? a soupe|cuill?\\.? a soupe|c\\.? ?a soupe|c\\.? ?a\\.? ?c\\.?|c\\.? ?a\\.? ?s\\.?|cac|cas|cc|cs|tsp|teaspoons?|tbsp|tbs|tablespoons?|sachets?|pincees?|pinch(?:es)?|batons?|portions?|pistils?|cubes?|gousses?|pieces?|pcs?|unites?|filets?|pots?|tranches?|bouquets?|bottes?|feuilles?|paves?|boules?|paquets?|morceaux?|brins?";
const NOMBRE = "\\d+(?:[.,]\\d+)?(?:\\s+\\d+\\/\\d+)?|\\d+\\/\\d+|[½¼¾⅓⅔]";
const LIGNE = new RegExp(`^(${NOMBRE})?\\s*(${MOTS_UNITES})?\\.?(?:\\s+|$)(.*)$`);
const SEULE_QUANTITE = new RegExp(`^(${NOMBRE})\\s*(${MOTS_UNITES})?\\.?$`);
const DESCRIPTIFS = new Set([
  "poudre", "rape", "rapee", "monde", "mondee", "hache", "hachee", "emince", "emincee", "frais", "fraiche", "sec", "seche",
  "entier", "entiere", "gousse", "cube", "baton", "feuille", "branche", "brin", "gros", "grosse", "petit", "petite",
  "moyen", "moyenne", "fin", "fine", "concasse", "concassee", "cuit", "cuite", "cru", "crue", "nature",
]);
const MEMES_MOTS = { moulu: "poudre", moulue: "poudre" };

const EXPRESSIONS = [
  [/\bsucre (de )?canne\b|\bsucre roux\b|\bcassonade\b|\bvergeoise\b|\bbrown sugar\b/g, "sucre brun"],
  [/\bbri(c|ck|ks?)\b/g, "brik"],
  [/\bviandes? hachees?\b/g, "boeuf hache 15"],
  [/\boignons? verts?\b|\bcebettes?\b|\bciboules?\b|\bspring onions?\b|\bgreen onions?\b/g, "oignon printemps"],
];
const SYNONYMES = { gelatine: "agar agar", gelatin: "agar agar" };
const MOTS_VIDES = new Set(["de", "d", "du", "des", "la", "le", "les", "l", "en", "a", "au", "aux", "et", "of", "the", "un", "une"]);

export function normaliser(texte) {
  return String(texte)
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, " ")
    .trim();
}

function lireNombre(brut) {
  if (!brut) return null;
  if (FRACTIONS[brut] !== undefined) return FRACTIONS[brut];
  const [entier, fraction] = brut.includes(" ") ? brut.split(/\s+/) : [brut, null];
  const valeur = (t) => (t.includes("/") ? Number(t.split("/")[0]) / Number(t.split("/")[1]) : Number(t.replace(",", ".")));
  return valeur(entier) + (fraction ? valeur(fraction) : 0);
}

export function mots(texte) {
  return normaliser(texte)
    .split(/[^a-z0-9]+/)
    .filter((m) => m && !MOTS_VIDES.has(m))
    .map((m) => (m.length > 3 && /[sx]$/.test(m) ? m.slice(0, -1) : m))
    .map((m) => MEMES_MOTS[m] ?? m);
}

function aplatir(texte) {
  return String(texte).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, " ");
}

function nomTelQuEcrit(origine) {
  const plat = aplatir(origine);
  const reste = (plat.match(LIGNE) || [])[3] ?? plat;
  let affiche = origine.slice(origine.length - reste.length);
  const article = aplatir(affiche).match(/^(de|d|du|des|of)\s+/);
  if (article) affiche = affiche.slice(article[0].length);
  return affiche.replace(/\s*\(.*\)\s*$/, "").trim();
}

const ADJECTIF_AVANT_UNITE = new RegExp(`^(${NOMBRE})\\s+(?:bonnes?|bons?|grosses?|gros|petites?|petits?|belles?|beaux?)\\s+(?=(?:${MOTS_UNITES})\\b)`);

const QUANTITE_EN_FIN = new RegExp(`^(.*?\\S)(?:\\s*[-–—:]\\s*|\\s+)((?:${NOMBRE})\\s*(?:(?:${MOTS_UNITES})\\.?)?)$`);

function lireParenthese(origine) {
  const parenthese = origine.match(/\s*\(([^)]*)\)\s*$/);
  if (!parenthese || /^\s*(ou|or)\b/i.test(parenthese[1])) return { sans: origine, alternative: null };
  const [, nombre, uniteLue] = normaliser(parenthese[1]).match(LIGNE) || [];
  const regle = uniteLue ? UNITES.find((u) => u.motif.test(uniteLue.replace(/\.$/, ""))) : null;
  const quantite = lireNombre(nombre);
  const alternative = regle && quantite !== null && ["cafe", "soupe"].includes(regle.unite) ? { quantite: quantite * regle.facteur, unite: regle.unite } : null;
  return { sans: origine.slice(0, parenthese.index), alternative };
}

function lireLigne(texte, dejaRetourne = false, alternativeConnue = null) {
  const { sans, alternative: alternativeLue } = lireParenthese(texte.trim().replace(/^[-•*·]\s*/, ""));
  const alternative = alternativeConnue ?? alternativeLue;
  let origine = sans.trim();
  const adjectif = aplatir(origine).match(ADJECTIF_AVANT_UNITE);
  if (adjectif) origine = `${origine.slice(0, adjectif[1].length)} ${origine.slice(adjectif[0].length)}`;
  const propre = normaliser(origine);
  const [, nombre, uniteLue, reste] = propre.match(LIGNE) || [];
  const quantite = lireNombre(nombre);
  const regle = uniteLue ? UNITES.find((u) => u.motif.test(uniteLue.replace(/\.$/, ""))) : null;
  const nom = (reste ?? propre)
    .replace(/^(de|d|du|des|of)\s+/, "")
    .replace(/\(\s*(ou|or)\s+([^)]*)\)/, " ou $2")
    .replace(/\s*\(.*\)\s*$/, "")
    .trim();
  const nomAffiche = nomTelQuEcrit(origine);
  if (quantite === null && !dejaRetourne) {
    const enFin = aplatir(origine).match(QUANTITE_EN_FIN);
    if (enFin) return lireLigne(`${origine.slice(origine.length - enFin[2].length)} ${origine.slice(0, enFin[1].length)}`, true, alternative);
  }
  if (quantite === null) return { brut: texte.trim(), nom: nom || propre, nomAffiche, quantite: null, unite: "g", approx: false, alternative };
  if (!regle) return { brut: texte.trim(), nom, nomAffiche, quantite, unite: "piece", approx: false, alternative };
  if (/^bouquets?$/.test(uniteLue) && /^garnis?\b/.test(nom)) return { brut: texte.trim(), nom: `bouquet ${nom}`, nomAffiche, quantite, unite: "piece", approx: false, poidsSecours: null, alternative };
  const nomFinal = regle.garderMot && !nom.startsWith(regle.garderMot) ? `${regle.garderMot} ${nom}` : nom;
  return { brut: texte.trim(), nom: nomFinal, nomAffiche, quantite: quantite * regle.facteur, unite: regle.unite, approx: Boolean(regle.approx || regle.secours), poidsSecours: regle.secours ?? null, alternative };
}

const DANS = /\s+(?:dilu|delay|melang)[a-z]*\s+dans\s+/;
function couperDans(brute) {
  const coupe = aplatir(brute).match(DANS);
  if (!coupe) return [brute];
  return [brute.slice(0, coupe.index), brute.slice(coupe.index + coupe[0].length)];
}

function separer(ligne) {
  if (ligne.quantite !== null || /\(|\d/.test(ligne.brut)) return [ligne];
  const morceaux = ligne.brut.split(/\s+(?:et|and|&)\s+|\s*,\s*/i).map((m) => m.trim()).filter(Boolean);
  if (morceaux.length < 2 || morceaux.some((m) => m.split(/\s+/).length > 3)) return [ligne];
  return morceaux.map((m) => lireLigne(m));
}

export function lireRecette(texte) {
  const brutes = String(texte)
    .split(/\r?\n/)
    .map((l) => l.replace(/\((?:e?s|x)\)/gi, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((l, i, liste) => i === 0 || normaliser(l) !== normaliser(liste[i - 1]))
    .flatMap(couperDans);
  const seuleQuantite = (l) => l !== undefined && SEULE_QUANTITE.test(normaliser(l));
  const lignes = [];
  for (let i = 0; i < brutes.length; i++) {
    const suiteMarmiton = /^(de|d'|d’|du|des)\b/i.test(brutes[i + 2] || "");
    if (!seuleQuantite(brutes[i]) && seuleQuantite(brutes[i + 1]) && !suiteMarmiton) {
      lignes.push(lireLigne(`${brutes[i + 1]} ${brutes[i]}`));
      i++;
    } else if (seuleQuantite(brutes[i]) && brutes[i + 1]) {
      lignes.push(lireLigne(`${brutes[i]} ${brutes[i + 1]}`));
      i++;
    } else {
      lignes.push(lireLigne(brutes[i]));
    }
  }
  return lignes.flatMap(separer).filter((l) => l.nom);
}

function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function score(motsLus, aliment) {
  const motsAliment = mots(aliment.nom);
  if (motsLus.join("-") === aliment.id || motsLus.join(" ") === motsAliment.join(" ")) return 100;
  const essentiels = motsLus.filter((m) => !DESCRIPTIFS.has(m));
  const cles = essentiels.length ? essentiels : motsLus;
  const enTrop = motsAliment.filter((m) => !motsLus.includes(m) && !DESCRIPTIFS.has(m)).length;
  const descriptifsCommuns = motsLus.filter((m) => DESCRIPTIFS.has(m) && motsAliment.includes(m)).length;
  const communs = cles.filter((m) => motsAliment.includes(m)).length;
  if (communs === cles.length) return 80 - 5 * enTrop + 5 * descriptifsCommuns;
  if (communs > 0) return 40 + 10 * communs - 5 * enTrop;
  const proche = motsLus.some((m) => m.length >= 4 && motsAliment.some((n) => n.length >= 4 && distance(m, n) <= 1));
  return proche ? 30 : 0;
}

function motsRecherche(nom) {
  const texte = EXPRESSIONS.reduce((t, [motif, remplacement]) => t.replace(motif, remplacement), normaliser(nom));
  return mots(texte).flatMap((m) => (SYNONYMES[m] ? mots(SYNONYMES[m]) : [m]));
}

const essentielsAliment = (aliment) => mots(aliment.nom).filter((m) => m === "gousse" || !DESCRIPTIFS.has(m));

function alimentContenu(nom, classes) {
  const lus = new Set(motsRecherche(nom));
  const inclus = classes
    .map((c) => ({ aliment: c.aliment, essentiels: essentielsAliment(c.aliment) }))
    .map((c) => ({ ...c, taille: c.essentiels.length }))
    .filter((c) => c.taille > 0 && c.essentiels.every((m) => lus.has(m)))
    .sort((a, b) => b.taille - a.taille);
  if (inclus.length === 0 || (inclus[1] && inclus[1].taille === inclus[0].taille)) return null;
  return inclus[0].aliment;
}

function rapprocher(nom, aliments) {
  const motsLus = motsRecherche(nom);
  if (motsLus.length === 0) return [];
  return aliments
    .map((a) => ({ aliment: a, score: score(motsLus, a) }))
    .filter((c) => c.score >= 30)
    .sort((a, b) => b.score - a.score || a.aliment.nom.localeCompare(b.aliment.nom));
}

export function alternatives(nom) {
  return normaliser(nom)
    .split(/\s+(?:ou|or)\s+|\s*\/\s*/)
    .map((alt) => alt.replace(new RegExp(`^(?:(?:${NOMBRE})\\s*(?:${MOTS_UNITES})?\\.?\\s+)`), "").replace(/^(de|d|du|des|of)\s+/, "").trim())
    .filter(Boolean);
}

export function trouverAliment(nom, aliments, memoire = {}) {
  const retenu = memoire[normaliser(nom)];
  const alts = alternatives(nom);
  if (alts.length > 1) {
    const parAlt = alts.map((alt) => rapprocher(alt, aliments));
    const tete = parAlt.map((c) => c[0]?.aliment).filter(Boolean);
    const reste = parAlt.flatMap((c) => c.slice(1).map((x) => x.aliment));
    const candidats = [...new Map([...tete, ...reste].map((a) => [a.id, a])).values()].slice(0, 6);
    const memorise = aliments.find((a) => String(a.id) === retenu);
    if (memorise) return { statut: "ok", aliment: memorise, candidats };
    if (candidats.length === 0) return { statut: "inconnu", aliment: null, candidats: [] };
    return tete.length > 1 ? { statut: "choix", aliment: null, candidats } : trouverAliment(alts.find((_, i) => parAlt[i].length) ?? alts[0], aliments);
  }
  const classes = rapprocher(nom, aliments);
  const memorise = aliments.find((a) => String(a.id) === retenu);
  if (memorise) return { statut: "ok", aliment: memorise, candidats: [memorise, ...classes.map((c) => c.aliment).filter((a) => a !== memorise)].slice(0, 5) };
  if (classes.length === 0) return { statut: "inconnu", aliment: null, candidats: [] };
  const [premier, second] = classes;
  const net = premier.score >= 75 && (!second || second.score <= premier.score - 10);
  const contenu = net ? null : alimentContenu(nom, classes);
  if (contenu) return { statut: "ok", aliment: contenu, candidats: classes.slice(0, 5).map((c) => c.aliment) };
  return {
    statut: net ? "ok" : "choix",
    aliment: net ? premier.aliment : null,
    candidats: classes.slice(0, 5).map((c) => c.aliment),
  };
}

export function noteIngredient(nomAffiche, aliment) {
  if (!nomAffiche || !aliment) return "";
  const motsAliment = new Set(mots(aliment.nom));
  const cle = (jeton) => motsRecherche(jeton)[0];
  const article = (jeton) => /^(de|d|du|des|of)$/.test(aplatir(jeton).trim());
  const jetons = nomAffiche.split(/\s+/).filter(Boolean);
  const plat = aplatir(nomAffiche);
  const couverts = [];
  for (const [motif] of EXPRESSIONS) for (const m of plat.matchAll(new RegExp(motif.source, "g"))) couverts.push([m.index, m.index + m[0].length]);
  let position = 0;
  const debuts = jetons.map((jeton) => {
    const debut = nomAffiche.indexOf(jeton, position);
    position = debut + jeton.length;
    return debut;
  });
  const estCouvert = (i) => couverts.some(([a, b]) => debuts[i] < b && debuts[i] + jetons[i].length > a);
  const gardes = jetons.filter((jeton, i) => {
    const k = cle(jeton);
    if (estCouvert(i)) return false;
    if (k && (motsAliment.has(k) || k === "gousse")) return false;
    if (!k && jetons[i + 1] && motsAliment.has(cle(jetons[i + 1]))) return false;
    return true;
  });
  while (gardes.length && article(gardes[0])) gardes.shift();
  while (gardes.length && article(gardes[gardes.length - 1])) gardes.pop();
  return gardes.join(" ");
}
