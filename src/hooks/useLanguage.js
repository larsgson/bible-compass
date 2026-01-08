import { useContext } from "react";
import { LanguageContext } from "../context/LanguageContext";

/**
 * Hook for consuming LanguageContext
 * Provides access to language data, Bible text, and language management functions
 */
const useLanguage = () => {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }

  return context;
};

export default useLanguage;
