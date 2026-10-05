const CADDIE = `<path class="kv-sol" d="M10 128h200"/>
<g class="kv-caddie">
  <g class="kv-aliment kv-a1"><path class="kv-carotte" d="M94 46h9l-4.5 26z"/><path class="kv-fane" d="M98.5 46l-3-7M98.5 46l3-7"/></g>
  <g class="kv-aliment kv-a2"><circle class="kv-tomate" cx="120" cy="62" r="9"/><path class="kv-queue" d="M115 54l5 3 5-3-5 4z"/></g>
  <g class="kv-aliment kv-a3"><path class="kv-pain" d="M126 64c4-12 22-20 30-16 4 3-12 20-26 21-4 0-5-2-4-5z"/><path class="kv-entaille" d="M136 60l5-4M143 56l5-4"/></g>
  <path class="kv-t" d="M54 46h14l12 52h70l12-40H74"/>
  <path class="kv-fin" d="M80 70h76M84 84h66M100 58v40M120 58v40M140 58v40"/>
  <path class="kv-t" d="M80 98l-4 12h80"/>
  <g class="kv-roue"><circle class="kv-tf" cx="88" cy="120" r="7"/><path class="kv-fin" d="M88 114v12"/></g>
  <g class="kv-roue"><circle class="kv-tf" cx="146" cy="120" r="7"/><path class="kv-fin" d="M146 114v12"/></g>
</g>`;

export default function CoursesVide() {
  return <svg className="courses-vide" viewBox="0 0 220 150" aria-hidden="true" dangerouslySetInnerHTML={{ __html: CADDIE }} />;
}
