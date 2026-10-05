import { Fragment } from "react";
import { useLocation } from "react-router-dom";

export default function Cle({ children }) {
  const { key } = useLocation();
  return <Fragment key={key}>{children}</Fragment>;
}
