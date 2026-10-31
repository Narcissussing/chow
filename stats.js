// Calculs de la page Stats à partir des tickets de caisse. Les dates sont des chaînes "AAAA-MM-JJ" (heure locale).

const RAYONS = {
    Viandes: "Viandes & poissons", Poissons: "Viandes & poissons", Oeufs: "Viandes & poissons",
    Légumes: "Fruits & légumes", Fruits: "Fruits & légumes",
    Laitiers: "Crèmerie",
};
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const LETTRES_MOIS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const JOURS = ["L", "M", "M", "J", "V", "S", "D"];

export function jourIso(date) {
    const p = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
const versDate = (iso) => new Date(iso + "T00:00:00");
const ajouterJours = (iso, n) => { const d = versDate(iso); d.setDate(d.getDate() + n); return jourIso(d); };
const ajouterMois = (iso, n) => { const d = versDate(iso); d.setMonth(d.getMonth() + n); return jourIso(d); };
const lundi = (iso) => { const d = versDate(iso); return ajouterJours(iso, -((d.getDay() + 6) % 7)); };
const ecartJours = (a, b) => Math.round((versDate(b) - versDate(a)) / 86400000);

export function rayonDe(ligne) {
    if (ligne.statut === "non-alimentaire") return "Non Chow";
    if (ligne.statut !== "chow") return "Autres";
    return RAYONS[ligne.categorie] || "Épicerie";
}

// Période [debut, fin[ et la période précédente de même nature, pour les comparaisons.
export function bornesPeriode({ periode = "annee", ref, debut, fin }, aujourdhui, premierJour) {
    const r = ref || aujourdhui;
    if (periode === "semaine") { const d = lundi(r); return { debut: d, fin: ajouterJours(d, 7), precedent: [ajouterJours(d, -7), d] }; }
    if (periode === "mois") { const d = r.slice(0, 8) + "01"; return { debut: d, fin: ajouterMois(d, 1), precedent: [ajouterMois(d, -1), d] }; }
    if (periode === "12mois") { const f = ajouterJours(aujourdhui, 1), d = ajouterMois(f, -12); return { debut: d, fin: f, precedent: [ajouterMois(d, -12), d] }; }
    if (periode === "tout") return { debut: premierJour, fin: ajouterJours(aujourdhui, 1), precedent: null };
    if (periode === "dates" && debut && fin) { const f = ajouterJours(fin, 1), n = ecartJours(debut, f); return { debut, fin: f, precedent: [ajouterJours(debut, -n), debut] }; }
    const d = r.slice(0, 4) + "-01-01";
    return { debut: d, fin: ajouterMois(d, 12), precedent: [ajouterMois(d, -12), d] };
}

// Fenêtre des barres « Dépenses » : la nature choisie, en remontant depuis la période sélectionnée
// (12 semaines, 12 mois, ou toutes les années). Une plage de dates se découpe en jours, semaines ou mois.
export function fenetreBarres(periode, debut, fin, premierJour, aujourdhui) {
    if (periode === "semaine") return { pas: "semaine", debut: ajouterJours(debut, -7 * 11), fin };
    if (periode === "mois") return { pas: "mois", debut: ajouterMois(debut, -11), fin };
    if (periode === "annee" || periode === "tout") {
        const finAnnees = periode === "annee" ? fin : ajouterMois(aujourdhui.slice(0, 4) + "-01-01", 12);
        const debutAnnees = premierJour.slice(0, 4) + "-01-01";
        return { pas: "annee", debut: debut < debutAnnees ? debut : debutAnnees, fin: finAnnees };
    }
    if (periode === "dates") {
        const n = ecartJours(debut, fin);
        return { pas: n <= 31 ? "jour" : n <= 120 ? "semaine" : "mois", debut, fin };
    }
    return { pas: "mois", debut, fin };
}

export function decouper(debut, fin, pas) {
    const seaux = [];
    let d = pas === "semaine" ? lundi(debut) : pas === "mois" ? debut.slice(0, 8) + "01" : pas === "annee" ? debut.slice(0, 4) + "-01-01" : debut;
    while (d < fin) {
        const suivant = pas === "jour" ? ajouterJours(d, 1) : pas === "semaine" ? ajouterJours(d, 7) : ajouterMois(d, pas === "annee" ? 12 : 1);
        const date = versDate(d);
        const etiquette = pas === "jour" ? JOURS[(date.getDay() + 6) % 7]
            : pas === "semaine" ? `${date.getDate()}/${date.getMonth() + 1}`
            : pas === "annee" ? d.slice(0, 4) : MOIS_COURTS[date.getMonth()];
        seaux.push({ debut: d, fin: suivant, etiquette, total: 0 });
        d = suivant;
    }
    return { pas, seaux };
}

const somme = (lignes) => lignes.reduce((s, l) => s + l.total, 0);
const arrondi = (n, c = 2) => Math.round(n * 10 ** c) / 10 ** c;
function mediane(v) {
    const t = [...v].sort((a, b) => a - b), m = t.length >> 1;
    return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

export function quantile(valeurs, q) {
    const tri = [...valeurs].sort((a, b) => a - b);
    const position = (tri.length - 1) * q;
    const bas = Math.floor(position);
    return tri[bas] + (tri[Math.ceil(position)] - tri[bas]) * (position - bas);
}

// Prévision d'un article des Courses à partir de ses passages en caisse, du plus récent au plus ancien
// ({ cout, quantite_ref, nombre, au_poids, unite, enseigne, remise }).
// - Prix normal : passages sans remise ; une promo fait acheter plus et moins cher, elle ne dit rien des habitudes.
// - Prévision : quantité habituelle (médiane des 8 derniers) × dernier prix normal, dans le magasin choisi s'il y est connu.
// - Fourchette : chaque achat normal passé est rejoué avec ce qui était connu avant lui ; les écarts entre prévu et
//   payé (8 derniers) donnent la fourchette, qui se resserre à mesure que les prévisions tombent juste.
// Renvoie null si les passages ne se comparent pas dans une même unité (kg, l ou pièce).
export function prevoirArticle(passages, magasin = null) {
    if (!passages.length || !passages.every((p) => p.au_poids === passages[0].au_poids && p.unite === passages[0].unite)) return null;
    const quantiteDe = (p) => (p.au_poids ? p.quantite_ref : p.nombre);
    const normaux = passages.filter((p) => !(p.remise > 0));
    const base = normaux.length ? normaux : passages;
    const prevoir = (connus, ou) => {
        const reference = (ou && connus.find((p) => p.enseigne === ou)) || connus[0];
        const quantite = quantile(connus.slice(0, 8).map(quantiteDe), 0.5);
        return { quantite, prixUnitaire: reference.cout / quantiteDe(reference), magasin: reference.enseigne };
    };
    const p = prevoir(base, magasin);
    const estimation = p.quantite * p.prixUnitaire;
    const ecarts = [];
    for (let i = base.length - 2; i >= 0; i--) {
        const avant = prevoir(base.slice(i + 1), base[i].enseigne);
        ecarts.push(base[i].cout / (avant.quantite * avant.prixUnitaire));
    }
    const recents = ecarts.slice(-8);
    const [bas, haut] = recents.length >= 3 ? [quantile(recents, 0.25), quantile(recents, 0.75)] : [0.85, 1.15];
    return {
        estimation: arrondi(estimation),
        bas: arrondi(estimation * Math.min(1, bas)),
        haut: arrondi(estimation * Math.max(1, haut)),
        quantite: arrondi(p.quantite),
        prixUnitaire: arrondi(p.prixUnitaire),
        magasin: p.magasin,
        comparaisons: recents.length,
    };
}

// Prix comparable d'une ligne : au kg ou au litre si la contenance est connue, sinon à la pièce.
const prixLigne = (l) => (l.prix_ref ?? l.total / (l.quantite || 1));

// Moyenne géométrique de rapports de prix, chaque aliment pesant ce que le foyer y dépense (comme les indices
// officiels, pondérés par la consommation). Rapport aberrant (contenance mal lue) borné entre ÷3 et ×3.
function moyennePonderee(rapports) {
    const poids = rapports.reduce((s, r) => s + r.poids, 0);
    if (!poids) return null;
    return Math.exp(rapports.reduce((s, r) => s + r.poids * Math.log(Math.min(3, Math.max(1 / 3, r.rapport))), 0) / poids);
}

// Indice des prix du panier. Base 100 = premier prix de chaque aliment dans la période.
export function indicePanier(lignes, moisListe) {
    const parAlimentMois = new Map();
    const depenses = new Map();
    for (const l of lignes) {
        if (l.statut !== "chow" || !l.food_id) continue;
        const cle = l.food_id + "|" + (l.prix_ref != null ? "kg" : "u");
        depenses.set(cle, (depenses.get(cle) || 0) + l.total);
        const m = l.jour.slice(0, 7);
        if (!parAlimentMois.has(cle)) parAlimentMois.set(cle, new Map());
        const mm = parAlimentMois.get(cle);
        if (!mm.has(m)) mm.set(m, []);
        mm.get(m).push(prixLigne(l));
    }
    const prixMedians = new Map([...parAlimentMois].map(([cle, mm]) => [cle, new Map([...mm].map(([m, p]) => [m, mediane(p)]))]));
    // Seuls les aliments achetés au moins deux mois différents comptent ; base = leur premier prix de la
    // période, puis on suit leur dernier prix connu à chaque mois.
    const suivis = [...prixMedians].filter(([, mm]) => mm.size >= 2).map(([cle, mm]) => ({ poids: depenses.get(cle), connus: [...mm].sort() }));
    return moisListe.map((m) => {
        const rapports = suivis
            .filter(({ connus }) => connus[0][0] <= m)
            .map(({ poids, connus }) => ({ poids, rapport: connus.filter(([mois]) => mois <= m).pop()[1] / connus[0][1] }));
        const moyenne = moyennePonderee(rapports);
        return moyenne === null ? 100 : arrondi(moyenne * 100, 1);
    });
}

// Ce qui fait bouger l'indice : pour chaque aliment acheté au moins deux mois différents de la période, premier
// et dernier prix médians mensuels. Garde les plus fortes hausses et baisses parmi les aliments achetés souvent.
export function detailInflation(lignes) {
    const parAliment = new Map();
    for (const l of lignes) {
        if (l.statut !== "chow" || !l.food_id) continue;
        const cle = l.food_id + "|" + (l.prix_ref != null ? "kg" : "u");
        const a = parAliment.get(cle) || { nom: l.nom, emoji: l.emoji, unite: l.prix_ref != null ? l.unite || "kg" : null, mois: new Map(), achats: 0, tickets: new Set() };
        a.tickets.add(l.ticket_id);
        const m = l.jour.slice(0, 7);
        a.mois.set(m, [...(a.mois.get(m) || []), prixLigne(l)]);
        a.achats++;
        parAliment.set(cle, a);
    }
    const suivis = [...parAliment.values()]
        .filter((a) => a.mois.size >= 2)
        .map((a) => {
            const mois = [...a.mois].sort();
            const premier = mediane(mois[0][1]), dernier = mediane(mois[mois.length - 1][1]);
            return { nom: a.nom, emoji: a.emoji, unite: a.unite, achats: a.tickets.size, avant: arrondi(premier), apres: arrondi(dernier), variation: arrondi((dernier / premier - 1) * 100, 0) };
        })
        // Écart aberrant (contenance mal lue) : exclu du détail comme il est borné dans l'indice.
        .filter((a) => a.variation > -67 && a.variation < 200);
    // Seulement les produits que le foyer achète le plus souvent : les achats ponctuels ne disent rien.
    // Un aliment acheté au kg et à la pièce n'apparaît qu'une fois (sa forme la plus achetée).
    const vus = new Set();
    const frequents = [...suivis].sort((a, b) => b.achats - a.achats).filter((a) => !vus.has(a.nom) && vus.add(a.nom)).slice(0, 15);
    return {
        nbProduits: suivis.length,
        hausses: frequents.filter((a) => a.variation > 0).sort((a, b) => b.variation - a.variation).slice(0, 3),
        baisses: frequents.filter((a) => a.variation < 0).sort((a, b) => a.variation - b.variation).slice(0, 3),
    };
}

// Inflation d'une période courte (pas de courbe possible) : prix payés dans la période comparés au prix médian
// des mêmes produits sur les 12 mois d'avant. Même méthode de Jevons et mêmes bornes que l'indice mensuel.
export function inflationCourte(lignes, avant) {
    const depenses = new Map();
    const prixPar = (ls, compter) => {
        const m = new Map();
        for (const l of ls) {
            if (l.statut !== "chow" || !l.food_id) continue;
            const cle = l.food_id + "|" + (l.prix_ref != null ? "kg" : "u");
            m.set(cle, [...(m.get(cle) || []), prixLigne(l)]);
            if (compter) depenses.set(cle, (depenses.get(cle) || 0) + l.total);
        }
        return m;
    };
    const maintenant = prixPar(lignes, true), reference = prixPar(avant, false);
    // Chaque aliment pèse ce que le foyer y dépense sur la période, comme dans l'indice mensuel.
    const moyenne = moyennePonderee([...maintenant]
        .filter(([cle]) => reference.has(cle))
        .map(([cle, p]) => ({ poids: depenses.get(cle), rapport: mediane(p) / mediane(reference.get(cle)) })));
    return moyenne === null ? null : arrondi((moyenne - 1) * 100, 1);
}

export function calculerStats(toutes, params, aujourdhui, national = { alimentation: new Map(), ensemble: new Map() }) {
    const datees = toutes.filter((l) => l.jour);
    const premierJour = datees.reduce((m, l) => (l.jour < m ? l.jour : m), aujourdhui);
    const { debut, fin, precedent } = bornesPeriode(params, aujourdhui, premierJour);
    const enseigne = params.enseigne && params.enseigne !== "tous" ? params.enseigne : null;
    const filtre = (a, b) => datees.filter((l) => l.jour >= a && l.jour < b && (!enseigne || l.enseigne === enseigne));
    const lignes = filtre(debut, fin);
    const avant = precedent ? filtre(...precedent) : [];

    const depense = somme(lignes), depenseAvant = somme(avant);
    // Moyenne par semaine écoulée de la période (une période en cours ne compte que ses semaines passées).
    const semainesDe = (a, b) => Math.max(1, ecartJours(a, b < ajouterJours(aujourdhui, 1) ? b : ajouterJours(aujourdhui, 1)) / 7);
    const parSemaine = depense / semainesDe(debut, fin);
    const parSemaineAvant = precedent ? depenseAvant / semainesDe(...precedent) : 0;

    // Barres
    const nature = params.periode || "annee";
    const fenetre = fenetreBarres(nature, debut, fin, premierJour, aujourdhui);
    const { pas, seaux } = decouper(fenetre.debut, fenetre.fin, fenetre.pas);
    for (const l of filtre(fenetre.debut, fenetre.fin)) {
        const s = seaux.find((x) => l.jour >= x.debut && l.jour < x.fin);
        if (s) {
            s.total += l.total;
            (s.tickets ??= new Set()).add(l.ticket_id);
        }
    }
    const passes = seaux.filter((s) => s.debut <= aujourdhui);
    const complets = passes.filter((s) => s.fin <= ajouterJours(aujourdhui, 1));
    const moyenne = complets.length ? somme(complets.map((s) => ({ total: s.total }))) / complets.length : 0;
    const pic = passes.reduce((m, s) => (!m || s.total > m.total ? s : m), null);

    // Semaine la plus chère et ce qui l'a fait monter (écart à la semaine moyenne de la période, par aliment).
    const semaines = new Map();
    for (const l of lignes) {
        const k = lundi(l.jour);
        semaines.set(k, (semaines.get(k) || 0) + l.total);
    }
    let semaineMax = null;
    if (semaines.size) {
        const [k, total] = [...semaines].sort((a, b) => b[1] - a[1])[0];
        const nbSemaines = Math.max(1, Math.ceil(ecartJours(debut, fin < aujourdhui ? fin : ajouterJours(aujourdhui, 1)) / 7));
        const parNom = (ls) => {
            const m = new Map();
            // Jamais de libellé brut de ticket : hors aliments Chow, on regroupe en « Autres » ou « Non Chow ».
            for (const l of ls) {
                const n = l.statut === "chow" && l.nom ? l.nom : rayonDe(l);
                m.set(n, (m.get(n) || 0) + l.total);
            }
            return m;
        };
        const dansSemaine = parNom(lignes.filter((l) => lundi(l.jour) === k && l.statut !== "non-detaille"));
        const moyenneParNom = parNom(lignes);
        // Semaine d'avant, même si elle tombe avant le début de la période.
        const semaineAvant = parNom(filtre(ajouterJours(k, -7), k).filter((l) => l.statut !== "non-detaille"));
        const causes = [...dansSemaine]
            .map(([nom, t]) => ({ nom, semaine: arrondi(t), moyenne: arrondi((moyenneParNom.get(nom) || 0) / nbSemaines), ecart: arrondi(t - (moyenneParNom.get(nom) || 0) / nbSemaines), semaineAvant: arrondi(semaineAvant.get(nom) || 0) }))
            .filter((c) => c.ecart > 0).sort((a, b) => b.ecart - a.ecart).slice(0, 3);
        semaineMax = { debut: k, total: arrondi(total), causes };
    }

    // Par rayon : les rayons Chow du plus gros au plus petit, puis Autres et Non Chow, toujours à part.
    const rayons = new Map();
    for (const l of lignes) rayons.set(rayonDe(l), (rayons.get(rayonDe(l)) || 0) + l.total);
    const aLaFin = ["Autres", "Non Chow"];
    const parRayon = [...rayons]
        .sort((a, b) => aLaFin.indexOf(a[0]) - aLaFin.indexOf(b[0]) || b[1] - a[1])
        .map(([nom, t]) => ({ nom, total: arrondi(t) }));

    const magasins = new Map();
    for (const l of lignes) magasins.set(l.enseigne, (magasins.get(l.enseigne) || 0) + l.total);

    // Inflation du panier, mois par mois sur la période (au moins 2 mois).
    const moisListe = [];
    for (let m = debut.slice(0, 7); m <= (fin <= aujourdhui ? ajouterJours(fin, -1) : aujourdhui).slice(0, 7); m = ajouterMois(m + "-01", 1).slice(0, 7)) moisListe.push(m);
    const indice = moisListe.length >= 2 ? indicePanier(lignes, moisListe) : [];

    const rebase = (serie, m) => (serie.has(m) && serie.has(moisListe[0]) ? arrondi((serie.get(m) / serie.get(moisListe[0])) * 100, 1) : null);
    function variationNationale(serie) {
        const connus = moisListe.filter((m) => serie.has(m));
        if (connus.length < 2) return null;
        return { variation: arrondi((serie.get(connus[connus.length - 1]) / serie.get(connus[0]) - 1) * 100, 1), jusqua: connus[connus.length - 1] };
    }

    // L'inflation a toujours une valeur : sur la période (courbe), sinon contre les 12 mois d'avant, sinon
    // (période sans achat) sur les 12 derniers mois.
    // Mini-courbe « Par semaine » : les 12 semaines qui finissent avec la période (ou aujourd'hui).
    function serieSemaines() {
        const finSerie = lundi(fin <= aujourdhui ? ajouterJours(fin, -1) : aujourdhui);
        const totaux = new Map();
        for (const l of filtre(ajouterJours(finSerie, -77), ajouterJours(finSerie, 7))) totaux.set(lundi(l.jour), (totaux.get(lundi(l.jour)) || 0) + l.total);
        return Array.from({ length: 12 }, (_, i) => arrondi(totaux.get(ajouterJours(finSerie, 7 * (i - 11))) || 0));
    }

    function inflationAffichee() {
        if (indice.length) return { inflation: arrondi(indice[indice.length - 1] - 100, 1), inflationRef: "periode", serieInflation: indice };
        // Mini-courbe des périodes courtes : indice des 12 mois qui finissent avec la période.
        const finAnnee = fin < ajouterJours(aujourdhui, 1) ? fin : ajouterJours(aujourdhui, 1);
        const mois12 = [];
        for (let m = ajouterMois(finAnnee, -12).slice(0, 7); m <= ajouterJours(finAnnee, -1).slice(0, 7); m = ajouterMois(m + "-01", 1).slice(0, 7)) mois12.push(m);
        const valeurs = indicePanier(filtre(ajouterMois(finAnnee, -12), finAnnee), mois12);
        const courte = inflationCourte(lignes, filtre(ajouterMois(debut, -12), debut));
        if (courte !== null) return { inflation: courte, inflationRef: "12mois", serieInflation: valeurs };
        return { inflation: arrondi(valeurs[valeurs.length - 1] - 100, 1), inflationRef: "annee-glissante", serieInflation: valeurs };
    }

    return {
        periode: { debut, fin: ajouterJours(fin, -1), nature: params.periode || "annee" },
        // Dernier jour d'achat (magasin choisi compris) : « Semaine » s'ouvre sur la dernière semaine avec des achats.
        dernierAchat: datees.filter((l) => !enseigne || l.enseigne === enseigne).reduce((m, l) => (l.jour > m ? l.jour : m), ""),
        // Premier jour d'achat : la flèche « précédent » ne remonte pas avant.
        premierAchat: premierJour,
        kpi: {
            depense: arrondi(depense),
            variation: depenseAvant ? arrondi(((depense - depenseAvant) / depenseAvant) * 100, 0) : null,
            parSemaine: arrondi(parSemaine),
            ecartSemaine: parSemaineAvant ? arrondi(parSemaine - parSemaineAvant) : null,
            ...inflationAffichee(),
            serieSemaines: serieSemaines(),
        },
        barres: { pas, seaux: seaux.map(({ debut, etiquette, total, tickets }) => ({ debut, etiquette, total: arrondi(total), passages: tickets?.size || 0 })), moyenne: arrondi(moyenne), pic: pic && pic.debut, selection: ["semaine", "mois", "annee"].includes(nature) ? debut : null, enCours: passes.length && passes[passes.length - 1].fin > aujourdhui ? passes[passes.length - 1].debut : null },
        semaineMax,
        inflation: moisListe.map((m, i) => ({
            mois: m, etiquette: LETTRES_MOIS[Number(m.slice(5)) - 1], indice: indice[i] ?? null,
            // France sur la même base 100 (premier mois de la période) ; null tant que l'INSEE n'a pas publié le mois.
            national: rebase(national.alimentation, m),
            nationalEnsemble: rebase(national.ensemble, m),
        })),
        // Dépense alimentaire moyenne par mois de la période (tout sauf le non alimentaire) : échelle en euros de la
        // courbe d'inflation, dont l'évolution vient des prix des aliments suivis.
        panierMensuel: moisListe.length ? arrondi(somme(lignes.filter((l) => l.statut !== "non-alimentaire")) / moisListe.length, 0) : null,
        // Même échelle avec le non alimentaire, quand la ligne France suit tous les prix.
        panierMensuelTout: moisListe.length ? arrondi(depense / moisListe.length, 0) : null,
        detailInflation: detailInflation(lignes),
        inflationNationale: variationNationale(national.alimentation),
        inflationNationaleEnsemble: variationNationale(national.ensemble),
        parRayon,
        parMagasin: [...magasins].sort((a, b) => b[1] - a[1]).map(([nom, t]) => ({ nom, total: arrondi(t) })),
        produits: produitsDePeriode(lignes),
    };
}

// Tes prix : aliments Chow de la période, avec dernier prix, variation et courbe mensuelle.
function produitsDePeriode(lignes) {
    const parAliment = new Map();
    for (const l of lignes) {
        if (l.statut !== "chow" || !l.food_id) continue;
        if (!parAliment.has(l.food_id)) parAliment.set(l.food_id, []);
        parAliment.get(l.food_id).push(l);
    }
    return [...parAliment].map(([id, ls]) => {
        ls.sort((a, b) => a.jour.localeCompare(b.jour));
        const auPoids = ls.filter((l) => l.prix_ref != null).length * 2 >= ls.length;
        const comparables = ls.filter((l) => (l.prix_ref != null) === auPoids);
        const prix = comparables.map(prixLigne);
        const parMois = new Map();
        for (const l of comparables) {
            const m = l.jour.slice(0, 7);
            parMois.set(m, [...(parMois.get(m) || []), prixLigne(l)]);
        }
        const dernier = prix[prix.length - 1];
        return {
            id, nom: ls[0].nom, emoji: ls[0].emoji,
            achats: new Set(ls.map((l) => l.ticket_id)).size,
            depense: arrondi(somme(ls)),
            prix: arrondi(dernier), unite: auPoids ? (ls.find((l) => l.unite)?.unite || "kg") : null,
            variation: prix.length > 1 ? arrondi(((dernier - prix[0]) / prix[0]) * 100, 0) : 0,
            courbe: [...parMois].sort().map(([, p]) => arrondi(mediane(p))),
        };
    });
}

// Fiche produit : courbe des prix, dernier prix par enseigne, 3 derniers achats.
// Habitudes d'achat d'un produit : rythme, quantité par passage, quantité par mois, dépense sur 12 mois.
function habitudesAchat(lignes, auPoids, aujourdhui) {
    const passages = new Map();
    for (const l of lignes) {
        const p = passages.get(l.ticket_id) || { jour: l.jour, quantite: 0, total: 0 };
        p.quantite += auPoids ? (l.poids ?? (l.quantite || 1) * (l.contenance ?? 0)) : (l.quantite || 1);
        p.total += l.total;
        passages.set(l.ticket_id, p);
    }
    const liste = [...passages.values()].sort((a, b) => a.jour.localeCompare(b.jour));
    const recents = liste.filter((p) => p.jour >= ajouterMois(aujourdhui, -12));
    const ecarts = recents.slice(1).map((p, i) => ecartJours(recents[i].jour, p.jour)).filter((e) => e > 0);
    const rythme = ecarts.length ? Math.round(mediane(ecarts)) : null;
    const dernier = liste[liste.length - 1].jour;
    return {
        rythmeJours: rythme,
        quantiteParAchat: recents.length ? arrondi(mediane(recents.map((p) => p.quantite)), auPoids ? 2 : 0) : null,
        quantiteParMois: recents.length ? arrondi(recents.reduce((s, p) => s + p.quantite, 0) / 12, 1) : null,
        depense12Mois: arrondi(recents.reduce((s, p) => s + p.total, 0)),
        achats12Mois: recents.length,
        dernierAchat: dernier,
        joursDepuis: ecartJours(dernier, aujourdhui),
        prochainAchat: rythme ? ajouterJours(dernier, rythme) : null,
    };
}

export function ficheProduit(lignes, aujourdhui = jourIso(new Date()), params = null) {
    if (!lignes.length) return null;
    lignes.sort((a, b) => a.jour.localeCompare(b.jour));
    // Achats dans la période et le magasin choisis sur la page Stats.
    let periode = null;
    if (params) {
        const { debut, fin } = bornesPeriode(params, aujourdhui, lignes[0].jour);
        const enseigne = params.enseigne && params.enseigne !== "tous" ? params.enseigne : null;
        const dedans = lignes.filter((l) => l.jour >= debut && l.jour < fin && (!enseigne || l.enseigne === enseigne));
        periode = { achats: new Set(dedans.map((l) => l.ticket_id)).size, depense: arrondi(somme(dedans)) };
    }
    const auPoids = lignes.filter((l) => l.prix_ref != null).length * 2 >= lignes.length;
    const comparables = lignes.filter((l) => (l.prix_ref != null) === auPoids);
    const parMois = new Map();
    for (const l of comparables) parMois.set(l.jour.slice(0, 7), [...(parMois.get(l.jour.slice(0, 7)) || []), prixLigne(l)]);
    const moisCourbe = [...parMois].sort().slice(-12);
    const plusieursAnnees = moisCourbe.length && moisCourbe[0][0].slice(0, 4) !== moisCourbe[moisCourbe.length - 1][0].slice(0, 4);
    const courbe = moisCourbe.map(([m, p], i) => ({
        mois: m,
        // Année ajoutée au premier mois et à chaque janvier quand la courbe couvre plusieurs années.
        etiquette: MOIS_COURTS[Number(m.slice(5)) - 1] + (plusieursAnnees && (i === 0 || m.endsWith("-01")) ? " " + m.slice(2, 4) : ""),
        prix: arrondi(mediane(p)),
    }));
    const enseignes = new Map();
    for (const l of comparables) enseignes.set(l.enseigne, arrondi(prixLigne(l)));
    const premier = prixLigne(comparables[0]), dernier = prixLigne(comparables[comparables.length - 1]);
    return {
        id: lignes[0].food_id, nom: lignes[0].nom, emoji: lignes[0].emoji,
        unite: auPoids ? (lignes.find((l) => l.unite)?.unite || "kg") : null,
        prix: arrondi(dernier),
        variation: arrondi(((dernier - premier) / premier) * 100, 0),
        depuis: comparables[0].jour.slice(0, 4),
        achats: new Set(lignes.map((l) => l.ticket_id)).size,
        depenseTotale: arrondi(somme(lignes)),
        // Économisé grâce aux promos sur ce produit, depuis le premier achat.
        economiePromos: arrondi(lignes.reduce((s, l) => s + (l.remise || 0), 0)),
        premierAchat: lignes[0].jour,
        periode,
        courbe,
        parEnseigne: [...enseignes].map(([nom, prix]) => ({ nom, prix })).sort((a, b) => a.prix - b.prix),
        habitudes: habitudesAchat(lignes, auPoids, aujourdhui),
        derniersAchats: lignes.slice(-3).reverse().map((l) => ({
            jour: l.jour, enseigne: l.enseigne, total: l.total, remise: l.remise || 0,
            quantite: l.poids ? `${String(l.poids).replace(".", ",")} kg` : l.quantite > 1 ? `×${l.quantite}` : null,
        })),
    };
}
