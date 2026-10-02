import { Fragment } from "react";
import { useLocation } from "react-router-dom";

// D6 : chaque navigation recrée la page, comme un rechargement EJS (même un clic sur la page active).
export default function Cle({ children }) {
  const { key } = useLocation();
  return <Fragment key={key}>{children}</Fragment>;
}
