import { useEffect } from "react";

// Classe posée sur <body> (mode-magasin) et toujours retirée en quittant la page.
export function useBodyClass(classe, active) {
  useEffect(() => {
    if (!active) return;
    document.body.classList.add(classe);
    return () => document.body.classList.remove(classe);
  }, [classe, active]);
}
