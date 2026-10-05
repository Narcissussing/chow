export function relancerClasse(element, classe) {
  if (!element) return;
  element.classList.remove(classe);
  void element.offsetWidth;
  element.classList.add(classe);
}

export function animerEntree(element) {
  if (!element) return;
  element.classList.add("entree");
  element.addEventListener("animationend", () => element.classList.remove("entree"), { once: true });
}

const mouvementsReduits = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function cibleVisible(selecteurs) {
  for (const selecteur of selecteurs) {
    const el = document.querySelector(selecteur);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (el.offsetWidth > 0 && r.bottom > 0 && r.top < window.innerHeight) return el;
  }
  return null;
}

export function lancerVers(emojis, depuis, selecteurs, classeArrivee) {
  if (!depuis || mouvementsReduits() || typeof document.body.animate !== "function") return;
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

export function lancerDansLaMarmite(emoji, depuis) {
  lancerVers([emoji || "🥕"], depuis, [".badge-compteur--cuisine"], "recoit");
}
