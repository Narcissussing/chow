module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.js"],
  moduleNameMapper: { "\\.(css|svg|png|webp)$": "<rootDir>/src/__mocks__/fichier.cjs" },
};
