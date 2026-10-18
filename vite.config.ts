import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// Dev server only: exposes the demo-school accounts written by `npm run seed:demo`
// (git-ignored) to the dev-only DemoAccountSwitcher. Never part of a build.
const demoAccounts = (): Plugin => ({
  name: "demo-accounts",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use("/__dev/demo-accounts", (_req, res) => {
      const file = path.resolve(__dirname, "demo-school.credentials.local.json");
      if (!fs.existsSync(file)) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader("Content-Type", "application/json");
      res.end(fs.readFileSync(file));
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: Number(process.env.PORT) || 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), demoAccounts()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
