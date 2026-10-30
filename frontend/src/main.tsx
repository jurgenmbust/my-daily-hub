import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initialTheme, applyTheme } from "./theme.mjs";
// Set the theme before the first app render without retaining a second listener.
applyTheme(initialTheme())();
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
