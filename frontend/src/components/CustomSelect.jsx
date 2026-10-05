import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./CustomSelect.css";

const fermeturesInstantanees = new Set();
let ecouteursGlobaux = 0;

export function fermerTousLesSelects(sauf) {
  fermeturesInstantanees.forEach((fermer) => {
    if (fermer !== sauf) fermer();
  });
}

function surClicDocument() {
  fermerTousLesSelects();
}

function surDefilement(event) {
  if (event.target instanceof Element && event.target.closest(".custom-select__list")) return;
  fermerTousLesSelects();
}

function surTouche(event) {
  if (event.key === "Escape") fermerTousLesSelects();
}

function brancherEcouteursGlobaux() {
  if (ecouteursGlobaux++ > 0) return;
  document.addEventListener("click", surClicDocument);
  window.addEventListener("scroll", surDefilement, true);
  document.addEventListener("keydown", surTouche);
}

function debrancherEcouteursGlobaux() {
  if (--ecouteursGlobaux > 0) return;
  document.removeEventListener("click", surClicDocument);
  window.removeEventListener("scroll", surDefilement, true);
  document.removeEventListener("keydown", surTouche);
}

const MARGE_ECRAN = 12;

export default function CustomSelect({
  id,
  className = "",
  value,
  onChange,
  options,
  disabled = false,
  hidden = false,
  title,
  ariaLabel,
}) {
  const bouton = useRef(null);
  const liste = useRef(null);
  const minuteurFermeture = useRef(null);
  const [ouvert, setOuvert] = useState(false);
  const [listeMontee, setListeMontee] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, minWidth: 0 });

  const selection = options.find((o) => String(o.value) === String(value));
  const libelle = (selection || options[0])?.label ?? "";

  function fermerInstantanement() {
    clearTimeout(minuteurFermeture.current);
    liste.current?.classList.remove("custom-select__list--ouverte");
    setOuvert(false);
    setListeMontee(false);
  }
  const refFermeture = useRef(fermerInstantanement);
  refFermeture.current = fermerInstantanement;

  useEffect(() => {
    const fermer = () => refFermeture.current();
    brancherEcouteursGlobaux();
    fermeturesInstantanees.add(fermer);
    return () => {
      fermeturesInstantanees.delete(fermer);
      debrancherEcouteursGlobaux();
      clearTimeout(minuteurFermeture.current);
    };
  }, []);

  function fermerEnDouceur() {
    liste.current?.classList.remove("custom-select__list--ouverte");
    setOuvert(false);
    clearTimeout(minuteurFermeture.current);
    minuteurFermeture.current = setTimeout(() => setListeMontee(false), 150);
  }

  function ouvrir() {
    if (disabled) return;
    fermerTousLesSelects(refFermeture.current);
    clearTimeout(minuteurFermeture.current);
    const rect = bouton.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 6, left: rect.left, minWidth: rect.width });
    setOuvert(true);
    setListeMontee(true);
  }

  useLayoutEffect(() => {
    const element = liste.current;
    if (!ouvert || !element) return;
    void element.offsetWidth;
    element.classList.add("custom-select__list--ouverte");
    const largeur = element.getBoundingClientRect().width;
    const gaucheMax = window.innerWidth - largeur - MARGE_ECRAN;
    element.style.left = Math.max(MARGE_ECRAN, Math.min(position.left, gaucheMax)) + "px";
  }, [ouvert, position]);

  function choisir(option) {
    if (option.disabled) return;
    fermerEnDouceur();
    onChange(String(option.value));
  }

  const optionsVisibles = options.filter((o) => !(String(o.value) === "" && String(o.label).trim() === ""));

  return (
    <>
      <select
        id={id}
        className={(className ? className + " " : "") + "custom-select-native" + (hidden ? " hidden" : "")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <div
        className={"custom-select" + (hidden ? " hidden" : "") + (disabled ? " custom-select--disabled" : "") + (ouvert ? " custom-select--open" : "")}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={bouton}
          type="button"
          className="custom-select__button"
          aria-haspopup="listbox"
          aria-expanded={ouvert ? "true" : "false"}
          aria-label={ariaLabel}
          title={title || undefined}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (ouvert) fermerEnDouceur();
            else ouvrir();
          }}
        >
          <span className="custom-select__label">{libelle}</span>
        </button>
      </div>
      {listeMontee &&
        createPortal(
          <ul
            ref={liste}
            className="custom-select__list"
            role="listbox"
            data-for-select={id}
            style={{ top: position.top + "px", left: position.left + "px", minWidth: position.minWidth + "px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {optionsVisibles.map((o) => {
              const choisie = String(o.value) === String(value);
              return (
                <li
                  key={o.value}
                  className={"custom-select__option" + (o.disabled ? " custom-select__option--disabled" : "") + (choisie ? " custom-select__option--selected" : "")}
                  data-value={o.value}
                  role="option"
                  aria-selected={choisie ? "true" : "false"}
                  onClick={(e) => {
                    e.stopPropagation();
                    choisir(o);
                  }}
                >
                  {o.label}
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </>
  );
}
