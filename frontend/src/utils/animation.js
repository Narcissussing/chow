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

// Un aliment part vers un lien du menu : le lien devient une icône (boîte de rangement, caddie…),
// l'aliment y vole, l'icône l'encaisse, puis le lien redevient du texte.
// « carte » (facultative) se tasse vers l'aliment avant le départ. Rend true si l'animation a lieu.
export function envoyerAuMenu({ depuis, emoji, chemin, icone, carte }) {
  const lien = cibleVisible([`.nav__link[href="${chemin}"]`]);
  if (!depuis || !lien || mouvementsReduits() || typeof document.body.animate !== "function") return false;
  const repere = depuis.getBoundingClientRect();
  const x0 = repere.left + repere.width / 2;
  const y0 = repere.top + repere.height / 2;

  lien.style.setProperty("--icone-nav", `url("/images/svg/${icone}.svg")`);
  lien.classList.remove("redevient-texte");
  lien.classList.add("devient-icone");
  lien.envolsEnCours = (lien.envolsEnCours || 0) + 1;

  if (carte) {
    const a = carte.getBoundingClientRect();
    const copie = carte.cloneNode(true);
    copie.classList.add("carte-volante");
    copie.removeAttribute("data-id");
    Object.assign(copie.style, { position: "fixed", left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, margin: "0", zIndex: "10000", pointerEvents: "none", transformOrigin: `${x0 - a.left}px ${y0 - a.top}px` });
    document.body.appendChild(copie);
    copie.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(0.25)", opacity: 0 }], { duration: 260, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }).onfinish = () => copie.remove();
  }

  const aliment = document.createElement("span");
  aliment.className = "emoji-volant";
  aliment.textContent = emoji || "🛒";
  aliment.setAttribute("aria-hidden", "true");
  Object.assign(aliment.style, { left: `${x0}px`, top: `${y0}px` });
  document.body.appendChild(aliment);
  const b = lien.getBoundingClientRect();
  const dx = b.left + b.width / 2 - x0;
  const dy = b.top + b.height / 2 - y0;
  const vol = aliment.animate(
    [
      { transform: "translate(-50%, -50%) scale(0.4)", opacity: 0, offset: 0 },
      { transform: "translate(-50%, -50%) scale(1.7)", opacity: 1, offset: 0.25 },
      { transform: "translate(-50%, -50%) scale(1.5)", opacity: 1, offset: 0.35 },
      { transform: `translate(calc(-50% + ${dx * 0.4}px), calc(-50% + ${Math.min(dy * 0.4, 0) - 50}px)) scale(1.2) rotate(-20deg)`, opacity: 1, offset: 0.65 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.45) rotate(15deg)`, opacity: 0.9, offset: 1 },
    ],
    { duration: 900, easing: "cubic-bezier(.4,0,.4,1)", fill: "forwards" }
  );

  vol.onfinish = vol.oncancel = () => {
    aliment.remove();
    relancerClasse(lien, "icone-recoit");
    setTimeout(() => {
      lien.envolsEnCours -= 1;
      if (lien.envolsEnCours > 0) return;
      lien.classList.remove("devient-icone", "icone-recoit");
      relancerClasse(lien, "redevient-texte");
    }, 650);
  };
  return true;
}

// Acheté dans Courses : la carte devient son aliment, qui part dans la boîte Stock.
export function rangerAuStock(carte, emoji) {
  if (!carte) return false;
  return envoyerAuMenu({ carte, depuis: carte.querySelector(".course-nom-emoji") || carte, emoji, chemin: "/stock", icone: "rangement" });
}

// Envoyé aux Courses depuis le Stock : l'aliment part dans le caddie Courses (la carte reste).
export function jeterAuxCourses(depuis, emoji) {
  return envoyerAuMenu({ depuis, emoji, chemin: "/courses", icone: "caddie" });
}
