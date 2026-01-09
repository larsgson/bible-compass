import { useState, useEffect, useMemo } from "react";
import "./LanguageSelector.css";
import useLanguage from "../hooks/useLanguage";
import useTranslation from "../hooks/useTranslation";

function LanguageSelector({ selectedLanguage, onSelect, onClose }) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const { languageNames } = useLanguage();

  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const response = await fetch("/ALL-langs-compact.json");
        const data = await response.json();

        const langList = [];
        if (data.canons?.nt) {
          Object.keys(data.canons.nt).forEach((category) => {
            const categoryData = data.canons.nt[category];
            Object.keys(categoryData).forEach((code) => {
              const lang = categoryData[code];
              if (!langList.find((l) => l.code === code)) {
                langList.push({
                  code,
                  english: lang.n,
                  vernacular: lang.v,
                  category,
                });
              }
            });
          });
        }

        langList.sort((a, b) => a.english.localeCompare(b.english));
        setLanguages(langList);
        setLoading(false);
      } catch (error) {
        console.error("Error loading languages:", error);
        setLoading(false);
      }
    };

    loadLanguages();
  }, []);

  const filteredLanguages = useMemo(() => {
    if (!searchTerm.trim()) {
      return languages;
    }

    const search = searchTerm.toLowerCase();
    return languages.filter((lang) => {
      const english = (lang.english || "").toLowerCase();
      const vernacular = (lang.vernacular || "").toLowerCase();
      const code = (lang.code || "").toLowerCase();

      return (
        english.includes(search) ||
        vernacular.includes(search) ||
        code.includes(search)
      );
    });
  }, [languages, searchTerm]);

  const handleLanguageClick = (language) => {
    onSelect(language);
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  const getCategoryColor = (category) => {
    const colors = {
      "with-timecode": "#28a745",
      syncable: "#17a2b8",
      "audio-only": "#ffc107",
      "text-only": "#6c757d",
      "incomplete-timecode": "#dc3545",
    };
    return colors[category] || "#6c757d";
  };

  return (
    <div className="language-selector-overlay" onClick={handleClose}>
      <div
        className="language-selector-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="language-selector-header">
          <h2>{t("languageSelector.title")}</h2>
          <button
            className="close-button"
            onClick={handleClose}
            aria-label={t("languageSelector.close")}
          >
            ✕
          </button>
        </div>

        <div className="language-selector-body">
          {/* Current Language Display */}
          <div className="current-language-section">
            <div className="language-status">
              <span className="status-label">Current:</span>
              <span className="status-value">
                {selectedLanguage ? (
                  <>
                    <strong>
                      {selectedLanguage.english || selectedLanguage.code}
                    </strong>
                    {selectedLanguage.vernacular && (
                      <span className="vernacular">
                        {" "}
                        ({selectedLanguage.vernacular})
                      </span>
                    )}
                    <span className="language-code">
                      {" "}
                      [{selectedLanguage.code}]
                    </span>
                  </>
                ) : (
                  <span className="no-language">
                    {t("languageSelector.noLanguageSelected")}
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Search Box */}
          <div className="search-section">
            <input
              type="text"
              className="language-search"
              placeholder={t("languageSelector.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          {/* Language List */}
          <div className="language-list">
            {loading ? (
              <div className="loading-state">
                {t("languageSelector.loadingLanguages")}
              </div>
            ) : filteredLanguages.length === 0 ? (
              <div className="empty-state">
                No languages found matching "{searchTerm}"
              </div>
            ) : (
              filteredLanguages.map((language) => {
                const isActive = selectedLanguage?.code === language.code;

                return (
                  <div
                    key={language.code}
                    className={`language-item ${isActive ? "active" : ""}`}
                    onClick={() => handleLanguageClick(language)}
                  >
                    <div className="language-info">
                      <div className="language-name">
                        {language.english || language.code}
                        {isActive && <span className="check-icon"> ✓</span>}
                      </div>
                      {language.vernacular && (
                        <div className="language-vernacular">
                          {language.vernacular}
                        </div>
                      )}
                      <div className="language-code-small">{language.code}</div>
                    </div>
                    <div
                      className="language-category-indicator"
                      style={{
                        backgroundColor: getCategoryColor(language.category),
                      }}
                      title={language.category}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer with Actions */}
        {/* Action Buttons */}
        <div className="language-selector-footer">
          <div className="action-buttons single">
            <button className="button-secondary" onClick={handleClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LanguageSelector;
