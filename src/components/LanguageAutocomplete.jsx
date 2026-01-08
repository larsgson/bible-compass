import { useState, useEffect, useRef } from "react";
import "./Autocomplete.css";

function LanguageAutocomplete({
  languages,
  selectedLanguage,
  onSelect,
  placeholder = "Search languages...",
  disabled = false,
}) {
  const [inputValue, setInputValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredLanguages, setFilteredLanguages] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (selectedLanguage) {
      setInputValue(selectedLanguage.english || selectedLanguage.name || "");
    }
  }, [selectedLanguage]);

  useEffect(() => {
    if (!inputValue.trim() || !languages || languages.length === 0) {
      setFilteredLanguages([]);
      return;
    }

    const searchTerm = inputValue.toLowerCase();
    const filtered = languages.filter((lang) => {
      const englishName = (lang.english || "").toLowerCase();
      const vernacularName = (lang.vernacular || "").toLowerCase();
      const code = (lang.code || "").toLowerCase();

      return (
        englishName.includes(searchTerm) ||
        vernacularName.includes(searchTerm) ||
        code.includes(searchTerm)
      );
    });

    setFilteredLanguages(filtered);
    setHighlightedIndex(-1);
  }, [inputValue, languages]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    setShowDropdown(true);
  };

  const handleSelectLanguage = (language) => {
    setInputValue(language.english || language.name || "");
    setShowDropdown(false);
    onSelect(language);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || filteredLanguages.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredLanguages.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelectLanguage(filteredLanguages[highlightedIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        break;
      default:
        break;
    }
  };

  const handleFocus = () => {
    if (inputValue.trim()) {
      setShowDropdown(true);
    }
  };

  return (
    <div className="autocomplete-container" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        className="autocomplete-input"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
      {showDropdown && filteredLanguages.length > 0 && (
        <div className="autocomplete-dropdown">
          {filteredLanguages.map((lang, index) => (
            <div
              key={lang.code || index}
              className={`autocomplete-item ${
                index === highlightedIndex ? "highlighted" : ""
              } ${
                selectedLanguage &&
                selectedLanguage.code === lang.code
                  ? "selected"
                  : ""
              }`}
              onClick={() => handleSelectLanguage(lang)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="autocomplete-item-primary">
                {lang.english || lang.name}
              </div>
              {lang.vernacular && (
                <div className="autocomplete-item-secondary">
                  {lang.vernacular}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {showDropdown && inputValue.trim() && filteredLanguages.length === 0 && (
        <div className="autocomplete-dropdown">
          <div className="autocomplete-no-results">No languages found</div>
        </div>
      )}
    </div>
  );
}

export default LanguageAutocomplete;
