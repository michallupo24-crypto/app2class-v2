import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "./hooks/useTheme.tsx";
import { FontScaleProvider } from "./hooks/useFontScale.tsx";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <FontScaleProvider>
      <App />
    </FontScaleProvider>
  </ThemeProvider>
);
