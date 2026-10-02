import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Même PORT qu'Express (.env racine) ; seules les variables VITE_* atteindraient le navigateur.
  const { PORT = "3000" } = loadEnv(mode, "..", "");
  const express = `http://localhost:${PORT}`;

  // En dev, Express sert l'API, le CSS et les images ; le reste est l'app React.
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": express,
        "/css": express,
        "/images": express,
      },
    },
  };
});
