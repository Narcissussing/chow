import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import FondModal from "../../components/FondModal.jsx";
import { useClicExterieur } from "../../hooks/useClicExterieur.js";
import { useFermetureAnimee } from "../../hooks/useFermetureAnimee.js";
import "./PanierMagasin.css";

// Une couleur fixe par rayon, la même d'une tournée à l'autre ; les articles de la maison sont « Maison ».
const COULEURS = {
  Laitiers: "#7a8fb8", Légumes: "#2f6f62", Fruits: "#6fa36a", Viandes: "#b5524a", Poissons: "#4f8f9a", Oeufs: "#e0b75a",
  Féculents: "#a8896b", Légumineuses: "#8a6d4f", Lipides: "#c9a227", Sauces: "#c8472b", Épices: "#d9733f",
  Épicerie: "#d9a441", Boissons: "#5b8fc7", Divers: "#9b8f80", Glace: "#8fc1d4", Maison: "#b07aa1",
};
const PALETTE = ["#7a8fb8", "#2f6f62", "#d9a441", "#c8472b", "#a8896b", "#b07aa1", "#4f8f9a"];
const couleurDe = (rayon) => COULEURS[rayon] || PALETTE[[...rayon].reduce((s, c) => s + c.charCodeAt(0), 0) % PALETTE.length];
const euros = (n) => Math.round(n).toLocaleString("fr-FR") + " €";
const mouvementReduit = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Total qui défile jusqu'à sa nouvelle valeur (≈ 450 ms).
function useTotalAnime(cible) {
  const [valeur, setValeur] = useState(cible);
  const actuelle = useRef(cible);
  actuelle.current = valeur;
  useEffect(() => {
    const depart = actuelle.current;
    if (depart === cible || mouvementReduit()) {
      setValeur(cible);
      return;
    }
    let image;
    const debut = performance.now();
    const pas = (t) => {
      const p = Math.min(1, (t - debut) / 450);
      setValeur(depart + (cible - depart) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [cible]);
  return valeur;
}

// Rayons de la tournée : ce qui est prévu et ce qui est déjà au chariot.
export function rayonsDuPanier(lignes) {
  const parRayon = new Map();
  for (const l of lignes) {
    if (l.prevu == null && l.valeur == null) continue;
    const r = parRayon.get(l.rayon) || { rayon: l.rayon, prevu: 0, valeur: 0, articles: 0, achetes: 0 };
    r.prevu += l.prevu ?? l.valeur;
    r.articles += 1;
    if (l.achete) {
      r.valeur += l.valeur ?? 0;
      r.achetes += 1;
    }
    parRayon.set(l.rayon, r);
  }
  return [...parRayon.values()].sort((a, b) => b.prevu - a.prevu);
}

// Panier en mode magasin, à la place du titre : la piste = toute la tournée prévue, les parts colorées = ce qui est
// au chariot, par rayon. Toucher une part dit son rayon ; deux touchers font entrer le ✓ qui termine la tournée.
export default function PanierMagasin({ lignes, reduit = false, onTerminer }) {
  const rayons = useMemo(() => rayonsDuPanier(lignes), [lignes]);
  const prevu = rayons.reduce((s, r) => s + r.prevu, 0);
  const total = rayons.reduce((s, r) => s + r.valeur, 0);
  const totalAffiche = useTotalAnime(total);
  const echelle = Math.max(prevu, total, 1);
  const depasse = total - prevu >= 1;

  const barre = useRef(null);
  const [largeur, setLargeur] = useState(0);
  useLayoutEffect(() => {
    if (!barre.current) return;
    setLargeur(barre.current.offsetWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observateur = new ResizeObserver(([e]) => setLargeur(e.contentRect.width));
    observateur.observe(barre.current);
    return () => observateur.disconnect();
  }, []);

  const carte = useRef(null);
  const bulleZone = useRef(null);
  const [touche, setTouche] = useState(null);
  const [bulleFermee, fermerBulle] = useFermetureAnimee(useCallback(() => setTouche(null), []), 180);
  const zonesBulle = useMemo(() => [bulleZone], []);
  useClicExterieur(zonesBulle, fermerBulle, touche !== null);

  const [fin, setFin] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [confirmationFermee, fermerConfirmation] = useFermetureAnimee(useCallback(() => setConfirmer(false), []), 200);
  const dernierToucher = useRef(0);
  // ✓ sorti : un seul toucher, sur le panier ou ailleurs, le fait repartir.
  const zonesPanier = useMemo(() => [carte], []);
  useClicExterieur(zonesPanier, () => setFin(false), fin && !confirmer);
  function surToucher() {
    if (reduit) return;
    if (fin) {
      setFin(false);
      dernierToucher.current = 0;
      return;
    }
    const maintenant = Date.now();
    if (maintenant - dernierToucher.current < 320) {
      dernierToucher.current = 0;
      setFin(true);
      if (touche) fermerBulle();
      return;
    }
    dernierToucher.current = maintenant;
  }

  const rayonTouche = rayons.find((r) => r.rayon === touche);
  let gauche = 0;
  const parts = rayons.map((r) => {
    const part = { ...r, gauche, largeur: (r.valeur / echelle) * 100 };
    gauche += part.largeur;
    return part;
  });
  const partTouchee = parts.find((p) => p.rayon === touche);

  return (
    <div ref={carte} className={"panier" + (reduit ? " panier--reduit" : "") + (fin ? " avec-fin" : "")} onClick={surToucher}>
      <div ref={barre} className="panier__piste" role="img" aria-label={`${euros(total)} au chariot sur ${euros(prevu)} prévus`}>
        {parts.map((p) => (
          <button
            key={p.rayon}
            type="button"
            className={"panier__part" + (touche && touche !== p.rayon ? " estompee" : "")}
            style={{ width: p.largeur + "%", background: couleurDe(p.rayon) }}
            tabIndex={reduit || p.valeur <= 0 ? -1 : 0}
            aria-label={`${p.rayon} : ${euros(p.valeur)}`}
            onClick={(e) => {
              if (reduit) return;
              e.stopPropagation();
              surToucher();
              setTouche((t) => (t === p.rayon ? null : p.rayon));
            }}
          >
            {!reduit && (p.largeur / 100) * largeur >= 38 && <span className="panier__montant">{euros(p.valeur)}</span>}
          </button>
        ))}
        {depasse && <span className="panier__repere" style={{ left: (prevu / echelle) * 100 + "%" }} aria-hidden="true" />}
        {!reduit && <span className={"panier__prevu" + (total / Math.max(prevu, 1) > 0.78 ? " efface" : "")}>{euros(prevu)}</span>}
      </div>
      <span className="panier__total">
        {euros(totalAffiche)}
        {!reduit && <span className={"panier__depassement" + (depasse ? " visible" : "")}>+{euros(Math.max(total - prevu, 0))}</span>}
      </span>
      {!reduit && (
        <button
          type="button"
          className="panier__terminer"
          aria-label="Terminer les courses"
          tabIndex={fin ? 0 : -1}
          onClick={(e) => {
            e.stopPropagation();
            setConfirmer(true);
          }}
        />
      )}

      {rayonTouche && partTouchee && (
        <span
          ref={bulleZone}
          className={"panier__bulle" + (bulleFermee ? " ferme" : "")}
          style={{ left: `clamp(60px, ${partTouchee.gauche + partTouchee.largeur / 2}%, calc(100% - 60px))` }}
          role="status"
        >
          <b>{rayonTouche.rayon}</b>
          <span>
            {euros(rayonTouche.valeur)} sur {euros(rayonTouche.prevu)} · {rayonTouche.achetes} sur {rayonTouche.articles}
          </span>
        </span>
      )}

      {confirmer && <FondModal onFermer={fermerConfirmation} fermant={confirmationFermee} />}
      {confirmer &&
        createPortal(
          <div className={"panier-confirmation" + (confirmationFermee ? " ferme" : "")} role="dialog" aria-label="Terminer les courses">
            <span className="panier-confirmation__filigrane" aria-hidden="true" />
            <b>Terminer ?</b>
            <div className="panier-confirmation__actions">
              <button type="button" className="panier-confirmation__non" onClick={fermerConfirmation}>
                Non
              </button>
              <button
                type="button"
                className="panier-confirmation__oui"
                onClick={() => {
                  fermerConfirmation();
                  setFin(false);
                  onTerminer?.();
                }}
              >
                Oui
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
