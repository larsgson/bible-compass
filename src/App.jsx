import { useState, useEffect } from "react";
import "./App.css";
import NavigationGrid from "./components/NavigationGrid";
import StoryViewer from "./components/StoryViewer";
import LanguageSelector from "./components/LanguageSelector";
import { LanguageProvider } from "./context/LanguageContext";
import { MediaPlayerProvider } from "./context/MediaPlayerContext";
import useTranslation from "./hooks/useTranslation";

function AppContent({ selectedLanguage, onLanguageSelect }) {
  const { t } = useTranslation();
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);
  const [showEmptyContent, setShowEmptyContent] = useState(false);

  const handleOpenLanguageSelector = () => {
    setShowLanguageSelector(true);
  };

  const handleCloseLanguageSelector = () => {
    setShowLanguageSelector(false);
  };

  const handleLanguageSelect = (language) => {
    onLanguageSelect(language);
    setShowLanguageSelector(false);
  };

  const handleBackToGrid = () => {
    setSelectedStory(null);
  };

  // Get display name for language button
  const getLanguageDisplayName = () => {
    if (!selectedLanguage) return t("app.selectLanguage");

    const name =
      selectedLanguage.vernacular ||
      selectedLanguage.english ||
      selectedLanguage.code;

    // For very long names (>50 chars), truncate but keep meaningful content
    if (name.length > 50) {
      return name.substring(0, 47) + "...";
    }

    return name;
  };

  return (
    <MediaPlayerProvider>
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <h1 className="app-title">{t("app.title")}</h1>
            <button
              className="language-button"
              onClick={handleOpenLanguageSelector}
              aria-label={t("app.changeLanguage")}
            >
              <div className="language-icon-wrapper">
                <span className="language-icon">🌐</span>
                <span className="language-code-mobile">
                  {selectedLanguage?.code || "fra"}
                </span>
              </div>
              <span className="language-text-desktop">
                {getLanguageDisplayName()}
              </span>
            </button>
          </div>
        </header>

        <main className="main-content">
          {!selectedStory && (
            <NavigationGrid
              onStorySelect={setSelectedStory}
              showEmptyContent={showEmptyContent}
              onToggleEmptyContent={() =>
                setShowEmptyContent(!showEmptyContent)
              }
            />
          )}
          {selectedStory && (
            <StoryViewer storyData={selectedStory} onBack={handleBackToGrid} />
          )}
        </main>

        {showLanguageSelector && (
          <LanguageSelector
            selectedLanguage={selectedLanguage}
            onSelect={handleLanguageSelect}
            onClose={handleCloseLanguageSelector}
          />
        )}
      </div>
    </MediaPlayerProvider>
  );
}

function App() {
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    const saved = localStorage.getItem("selectedLanguage");
    return saved ? JSON.parse(saved) : null;
  });

  // Persist language selection to localStorage
  useEffect(() => {
    if (selectedLanguage) {
      localStorage.setItem(
        "selectedLanguage",
        JSON.stringify(selectedLanguage),
      );
    } else {
      localStorage.removeItem("selectedLanguage");
    }
  }, [selectedLanguage]);

  const languageCode = selectedLanguage?.code || "fra";

  return (
    <LanguageProvider initialLanguage={languageCode}>
      <AppContent
        selectedLanguage={selectedLanguage}
        onLanguageSelect={setSelectedLanguage}
      />
    </LanguageProvider>
  );
}

export default App;
