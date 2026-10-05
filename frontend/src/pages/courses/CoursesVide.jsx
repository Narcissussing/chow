import { useLayoutEffect, useRef } from "react";
import "./CoursesVide.css";

const CADDIE = `<g class="kv-caddie">
  <g class="kv-aliment kv-a1" data-x="98.5" data-y="59"><path class="kv-carotte" d="M94 46h9l-4.5 26z"/><path class="kv-fane" d="M98.5 46l-3-7M98.5 46l3-7"/></g>
  <g class="kv-aliment kv-a2" data-x="120" data-y="62"><circle class="kv-tomate" cx="120" cy="62" r="9"/><path class="kv-queue" d="M115 54l5 3 5-3-5 4z"/></g>
  <g class="kv-aliment kv-a3" data-x="141" data-y="57"><path class="kv-pain" d="M126 64c4-12 22-20 30-16 4 3-12 20-26 21-4 0-5-2-4-5z"/><path class="kv-entaille" d="M136 60l5-4M143 56l5-4"/></g>
  <path class="kv-t" d="M54 46h14l12 52h70l12-40H74"/>
  <path class="kv-fin" d="M80 70h76M84 84h66M100 58v40M120 58v40M140 58v40"/>
  <path class="kv-t" d="M80 98l-4 12h80"/>
  <g class="kv-roue"><circle class="kv-tf" cx="88" cy="120" r="7"/><path class="kv-fin" d="M88 114v12"/></g>
  <g class="kv-roue"><circle class="kv-tf" cx="146" cy="120" r="7"/><path class="kv-fin" d="M146 114v12"/></g>
</g>`;
const LARGEUR = 220;

// Le caddie traverse l'écran ; les aliments tombent du bouton « + » dedans et repartent avec lui.
export default function CoursesVide() {
  const zone = useRef(null);
  const dessin = useRef(null);

  useLayoutEffect(() => {
    function viser() {
      const plus = document.getElementById("btnToggleAjoutCourse");
      if (!plus || !zone.current || !dessin.current) return;
      const p = plus.getBoundingClientRect();
      const z = zone.current.getBoundingClientRect();
      const gauche = z.left + (z.width - LARGEUR) / 2;
      const haut = z.top + parseFloat(getComputedStyle(zone.current).paddingTop);
      for (const a of dessin.current.querySelectorAll(".kv-aliment")) {
        a.style.setProperty("--kv-x", `${p.left + p.width / 2 - (gauche + Number(a.dataset.x))}px`);
        a.style.setProperty("--kv-y", `${p.top + p.height / 2 - (haut + Number(a.dataset.y))}px`);
      }
    }
    viser();
    window.addEventListener("resize", viser);
    return () => window.removeEventListener("resize", viser);
  }, []);

  return (
    <div ref={zone} className="courses-vide-zone">
      <svg ref={dessin} className="courses-vide" viewBox={`0 0 ${LARGEUR} 150`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: CADDIE }} />
    </div>
  );
}
