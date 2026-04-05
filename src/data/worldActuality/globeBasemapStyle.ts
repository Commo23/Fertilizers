import type { StyleSpecification } from "maplibre-gl";

/**
 * Fond type World Monitor : imagerie Esri assombrie + fond noir (pas de labels vectoriels).
 * Tuiles : © Esri — voir conditions d’usage Esri pour la prod.
 */
export const WM_SATELLITE_BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  name: "commohedge-wm-visual",
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    esri_world: {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        '<a href="https://www.esri.com/">Esri</a> — Maxar, Earthstar Geographics, GIS User Community',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "wm-bg",
      type: "background",
      paint: { "background-color": "#020617" },
    },
    {
      id: "wm-esri",
      type: "raster",
      source: "esri_world",
      paint: {
        "raster-opacity": 0.9,
        "raster-brightness-min": 0.1,
        "raster-brightness-max": 0.48,
        "raster-contrast": 0.3,
        "raster-saturation": -0.55,
        "raster-fade-duration": 0,
      },
    },
  ],
};
