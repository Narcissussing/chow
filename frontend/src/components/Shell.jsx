import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import Header from "./Header.jsx";
import Toast from "./Toast.jsx";
import { effacerToast } from "../toast.js";
import { fermerTousLesSelects } from "./CustomSelect.jsx";

const CLE_POSITIONS = "chow-defilement";
const DefilementContext = createContext(() => {});

function lirePositions() {
  try {
    return JSON.parse(sessionStorage.getItem(CLE_POSITIONS)) || {};
  } catch {
    return {};
  }
}

// html a scroll-behavior: smooth ; un rechargement EJS, lui, ne défile jamais en douceur.
function defilerInstantanement(top) {
  window.scrollTo({ top, left: 0, behavior: "instant" });
}

export default function Shell({ children }) {
  const header = useRef(null);
  const location = useLocation();
  const typeNavigation = useNavigationType();
  const positions = useRef(lirePositions());

  // --header-h : vraie hauteur du header, lue par les barres sticky (comme le script de header.ejs).
  useLayoutEffect(() => {
    function publierHauteurHeader() {
      if (header.current) {
        document.documentElement.style.setProperty("--header-h", header.current.offsetHeight + "px");
      }
    }
    publierHauteurHeader();
    window.addEventListener("resize", publierHauteurHeader);
    return () => window.removeEventListener("resize", publierHauteurHeader);
  }, []);

  // Filet Android : reset du zoom à la sortie d'un champ ("blur" ne remonte pas, d'où la capture).
  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) return;
    const contenuNormal = viewport.getAttribute("content");
    let minuteur;
    function auBlur(event) {
      if (!(event.target instanceof Element) || !event.target.matches("input, select, textarea")) return;
      viewport.setAttribute("content", contenuNormal + ", user-scalable=0");
      clearTimeout(minuteur);
      minuteur = setTimeout(() => viewport.setAttribute("content", contenuNormal), 300);
    }
    document.addEventListener("blur", auBlur, true);
    return () => {
      document.removeEventListener("blur", auBlur, true);
      clearTimeout(minuteur);
      viewport.setAttribute("content", contenuNormal);
    };
  }, []);

  // Q7 : position mémorisée par entrée d'historique, restaurée au retour arrière.
  useEffect(() => {
    window.history.scrollRestoration = "manual";
  }, []);

  useEffect(() => {
    let enAttente = false;
    function enregistrer() {
      if (enAttente) return;
      enAttente = true;
      requestAnimationFrame(() => {
        enAttente = false;
        positions.current[location.key] = window.scrollY;
        try {
          sessionStorage.setItem(CLE_POSITIONS, JSON.stringify(positions.current));
        } catch {
          // Stockage indisponible : la position ne survivra simplement pas au rechargement.
        }
      });
    }
    window.addEventListener("scroll", enregistrer, { passive: true });
    return () => window.removeEventListener("scroll", enregistrer);
  }, [location.key]);

  // Nouvelle page : haut tout de suite ; retour arrière : on attend que la page ait ses données.
  useLayoutEffect(() => {
    effacerToast();
    fermerTousLesSelects();
    if (typeNavigation !== "POP") defilerInstantanement(0);
  }, [location.key, typeNavigation]);

  const signalerPagePrete = useCallback(() => {
    if (typeNavigation === "POP") defilerInstantanement(positions.current[location.key] ?? 0);
  }, [location.key, typeNavigation]);

  return (
    <DefilementContext.Provider value={signalerPagePrete}>
      <Header ref={header} />
      {children}
      <Toast />
    </DefilementContext.Provider>
  );
}

export function useSignalerPagePrete() {
  return useContext(DefilementContext);
}
