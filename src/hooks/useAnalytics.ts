import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const MEASUREMENT_ID = "G-KE6N3TY6WJ";

function pageview(path: string) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    send_to: MEASUREMENT_ID,
  });
}

/**
 * Envia um evento de conversão (clique em CTA, cadastro concluído, etc.)
 * para o GA4. Silencioso quando o gtag ainda não carregou.
 */
export function trackEvent(
  name: string,
  params: Record<string, string | number | boolean> = {}
) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, { ...params, send_to: MEASUREMENT_ID });
}

export function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    pageview(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}
