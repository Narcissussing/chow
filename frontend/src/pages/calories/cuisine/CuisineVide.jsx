import { useState } from "react";
import "./CuisineVide.css";

const carotte = (x, y, cls) => `<g class="cv-l ${cls}"><path class="cv-carotte" d="M${x - 4} ${y - 12}l8 0-4 24z"/><path class="cv-fane" d="M${x} ${y - 12}l-3-6M${x} ${y - 12}l3-6"/></g>`;
const tomate = (x, y, cls) => `<g class="cv-l ${cls}"><circle class="cv-tomate" cx="${x}" cy="${y}" r="8"/><path class="cv-queue" d="M${x - 4} ${y - 8}l4 2 4-2-4 3z"/></g>`;
const oignon = (x, y, cls) => `<g class="cv-l ${cls}"><path class="cv-oignon" d="M${x} ${y - 10}c6 4 8 8 8 12a8 8 0 0 1-16 0c0-4 2-8 8-12z"/></g>`;
const feuille = (x, y, cls) => `<g class="cv-l ${cls}"><path class="cv-feuille" d="M${x - 8} ${y + 4}c2-10 10-12 16-12-2 8-8 14-16 12z"/></g>`;
const marmite = `<path class="cv-t" d="M50 92h100v34a14 14 0 0 1-14 14H64a14 14 0 0 1-14-14z"/><path class="cv-tv" d="M50 100h-10M150 100h10"/>`;
const couvercle = `<g class="cv-couvercle"><path class="cv-t" d="M46 92c0-14 24-22 54-22s54 8 54 22z"/><path class="cv-t" d="M93 70v-6h14v6"/></g>`;
const vapeurs = `<path class="cv-vapeur" d="M80 60c-4-6 4-10 0-16"/><path class="cv-vapeur" d="M100 56c-4-6 4-10 0-16"/><path class="cv-vapeur" d="M120 60c-4-6 4-10 0-16"/>`;

const ANIMATIONS = {
  marmite: `${vapeurs}${carotte(84, 86, "cv-l1")}${tomate(102, 86, "cv-l2")}${oignon(120, 88, "cv-l3")}<path class="cv-tv cv-eclabousse" d="M70 90l-6-8M78 88l-2-10M122 88l2-10M130 90l6-8"/>${marmite}${couvercle}`,
  couvercle: `${vapeurs}<circle class="cv-bulle" cx="78" cy="94" r="3"/><circle class="cv-bulle" cx="122" cy="94" r="3"/><circle class="cv-bulle" cx="100" cy="94" r="2.5"/>${marmite}${couvercle}`,
  poele: `<g class="cv-poele">${carotte(84, 98, "cv-l1")}${tomate(102, 100, "cv-l2")}${feuille(120, 100, "cv-l3")}<path class="cv-t" d="M52 104h96c0 12-14 20-48 20s-48-8-48-20z"/><path class="cv-tv" d="M148 108h30"/></g><path class="cv-flamme" d="M84 146c-4-6 0-12 4-16 0 6 6 8 4 16z"/><path class="cv-flamme" d="M98 146c-4-6 0-12 4-16 0 6 6 8 4 16z"/><path class="cv-flamme" d="M112 146c-4-6 0-12 4-16 0 6 6 8 4 16z"/>`,
  recette: `${vapeurs}${carotte(84, 86, "cv-l1")}${tomate(102, 86, "cv-l2")}${oignon(120, 88, "cv-l3")}<g class="cv-cuillere"><path class="cv-tv" d="M100 92L126 40"/><ellipse class="cv-t" cx="128" cy="36" rx="5" ry="8" transform="rotate(26 128 36)"/></g>${marmite}${couvercle}`,
};
const NOMS = Object.keys(ANIMATIONS);

export default function CuisineVide() {
  const [nom] = useState(() => NOMS[Math.floor(Math.random() * NOMS.length)]);
  return <svg className={`cuisine-vide cuisine-vide--${nom}`} data-animation={nom} viewBox="0 0 200 160" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ANIMATIONS[nom] }} />;
}
