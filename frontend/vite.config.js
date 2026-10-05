import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const { PORT = "3000" } = loadEnv(mode, "..", "");
  const express = `http://localhost:${PORT}`;

  return {
    plugins: [react()],
    // CSS livré tel qu'écrit : le minifieur réécrit certaines valeurs (ex. background: none) sous une autre forme.
    build: { cssMinify: false },
    server: {
      proxy: {
        "/api": express,
        "/images": express,
      },
    },
  };
});
