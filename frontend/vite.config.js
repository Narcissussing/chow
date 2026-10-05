import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const { PORT = "3000" } = loadEnv(mode, "..", "");
  const express = `http://localhost:${PORT}`;

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
