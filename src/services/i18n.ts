type Params = Record<string, string | number | undefined>;

const MESSAGES: Record<string, string> = {
  'panels.liveNews': 'Actualités en direct',
  'panels.liveWebcams': 'Webcams en direct',
  'components.webcams.regions.iran': 'Iran / attaques',
  'components.webcams.regions.all': 'Tous',
  'components.webcams.regions.mideast': 'Moyen-Orient',
  'components.webcams.regions.europe': 'Europe',
  'components.webcams.regions.americas': 'Amériques',
  'components.webcams.regions.asia': 'Asie',
  'components.webcams.regions.space': 'Espace',
  'components.webcams.paused': 'Flux en pause (hors écran)',
  'components.webcams.pausedIdle': 'Flux en pause (inactivité)',
  'webcams.expand': 'Agrandir',
  'common.close': 'Fermer',
  'common.retry': 'Réessayer',
  'common.live': 'LIVE',
  'header.search': 'Rechercher',
  'components.liveNews.channelSettings': 'Chaînes',
  'components.liveNews.notLive': 'Flux non disponible pour {{name}}',
  'components.liveNews.cannotEmbed': 'Lecture intégrée impossible pour {{name}} ({{code}})',
  'components.liveNews.openOnYouTube': 'Ouvrir sur YouTube',
  'components.liveNews.botCheck': 'YouTube demande une vérification pour {{name}}',
  'components.liveNews.signInToYouTube': 'Se connecter à YouTube',
  'components.liveNews.manage': 'Gestion des chaînes',
  'components.liveNews.restoreDefaults': 'Rétablir les chaînes par défaut',
  'components.liveNews.availableChannels': 'Chaînes disponibles',
  'components.liveNews.customChannel': 'Chaîne personnalisée',
  'components.liveNews.youtubeHandleOrUrl': 'Handle ou URL YouTube',
  'components.liveNews.hlsUrl': 'URL flux HLS (optionnel)',
  'components.liveNews.displayName': 'Nom affiché',
  'components.liveNews.addChannel': 'Ajouter la chaîne',
  'components.liveNews.youtubeHandle': 'Handle YouTube (@Chaîne)',
  'components.liveNews.remove': 'Retirer',
  'components.liveNews.save': 'Enregistrer',
  'components.liveNews.cancel': 'Annuler',
  'components.liveNews.noResults': 'Aucune chaîne pour « {{term}} »',
  'components.liveNews.regionNorthAmerica': 'Amérique du Nord',
  'components.liveNews.regionEurope': 'Europe',
  'components.liveNews.regionLatinAmerica': 'Amérique latine',
  'components.liveNews.regionAsia': 'Asie',
  'components.liveNews.regionMiddleEast': 'Moyen-Orient',
  'components.liveNews.regionAfrica': 'Afrique',
  'components.liveNews.regionOceania': 'Océanie',
  'components.liveNews.invalidHlsUrl': 'URL HLS (.m3u8) invalide',
  'components.liveNews.verifying': 'Vérification…',
  'components.liveNews.invalidHandle': 'Handle YouTube invalide (ex. @Chaîne)',
  /* Carte WorldMonitor — panneau couches */
  'components.deckgl.layersTitle': 'Couches',
  'components.deckgl.layerSearch': 'Rechercher...',
  'components.deckgl.layerGuide': 'Guide des calques',
  'components.deckgl.zoomIn': 'Zoomer',
  'components.deckgl.zoomOut': 'Zoom arrière',
  'components.deckgl.resetView': 'Réinitialiser la vue',
  'components.deckgl.timeAll': 'Tout',
  'components.deckgl.views.global': 'Mondial',
  'components.deckgl.views.americas': 'Amériques',
  'components.deckgl.views.mena': 'MENA',
  'components.deckgl.views.europe': 'Europe',
  'components.deckgl.views.asia': 'Asie',
  'components.deckgl.views.latam': 'Amérique latine',
  'components.deckgl.views.africa': 'Afrique',
  'components.deckgl.views.oceania': 'Océanie',
};

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    String(params[key] ?? ''),
  );
}

export function t(key: string, params?: Params): string {
  const template = MESSAGES[key] ?? key;
  return interpolate(template, params);
}

/** Used by `@/utils` (formatTime, theme). */
export function getCurrentLanguage(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language.split('-')[0] || 'en';
  }
  return 'en';
}
