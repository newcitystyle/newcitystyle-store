import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NEW CITY STYLE",
    short_name: "NEW CITY STYLE",
    description: "Style for Every Family",
    start_url: "/",
    display: "standalone",
    background_color: "#F8F4EC",
    theme_color: "#0A2E73",
    orientation: "portrait",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}