import { useLayoutEffect } from "react";
import Chargement from "./Chargement.jsx";
import ErreurPage from "./ErreurPage.jsx";
import Footer from "./Footer.jsx";
import { useSignalerPagePrete } from "./Shell.jsx";

export default function Page({ titre, etat = "pret", children }) {
  const signalerPagePrete = useSignalerPagePrete();

  useLayoutEffect(() => {
    if (titre) document.title = `Chow — ${titre}`;
  }, [titre]);

  useLayoutEffect(() => {
    if (etat === "pret") signalerPagePrete();
  }, [etat, signalerPagePrete]);

  if (etat === "chargement") return <Chargement />;
  if (etat === "erreur") return <ErreurPage />;
  return (
    <>
      {children}
      <Footer />
    </>
  );
}
