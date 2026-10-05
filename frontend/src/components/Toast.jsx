import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { abonnerToast } from "../toast.js";

export default function Toast() {
  const [message, setMessage] = useState(null);
  const [envoi, setEnvoi] = useState(0);
  const ref = useRef(null);

  useEffect(
    () =>
      abonnerToast((texte) => {
        setMessage(texte);
        setEnvoi((n) => n + 1);
      }),
    []
  );

  useLayoutEffect(() => {
    const toast = ref.current;
    if (!toast) return;
    toast.classList.remove("visible");
    if (message === null) return;
    void toast.offsetWidth;
    toast.classList.add("visible");
    const minuteur = setTimeout(() => toast.classList.remove("visible"), 3500);
    return () => clearTimeout(minuteur);
  }, [envoi, message]);

  if (envoi === 0) return null;
  return createPortal(
    <div id="toastReseau" className="toast-reseau" ref={ref}>
      {message}
    </div>,
    document.body
  );
}
