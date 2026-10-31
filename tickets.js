// Tickets de la page Stats : ce qui a été acheté sur un jour, une semaine ou un mois, et ce que chaque niveau d'économie
// ferait gagner (1 superflu, 2 dessert : tout le payé ; 3 : l'écart avec le même article moins cher déjà acheté).
import { bornesPeriode, jourIso } from "./stats.js";

// Le même article compte comme moins cher s'il coûte au plus 85 % du prix payé.
const SEUIL_MOINS_CHER = 0.85;
const ECONOMIE_MINIMALE = 0.5;
const arrondi = (n) => Math.round(n * 100) / 100;
const lendemain = (iso) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + 1); return jourIso(d); };

export function bornesTickets({ periode, ref, debut, fin }, aujourdhui) {
    if (periode === "jour") return { debut: ref, fin: lendemain(ref) };
    // Dates choisies au calendrier : du premier au dernier jour inclus.
    if (periode === "dates") return { debut, fin: lendemain(fin) };
    const bornes = bornesPeriode({ periode, ref }, aujourdhui);
    return { debut: bornes.debut, fin: bornes.fin };
}

// Prix le plus bas connu de chaque article : médiane du prix normal (avant remise) de chaque produit, puis le produit
// le moins cher. Les fourre-tout et les lignes sans unité comparable n'entrent pas.
export function moinsChers(lignes) {
    const parProduit = new Map();
    for (const l of lignes) {
        if (!l.article_id || l.fourre_tout || !l.comparable || !(l.prix_ref_normal > 0)) continue;
        const cle = l.article_id + "|" + l.produit_id;
        const p = parProduit.get(cle) || { article_id: l.article_id, unite: l.unite_ref, enseigne: l.enseigne, prix: [] };
        p.prix.push(l.prix_ref_normal);
        parProduit.set(cle, p);
    }
    const resultat = new Map();
    for (const p of parProduit.values()) {
        // Un produit acheté une seule fois ne prouve pas qu'on l'aime ni qu'on le trouve.
        if (p.prix.length < 2) continue;
        const tries = p.prix.sort((a, b) => a - b);
        const mediane = tries[Math.floor(tries.length / 2)];
        const actuel = resultat.get(p.article_id);
        if (!actuel || mediane < actuel.prix) resultat.set(p.article_id, { prix: mediane, unite: p.unite, enseigne: p.enseigne });
    }
    return resultat;
}

// Niveau d'une ligne et ce qu'il ferait gagner.
export function economieLigne(l, moinsCher) {
    if (l.a_reduire) return { niveau: l.a_reduire, economie: l.paye };
    const m = moinsCher.get(l.article_id);
    if (!m || l.fourre_tout || !l.comparable || !(l.quantite_ref > 0) || l.unite_ref !== m.unite) return null;
    if (m.prix > l.prix_ref_paye * SEUIL_MOINS_CHER) return null;
    return { niveau: 3, economie: arrondi(l.quantite_ref * (l.prix_ref_paye - m.prix)), alternative: m };
}

const UNITES = { kg: "kg", l: "l", piece: "pièce" };

