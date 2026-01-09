import { useMemo } from "react";
import { getLocale } from "../locales";
import useLanguage from "./useLanguage";

/**
 * Hook for accessing localized UI strings
 * Automatically uses the selected Bible language to determine UI language
 * Falls back to English if no matching UI locale exists
 */
const useTranslation = () => {
  const { selectedLanguage } = useLanguage();

  // Get UI locale based on selected Bible language
  const uiLocale = useMemo(() => {
    return getLocale(selectedLanguage);
  }, [selectedLanguage]);

  // Helper function to get nested translation strings
  const t = (key) => {
    const keys = key.split(".");
    let value = uiLocale;

    for (const k of keys) {
      if (value && typeof value === "object") {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    return value || key;
  };

  return { t, uiLocale };
};

export default useTranslation;
