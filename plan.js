// Mon plan (Stats → Tickets) et aliments jetés (Paramètres) : habitudes d'achat par mois sur 12 mois, et ce que chaque
// choix du foyer (garder, moins, arrêter, changer pour le moins cher) fait gagner par mois.
import { economieLigne, moinsChers } from "./tickets.js";

const arrondi = (n) => Math.round(n * 100) / 100;
// Économie « moins cher » qui vaut d'être proposée dans le plan : au moins 6 € par an.
const CHANGER_MINIMUM_AN = 6;

// Format le plus acheté : « 125 g », « 1 l », « 12 » (pièces) ; rien si le ticket ne le dit pas.
function formatHabituel(formats = []) {
    if (!formats.length) return null;
    const compte = new Map();
    for (const f of formats) { const cle = f.unite + "|" + Math.round(f.valeur * 1000) / 1000; compte.set(cle, (compte.get(cle) || 0) + 1); }
    const [unite, v] = [...compte].sort((a, b) => b[1] - a[1])[0][0].split("|");
    const valeur = Number(v);
    if (unite === "piece") return valeur > 1 ? `${valeur}` : null;
    if (unite === "kg") return valeur < 1 ? `${Math.round(valeur * 1000)} g` : `${valeur.toLocaleString("fr-FR")} kg`;
    return valeur < 1 ? `${Math.round(valeur * 100)} cl` : `${valeur.toLocaleString("fr-FR")} l`;
}

// Habitude d'un article : quantité et dépense par mois, dans son unité d'achat la plus courante (kg ou nombre).
export function habitudes(lignesAn, aujourdhui) {
    const parArticle = new Map();
    for (const l of lignesAn) {
        if (!l.article_id || l.fourre_tout) continue;
        const a = parArticle.get(l.article_id) || { id: l.article_id, nom: l.article, emoji: l.emoji, racine: l.racine, a_reduire: l.a_reduire, premier: l.jour, kg: 0, nb: 0, depenseKg: 0, depenseNb: 0, lignes: [] };
        if (l.unite_vente === "kg") { a.kg += l.quantite; a.depenseKg += l.paye; } else {
            a.nb += l.quantite; a.depenseNb += l.paye;
            // Format d'une unité vendue, lu sur le ticket (« 125 g », « 12 ») : ce que vaut « 1 » à l'écran.
            if (l.quantite_ref > 0) (a.formats ||= []).push({ valeur: l.quantite_ref / l.quantite, unite: l.unite_ref });
        }
        if (l.jour < a.premier) a.premier = l.jour;
        a.lignes.push(l);
        parArticle.set(l.article_id, a);
    }
    const resultat = new Map();
    for (const a of parArticle.values()) {
        // Un article découvert il y a 3 mois se compte sur 3 mois, pas sur 12.
        const mois = Math.min(12, Math.max(1, (new Date(aujourdhui) - new Date(a.premier)) / (30.44 * 86400000)));
        const auPoids = a.depenseKg > a.depenseNb;
        const quantite = auPoids ? a.kg : a.nb, depenseUnite = auPoids ? a.depenseKg : a.depenseNb;
        resultat.set(a.id, {
            id: a.id, nom: a.nom, emoji: a.emoji, racine: a.racine, a_reduire: a.a_reduire, lignes: a.lignes,
            unite: auPoids ? "kg" : "piece",
            quantiteMois: quantite / mois,
            depenseMois: (a.depenseKg + a.depenseNb) / mois,
            prixUnite: quantite ? depenseUnite / quantite : 0,
            format: auPoids ? null : formatHabituel(a.formats),
            mois,
        });
    }
    return resultat;
}

export function economieMois(h, choix) {
    if (!choix) return 0;
    if (choix.decision === "arreter") return h.depenseMois;
    if (choix.decision === "moins") return Math.max(0, h.quantiteMois - (choix.quantite_visee ?? h.quantiteMois)) * h.prixUnite;
    if (choix.decision === "changer") return h.changerMois || 0;
    return 0;
}

// Articles du plan, rangés par section : à arrêter, desserts, moins cher, jeté, mes choix.
export function plan({ lignesAn, choix, jetes, aujourdhui }) {
    const moinsCher = moinsChers(lignesAn);
    const hab = habitudes(lignesAn, aujourdhui);
    const choixPar = new Map(choix.map((c) => [c.article_id, c]));
    const jetePar = new Map();
    for (const j of jetes) jetePar.set(j.article_id, (jetePar.get(j.article_id) || 0) + j.quantite);
    const articles = [];
    for (const h of hab.values()) {
        let gainAn = 0, alternative = null;
        for (const l of h.lignes) {
            const e = economieLigne(l, moinsCher);
            if (e?.niveau === 3) { gainAn += e.economie; alternative = alternative ?? e.alternative; }
        }
        h.changerMois = gainAn / h.mois;
        const c = choixPar.get(h.id) || null;
        const section = h.a_reduire === 1 ? "arreter" : h.a_reduire === 2 ? "desserts"
            : c?.preference ? "choix"
            : jetePar.has(h.id) ? "jete"
            : gainAn * (12 / h.mois) >= CHANGER_MINIMUM_AN ? "moins-cher"
            : c ? "choix" : null;
        if (!section) continue;
        articles.push({
            id: h.id, nom: h.nom, emoji: h.emoji, section,
            unite: h.unite,
            quantiteMois: arrondi(h.quantiteMois),
            depenseMois: arrondi(h.depenseMois),
            prixUnite: arrondi(h.prixUnite),
            changerMois: arrondi(h.changerMois),
            alternative: alternative && { prix: alternative.prix, unite: alternative.unite, enseigne: alternative.enseigne },
            jete: jetePar.get(h.id) ?? null,
            choix: c && { decision: c.decision, quantiteVisee: c.quantite_visee === null ? null : Number(c.quantite_visee), preference: c.preference },
            economieMois: arrondi(economieMois(h, c)),
        });
    }
    const ordre = ["arreter", "desserts", "moins-cher", "jete", "choix"];
    articles.sort((a, b) => ordre.indexOf(a.section) - ordre.indexOf(b.section) || b.depenseMois - a.depenseMois);
    return { articles, economieMois: arrondi(articles.reduce((s, a) => s + a.economieMois, 0)) };
}
