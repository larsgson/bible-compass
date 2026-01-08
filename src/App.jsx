import { useState, useEffect } from "react";
import "./App.css";
import NavigationGrid from "./components/NavigationGrid";
import StoryViewer from "./components/StoryViewer";
import LanguageSelector from "./components/LanguageSelector";
import { LanguageProvider } from "./context/LanguageContext";
import { MediaPlayerProvider } from "./context/MediaPlayerContext";

function App() {
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    const saved = localStorage.getItem("selectedLanguage");
    return saved ? JSON.parse(saved) : null;
  });
  const [previewLanguage, setPreviewLanguage] = useState(null);
  const [selectedStory, setSelectedStory] = useState(null);

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

  // Determine language code to pass to LanguageProvider
  const languageCode = selectedLanguage?.code || "fra";

  const handleOpenLanguageSelector = () => {
    setPreviewLanguage(null);
    setShowLanguageSelector(true);
  };

  const handleCloseLanguageSelector = () => {
    setPreviewLanguage(null);
    setShowLanguageSelector(false);
  };

  const handleApplyLanguage = () => {
    if (previewLanguage) {
      setSelectedLanguage(previewLanguage);
      setPreviewLanguage(null);
    }
    setShowLanguageSelector(false);
  };

  // Get display name for language button
  const getLanguageDisplayName = () => {
    if (!selectedLanguage) return "Select Language";

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
    <LanguageProvider initialLanguage={languageCode}>
      <MediaPlayerProvider>
        <div className="app">
          <header className="app-header">
            <div className="header-content">
              <h1 className="app-title">Bible Compass</h1>
              <button
                className="language-button"
                onClick={handleOpenLanguageSelector}
                aria-label="Change language"
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
              <NavigationGrid onStorySelect={setSelectedStory} />
            )}

            {selectedStory && (
              <StoryViewer
                storyData={selectedStory}
                onBack={() => setSelectedStory(null)}
              />
            )}

            {showLanguageSelector && (
              <LanguageSelector
                currentLanguage={selectedLanguage}
                previewLanguage={previewLanguage}
                onPreviewChange={setPreviewLanguage}
                onClose={handleCloseLanguageSelector}
                onApply={handleApplyLanguage}
              />
            )}
          </main>
        </div>
      </MediaPlayerProvider>
    </LanguageProvider>
  );
}

export default App;
