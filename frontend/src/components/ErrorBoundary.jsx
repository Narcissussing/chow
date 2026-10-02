import { Component } from "react";
import ErreurPage from "./ErreurPage.jsx";

// Seule classe de l'app : React n'offre pas encore de hook pour attraper une erreur de rendu.
// Les échecs de fetch, eux, restent gérés par usePageData (une frontière ne les voit pas).
export default class ErrorBoundary extends Component {
  state = { erreur: null };

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur, infos) {
    console.error("Erreur de rendu :", erreur, infos.componentStack);
  }

  render() {
    if (this.state.erreur) return <ErreurPage />;
    return this.props.children;
  }
}
