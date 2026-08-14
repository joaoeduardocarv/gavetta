// Service worker mínimo — necessário para o app ser instalável
// e aparecer no menu "Compartilhar" do Android (Web Share Target).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Sem cache offline: apenas repassa as requisições para a rede.
self.addEventListener("fetch", () => {});