// Ce qui est montré pour un article : nom lisible (jamais le libellé du ticket), quantité, dépense et économie.
function regrouper(lignes, moinsCher) {
    const articles = new Map();
    for (const l of lignes) {
        const cle = l.fourre_tout || !l.article_id ? "autres-" + (l.racine || "a-classer") : l.article_id;
        const a = articles.get(cle) || {
            id: cle,
            nom: l.fourre_tout || !l.article_id ? (l.racine === "alimentation" ? "Autres aliments" : "Autres achats") : l.article,
            emoji: l.emoji || null, racine: l.racine || null, kg: 0, pieces: 0, depense: 0, niveau: null, economie: 0, alternative: null, produits: new Set(),
        };
        if (l.unite_vente === "kg") a.kg += l.quantite; else a.pieces += l.quantite;
        a.depense += l.paye;
        a.produits.add(l.produit_id);
        const e = economieLigne(l, moinsCher);
        if (e) { a.niveau = a.niveau ?? e.niveau; a.economie += e.economie; a.alternative = a.alternative ?? e.alternative ?? null; }
        articles.set(cle, a);
    }
    // Moins de 50 centimes de gagnés : pas la peine de changer ses habitudes.
    for (const a of articles.values()) if (a.niveau === 3 && a.economie < ECONOMIE_MINIMALE) { a.niveau = null; a.economie = 0; a.alternative = null; }
    return [...articles.values()].map((a) => ({
        id: a.id, nom: a.nom, emoji: a.emoji, racine: a.racine,
        quantite: a.id.startsWith("autres-") ? `${a.produits.size} produit${a.produits.size > 1 ? "s" : ""}`
            // Acheté au poids et à la pièce : les deux quantités côte à côte, jamais additionnées.
            : [a.pieces && `×${arrondi(a.pieces).toLocaleString("fr-FR")}`, a.kg && `${arrondi(a.kg).toLocaleString("fr-FR")} kg`].filter(Boolean).join(" · "),
        depense: arrondi(a.depense),
        niveau: a.niveau,
        economie: arrondi(a.economie),
        alternative: a.alternative && { prix: a.alternative.prix, unite: UNITES[a.alternative.unite] || a.alternative.unite, enseigne: a.alternative.enseigne },
    })).sort((x, y) => y.depense - x.depense);
}

const sommeNiveaux = (articles) => {
    const s = { 1: 0, 2: 0, 3: 0 };
    for (const a of articles) if (a.niveau) s[a.niveau] = arrondi(s[a.niveau] + a.economie);
    return s;
};

// Réponse de GET /api/stats/tickets. `lignes` : lignes de la période ; `lignesAn` : 12 derniers mois (prix bas et
// montants par an) ; `tickets` : passages de la période ; `jours` : jours avec un passage (navigation par jour).
export function detailTickets({ lignes, lignesAn, tickets, jours, periode, ref, debut, fin, preferes = new Set() }) {
    const moinsCher = moinsChers(lignesAn);
    // Un article gardé par choix (gros œufs à Marché Frais) ne reçoit plus de suggestion « moins cher ».
    for (const id of preferes) moinsCher.delete(id);
    const articles = regrouper(lignes, moinsCher);
    const parTicket = new Map();
    for (const l of lignes) parTicket.set(l.ticket_id, [...(parTicket.get(l.ticket_id) || []), l]);
    const listeTickets = tickets.map((t) => {
        const contenu = regrouper(parTicket.get(t.id) || [], moinsCher);
        return { id: t.id, jour: t.jour, magasin: t.magasin, enseigne: t.enseigne, paye: t.paye, detaille: contenu.length > 0,
            nbArticles: (parTicket.get(t.id) || []).length, economies: sommeNiveaux(contenu), articles: contenu };
    });
    const annuel = sommeNiveaux(regrouper(lignesAn, moinsCher));
    const niveaux = [1, 2, 3].map((n) => {
        const concernes = articles.filter((a) => a.niveau === n);
        return { niveau: n, economie: sommeNiveaux(concernes)[n], parAn: annuel[n], noms: concernes.map((a) => a.nom) };
    });
    // Pas de flèches sur des dates choisies au calendrier.
    const avant = periode === "dates" ? [] : jours.filter((j) => j < debut), apres = periode === "dates" ? [] : jours.filter((j) => j >= fin);
    return {
        periode, ref, debut, fin,
        total: arrondi(tickets.reduce((s, t) => s + t.paye, 0)),
        nbArticles: lignes.length,
        niveaux, articles, tickets: listeTickets,
        premierAchat: jours[0] ?? null,
        precedent: avant.length ? avant[avant.length - 1] : null,
        suivant: apres.length ? apres[0] : null,
    };
}
