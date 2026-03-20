import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: {
      "/api": "http://127.0.0.1:3000",
      "/tax": "http://127.0.0.1:3000",
      "/users": "http://127.0.0.1:3000",
      "/platform": "http://127.0.0.1:3000",
      "/economics": "http://127.0.0.1:3000",
      "/studios": "http://127.0.0.1:3000",
      "/admin": "http://127.0.0.1:3000",
    },
  },
});
