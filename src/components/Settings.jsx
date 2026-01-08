import { useState, useEffect } from "react";
import "./Settings.css";
import LanguageAutocomplete from "./LanguageAutocomplete";
import RegionAutocomplete from "./RegionAutocomplete";
import useLanguage from "../hooks/useLanguage";

function Settings({
  selectedLanguage,
  setSelectedLanguage,
  selectedRegion,
  setSelectedRegion,
  onBack,
}) {
  const [languages, setLanguages] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { selectedLanguage: activeLanguage, languageNames } = useLanguage();

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load languages
        const langsResponse = await fetch("/ALL-langs-compact.json");
        const langsData = await langsResponse.json();

        // Extract language list from canons.nt.with-timecode
        const langList = [];
        if (langsData.canons?.nt) {
          Object.keys(langsData.canons.nt).forEach((category) => {
            const categoryData = langsData.canons.nt[category];
            Object.keys(categoryData).forEach((code) => {
              const lang = categoryData[code];
              if (!langList.find((l) => l.code === code)) {
                langList.push({
                  code,
                  english: lang.n,
                  vernacular: lang.v,
                });
              }
            });
          });
        }

        langList.sort((a, b) => a.english.localeCompare(b.english));
        setLanguages(langList);

        // Load regions
        const regionsResponse = await fetch("/regions.json");
        const regionsData = await regionsResponse.json();

        const regionList = Object.keys(regionsData)
          .map((name) => ({
            name: name.replace(/_/g, " "),
            code: name,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setRegions(regionList);
        setLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <div className="settings">
      <div className="settings-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <h1>Settings</h1>
      </div>

      <div className="settings-content">
        <div className="setting-section">
          <h2>Language Selection</h2>
          {activeLanguage && (
            <p className="active-language-indicator">
              Active:{" "}
              <strong>
                {languageNames[activeLanguage]?.english || activeLanguage}
              </strong>
              {languageNames[activeLanguage]?.vernacular &&
                ` (${languageNames[activeLanguage].vernacular})`}
            </p>
          )}
          <div className="setting-item">
            <label htmlFor="language-select">Select Language:</label>
            <LanguageAutocomplete
              languages={languages}
              selectedLanguage={selectedLanguage}
              onSelect={setSelectedLanguage}
              placeholder="Type to search languages..."
              disabled={loading}
            />
          </div>
        </div>

        <div className="setting-section">
          <h2>Region Selection</h2>
          <div className="setting-item">
            <label htmlFor="region-select">Select Region:</label>
            <RegionAutocomplete
              regions={regions}
              selectedRegion={selectedRegion}
              onSelect={setSelectedRegion}
              placeholder="Type to search regions..."
              disabled={loading}
            />
          </div>
        </div>

        {(selectedLanguage || selectedRegion) && (
          <div className="settings-summary">
            <h3>Current Selection</h3>
            {selectedLanguage && (
              <div className="summary-item">
                <strong>Language:</strong> {selectedLanguage.name}
                {selectedLanguage.vernacular &&
                  ` (${selectedLanguage.vernacular})`}
              </div>
            )}
            {selectedRegion && (
              <div className="summary-item">
                <strong>Region:</strong> {selectedRegion}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;
