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
