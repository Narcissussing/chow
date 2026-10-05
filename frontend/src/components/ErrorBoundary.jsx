import { Component } from "react";
import ErreurPage from "./ErreurPage.jsx";

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
