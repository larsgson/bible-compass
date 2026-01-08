import { useState, useEffect, useRef } from "react";
import "./Autocomplete.css";

function RegionAutocomplete({
  regions,
  selectedRegion,
  onSelect,
  placeholder = "Search regions...",
  disabled = false,
}) {
  const [inputValue, setInputValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredRegions, setFilteredRegions] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (selectedRegion) {
      setInputValue(selectedRegion.name || selectedRegion);
    }
  }, [selectedRegion]);

  useEffect(() => {
    if (!inputValue.trim() || !regions || regions.length === 0) {
      setFilteredRegions([]);
      return;
    }

    const searchTerm = inputValue.toLowerCase();
    const filtered = regions.filter((region) => {
      const name = typeof region === "string" ? region : region.name || "";
      const code = typeof region === "object" ? region.code || "" : "";

      return (
        name.toLowerCase().includes(searchTerm) ||
        code.toLowerCase().includes(searchTerm)
      );
    });

    setFilteredRegions(filtered);
    setHighlightedIndex(-1);
  }, [inputValue, regions]);

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

  const handleSelectRegion = (region) => {
    const regionName = typeof region === "string" ? region : region.name || "";
    setInputValue(regionName);
    setShowDropdown(false);
    onSelect(region);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || filteredRegions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredRegions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelectRegion(filteredRegions[highlightedIndex]);
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

  const getRegionDisplay = (region) => {
    if (typeof region === "string") return region;
    return region.name || region.code || "";
  };

  const getRegionKey = (region, index) => {
    if (typeof region === "string") return region;
    return region.code || region.name || index;
  };

  const isSelected = (region) => {
    if (!selectedRegion) return false;
    if (typeof region === "string" && typeof selectedRegion === "string") {
      return region === selectedRegion;
    }
    if (typeof region === "object" && typeof selectedRegion === "object") {
      return region.code === selectedRegion.code;
    }
    return false;
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
      {showDropdown && filteredRegions.length > 0 && (
        <div className="autocomplete-dropdown">
          {filteredRegions.map((region, index) => (
            <div
              key={getRegionKey(region, index)}
              className={`autocomplete-item ${
                index === highlightedIndex ? "highlighted" : ""
              } ${isSelected(region) ? "selected" : ""}`}
              onClick={() => handleSelectRegion(region)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="autocomplete-item-primary">
                {getRegionDisplay(region)}
              </div>
            </div>
          ))}
        </div>
      )}
      {showDropdown && inputValue.trim() && filteredRegions.length === 0 && (
        <div className="autocomplete-dropdown">
          <div className="autocomplete-no-results">No regions found</div>
        </div>
      )}
    </div>
  );
}

export default RegionAutocomplete;
