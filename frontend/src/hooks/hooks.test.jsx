import { act, render, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { reinitialiserSessionPourTests } from "../api.js";
import { useBodyClass } from "./useBodyClass.js";
import { useLocalStorage } from "./useLocalStorage.js";
import { useMinuteurs } from "./useMinuteurs.js";
import { usePageData } from "./usePageData.js";

test("useBodyClass retire sa classe au démontage", () => {
  function Page() {
    useBodyClass("mode-magasin", true);
    return null;
  }
  const { unmount } = render(<Page />);
  expect(document.body).toHaveClass("mode-magasin");
  unmount();
  expect(document.body).not.toHaveClass("mode-magasin");
});

test("useMinuteurs annule ses minuteurs au démontage", () => {
  jest.useFakeTimers();
  const appel = jest.fn();
  const { result, unmount } = renderHook(() => useMinuteurs());
  result.current(appel, 300);
  unmount();
  jest.advanceTimersByTime(300);
  expect(appel).not.toHaveBeenCalled();
  jest.useRealTimers();
});

test("useLocalStorage garde la valeur par défaut si le stockage échoue", () => {
  const lire = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("bloqué");
  });
  const { result } = renderHook(() => useLocalStorage("vueStock", (v) => (v === "liste" ? "liste" : "grille")));
  expect(result.current[0]).toBe("grille");
  lire.mockRestore();
});

test("usePageData sous StrictMode : une seule réponse appliquée, la lecture annulée est ignorée", async () => {
  reinitialiserSessionPourTests();
  let appels = 0;
  global.fetch = jest.fn(async (url, { signal }) => {
    const numero = ++appels;
    await new Promise((r) => setTimeout(r, 10));
    if (signal.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
    return { status: 200, ok: true, json: async () => ({ numero }) };
  });
  const { result } = renderHook(() => usePageData("/stock"), { wrapper: StrictMode });
  expect(result.current.etat).toBe("chargement");
  await act(() => new Promise((r) => setTimeout(r, 30)));
  expect(result.current.etat).toBe("pret");
  expect(result.current.donnees.numero).toBe(2);
});

test("usePageData : panne réseau → erreur", async () => {
  global.fetch = jest.fn(async () => {
    throw new TypeError("Failed to fetch");
  });
  const { result } = renderHook(() => usePageData("/stock"));
  await act(() => Promise.resolve());
  expect(result.current.etat).toBe("erreur");
});
