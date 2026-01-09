// Locale exports and configuration
import en from "./en.js";
import fr from "./fr.js";

// Available locales
export const locales = {
  en,
  fr,
};

// Default locale
export const defaultLocale = "en";

// Get locale strings for a given language code
export const getLocale = (langCode) => {
  // Map common language codes to UI locales
  const localeMap = {
    eng: "en",
    fra: "fr",
    en: "en",
    fr: "fr",
  };

  const mappedCode = localeMap[langCode] || defaultLocale;
  return locales[mappedCode] || locales[defaultLocale];
};

export default locales;
