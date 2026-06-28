import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { hideSplash } from "./usePWA.js";

const root = createRoot(document.getElementById("root"));

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Hide splash screen after first render
// requestIdleCallback gives React time to paint first frame
if (typeof requestIdleCallback !== "undefined") {
  requestIdleCallback(hideSplash, { timeout: 2000 });
} else {
  setTimeout(hideSplash, 800);
}
