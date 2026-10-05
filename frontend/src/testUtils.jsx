import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter } from "react-router-dom";
import App from "./App.jsx";

export function simulerApi(reponses) {
  global.fetch = jest.fn(async (url, options = {}) => {
    const chemin = url.replace(/^\/api/, "");
    const [statut, corps] = typeof reponses[chemin] === "function" ? reponses[chemin](options) : reponses[chemin] || [404, { erreur: "Route inconnue." }];
    return { status: statut, ok: statut < 400, json: async () => corps };
  });
}

export function rendreApp(chemin) {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[chemin]}>
        <App />
      </MemoryRouter>
    </StrictMode>
  );
}
