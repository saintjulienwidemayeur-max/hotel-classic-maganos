import type { MetadataRoute } from "next";

/** Web app manifest: lets the app be installed on a phone, tablet or PC (PWA). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Magaños Classic Plaza Hotel",
    short_name: "Magaños",
    description: "Gestion des clients et des séjours - Magaños Classic Plaza Hotel.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#162724",
    theme_color: "#162724",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
