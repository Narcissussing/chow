import { salutation } from "./Accueil.jsx";

test("salutation selon l'heure", () => {
  expect(salutation(8)).toBe("Bonjour");
  expect(salutation(15)).toBe("Bonjour");
  expect(salutation(18)).toBe("Bonsoir");
  expect(salutation(23)).toBe("Bonsoir");
  expect(salutation(3)).toBe("Bonsoir");
  expect(salutation(5)).toBe("Bonjour");
});
