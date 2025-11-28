export function getUILocale(): string {
  try {
    const lang = localStorage.getItem('language') || 'ro';
    // map short codes to full locale
    switch (lang) {
      case 'ro':
        return 'ro-RO';
      case 'en':
        return 'en-US';
      case 'de':
        return 'de-DE';
      case 'fr':
        return 'fr-FR';
      default:
        // if user saved a full locale already, return it
        return lang;
    }
  } catch (e) {
    return 'ro-RO';
  }
}
