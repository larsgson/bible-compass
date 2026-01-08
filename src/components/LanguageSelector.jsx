import { useState, useEffect, useMemo } from "react";
import "./LanguageSelector.css";
import useLanguage from "../hooks/useLanguage";

function LanguageSelector({
  currentLanguage,
  previewLanguage,
  onPreviewChange,
  onClose,
  onApply,
}) {
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

  const displayLanguage = previewLanguage || currentLanguage;
  const hasChanges = previewLanguage && previewLanguage.code !== currentLanguage?.code;

  const handleLanguageClick = (language) => {
    onPreviewChange(language);
  };

  const handleClose = () => {
    if (hasChanges) {
      const confirmClose = window.confirm(
        "You have unsaved language changes. Are you sure you want to close without applying?"
      );
      if (!confirmClose) return;
    }
    onClose();
  };

  const getCategoryColor = (category) => {
    const colors = {
      "with-timecode": "#28a745",
      "syncable": "#17a2b8",
      "audio-only": "#ffc107",
      "text-only": "#6c757d",
      "incomplete-timecode": "#dc3545",
    };
    return colors[category] || "#6c757d";
  };

  return (
    <div className="language-selector-overlay" onClick={handleClose}>
      <div className="language-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="language-selector-header">
          <h2>Select Language</h2>
          <button
            className="close-button"
            onClick={handleClose}
            aria-label="Close"
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
                {currentLanguage ? (
                  <>
                    <strong>{currentLanguage.english || currentLanguage.code}</strong>
                    {currentLanguage.vernacular && (
                      <span className="vernacular"> ({currentLanguage.vernacular})</span>
                    )}
                    <span className="language-code"> [{currentLanguage.code}]</span>
                  </>
                ) : (
                  <span className="no-language">No language selected</span>
                )}
              </span>
            </div>

            {hasChanges && (
              <div className="language-status preview">
                <span className="status-label">Preview:</span>
                <span className="status-value highlight">
                  <strong>{previewLanguage.english || previewLanguage.code}</strong>
                  {previewLanguage.vernacular && (
                    <span className="vernacular"> ({previewLanguage.vernacular})</span>
                  )}
                  <span className="language-code"> [{previewLanguage.code}]</span>
                </span>
              </div>
            )}
          </div>

          {/* Search Box */}
          <div className="search-section">
            <input
              type="text"
              className="language-search"
              placeholder="Search by language name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          {/* Language List */}
          <div className="language-list">
            {loading ? (
              <div className="loading-state">Loading languages...</div>
            ) : filteredLanguages.length === 0 ? (
              <div className="empty-state">
                No languages found matching "{searchTerm}"
              </div>
            ) : (
              filteredLanguages.map((language) => {
                const isActive = currentLanguage?.code === language.code;
                const isPreview = previewLanguage?.code === language.code;

                return (
                  <div
                    key={language.code}
                    className={`language-item ${isActive ? "active" : ""} ${isPreview ? "preview" : ""}`}
                    onClick={() => handleLanguageClick(language)}
                  >
                    <div className="language-info">
                      <div className="language-name">
                        {language.english || language.code}
                        {isActive && <span className="check-icon"> ✓</span>}
                        {isPreview && !isActive && <span className="preview-icon"> ➤</span>}
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
                      style={{ backgroundColor: getCategoryColor(language.category) }}
                      title={language.category}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer with Actions */}
        <div className="language-selector-footer">
          {hasChanges ? (
            <>
              <div className="change-message">
                Change from <strong>{currentLanguage?.english || currentLanguage?.code}</strong> to{" "}
                <strong>{previewLanguage?.english || previewLanguage?.code}</strong>?
              </div>
              <div className="action-buttons">
                <button className="button-secondary" onClick={handleClose}>
                  Cancel
                </button>
                <button className="button-primary" onClick={onApply}>
                  Apply Changes
                </button>
              </div>
            </>
          ) : (
            <div className="action-buttons single">
              <button className="button-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LanguageSelector;
