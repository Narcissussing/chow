// Rejoue une animation CSS même si sa classe est déjà posée (retrait, reflow forcé, remise).
export function relancerClasse(element, classe) {
  if (!element) return;
  element.classList.remove(classe);
  void element.offsetWidth;
  element.classList.add(classe);
}

// Pose une classe d'animation puis la retire à la fin, sinon "animation: ... both" bloquerait tout transform posé ensuite.
export function animerEntree(element) {
  if (!element) return;
  element.classList.add("entree");
  element.addEventListener("animationend", () => element.classList.remove("entree"), { once: true });
}

const mouvementsReduits = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Première cible visible à l'écran (la marmite du titre, sinon l'onglet), ou rien.
function cibleVisible(selecteurs) {
  for (const selecteur of selecteurs) {
    const el = document.querySelector(selecteur);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.bottom > 0 && r.top < window.innerHeight) return el;
  }
  return null;
}

// Les emojis sont lancés en cloche, l'un après l'autre, depuis un bouton (ou son rectangle gardé avant fermeture)
// jusqu'à la première cible visible ; la cible encaisse avec sa classe d'arrivée.
export function lancerVers(emojis, depuis, selecteurs, classeArrivee) {
  if (!depuis || mouvementsReduits() || typeof document.body.animate !== "function") return;
  // Départ mesuré tout de suite (le bouton peut disparaître), cible à l'image suivante (l'onglet a pu changer).
  const a = typeof depuis.getBoundingClientRect === "function" ? depuis.getBoundingClientRect() : depuis;
  requestAnimationFrame(() => volee(emojis, a, selecteurs, classeArrivee));
}

function volee(emojis, a, selecteurs, classeArrivee) {
  const cible = cibleVisible(selecteurs);
  if (!cible) return;
  const b = cible.getBoundingClientRect();
  const liste = (emojis.length ? emojis : ["🥕"]).slice(0, 6);
  liste.forEach((emoji, i) => {
    const volant = document.createElement("span");
    volant.className = "emoji-volant";
    volant.textContent = emoji;
    volant.setAttribute("aria-hidden", "true");
    const x0 = a.left + a.width / 2;
    const y0 = a.top + a.height / 2;
    const dx = b.left + b.width / 2 - x0;
    const dy = b.top + b.height * 0.4 - y0;
    // Chaque emoji prend une cloche un peu différente, pour que la volée ait l'air lancée à la main.
    const sommet = Math.min(dy, 0) - 60 - (i % 3) * 18;
    const ecart = (i % 2 ? 1 : -1) * (i * 6);
    volant.style.left = `${x0}px`;
    volant.style.top = `${y0}px`;
    document.body.appendChild(volant);
    const vol = volant.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.6) rotate(0deg)", opacity: 0 },
        { transform: "translate(-50%, -50%) scale(1.1) rotate(0deg)", opacity: 1, offset: 0.08 },
        { transform: `translate(calc(-50% + ${dx * 0.5 + ecart}px), calc(-50% + ${sommet}px)) scale(1.5) rotate(${200 + i * 30}deg)`, offset: 0.5 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.45) rotate(${400 + i * 40}deg)`, opacity: 0.9 },
      ],
      { duration: 640, delay: i * 90, easing: "cubic-bezier(.35,.1,.45,1)", fill: "backwards" }
    );
    vol.onfinish = vol.oncancel = () => {
      volant.remove();
      relancerClasse(cible, classeArrivee);
    };
  });
}

export const MARMITE = [".badge-compteur--cuisine", ".calories-tab-btn:first-child"];
export const BALANCE = [".badge-compteur--regle", "#ongletAdapter"];

// L'emoji de l'aliment est lancé depuis la ligne touchée jusque dans la marmite du titre, qui fait « plouf ».
export function lancerDansLaMarmite(emoji, depuis) {
  lancerVers([emoji || "🥕"], depuis, [".badge-compteur--cuisine"], "recoit");
}
