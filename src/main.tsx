import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

const chunkReloadKey = `gavetta:chunk-reload:${window.location.pathname}${window.location.search}`;

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();

  if (sessionStorage.getItem(chunkReloadKey)) return;

  sessionStorage.setItem(chunkReloadKey, "1");
  window.location.reload();
});

window.setTimeout(() => {
  sessionStorage.removeItem(chunkReloadKey);
}, 10_000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* instalação do PWA é opcional — falha silenciosa */
    });
  });
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Elemento principal do aplicativo não encontrado.");
}

createRoot(rootElement).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
