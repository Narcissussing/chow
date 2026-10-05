import { useEffect } from "react";

export function useBodyClass(classe, active) {
  useEffect(() => {
    if (!active) return;
    document.body.classList.add(classe);
    return () => document.body.classList.remove(classe);
  }, [classe, active]);
}
