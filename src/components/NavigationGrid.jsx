import { useState, useEffect } from "react";
import "./NavigationGrid.css";
import useTranslation from "../hooks/useTranslation";
import useLanguage from "../hooks/useLanguage";
import AvailabilityBadge from "./AvailabilityBadge";
import {
  getStoryAvailability,
  getCategoryAvailability,
} from "../utils/storyAvailability";

function NavigationGrid({ onStorySelect }) {
  const { t } = useTranslation();
  const { getStoryMetadata, languageData, selectedLanguage, storyMetadata } =
    useLanguage();
  const [navigationPath, setNavigationPath] = useState([]);
  const [currentItems, setCurrentItems] = useState([]);
  const [currentLevel, setCurrentLevel] = useState("collection");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentLevel();
  }, [navigationPath, storyMetadata, selectedLanguage]);

  const loadCurrentLevel = async () => {
    setLoading(true);
    try {
      if (navigationPath.length === 0) {
        const response = await fetch("/templates/OBS/index.toml");
        const text = await response.text();
        const data = parseToml(text);

        const categoriesData = await Promise.all(
          data.categories.map(async (categoryDir) => {
            const url = `/templates/OBS/${categoryDir}/index.toml`;
            const catResponse = await fetch(url);
            const catText = await catResponse.text();
            const catData = parseToml(catText);

            // Check if all stories in this category are missing content
            const storyIds = catData.stories
              ? catData.stories.map((s) => s.id)
              : [];

            // Build storyMetadataCache for these stories
            const storyMetadataCache = {};
            storyIds.forEach((storyId) => {
              const metadata = getStoryMetadata(storyId);
              if (metadata) {
                storyMetadataCache[storyId] = metadata;
              }
            });

            const categoryAvail = getCategoryAvailability(
              storyIds,
              storyMetadataCache,
              languageData[selectedLanguage],
            );

            // Show empty badge only if ALL stories are empty (no content at all)
            let categoryStatus = null;
            if (
              categoryAvail.total > 0 &&
              categoryAvail.empty === categoryAvail.total
            ) {
              categoryStatus = "empty";
            }

            return {
              id: catData.id,
              title: catData.title,
              image: catData.image?.filename,
              path: categoryDir,
              level: "category",
              availability: categoryStatus ? { status: categoryStatus } : null,
            };
          }),
        );

        setCurrentItems(categoriesData);
        setCurrentLevel("collection");
      } else if (navigationPath.length === 1) {
        const categoryPath = navigationPath[0].path;
        const response = await fetch(
          `/templates/OBS/${categoryPath}/index.toml`,
        );
        const text = await response.text();
        const data = parseToml(text);

        const storiesData = data.stories.map((story) => {
          const storyId = story.id;
          const metadata = getStoryMetadata(storyId);
          const availability = getStoryAvailability(
            metadata,
            languageData[selectedLanguage],
          );

          return {
            id: story.id,
            title: story.title,
            image: story.image || data.image?.filename,
            path: `${categoryPath}/${story.id}.md`,
            level: "story",
            storyImage: story.image,
            availability: availability,
          };
        });

        setCurrentItems(storiesData);
        setCurrentLevel("category");
      }
    } catch (error) {
      console.error("Error loading navigation:", error);
    }
    setLoading(false);
  };

  const parseToml = (text) => {
    const lines = text.split("\n");
    const result = { stories: [] };
    let currentStory = null;
    let inImage = false;
    let inArray = false;
    let arrayKey = null;
    let arrayValues = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      if (line.startsWith("#") || line === "") continue;

      // Check for section headers
      if (line.startsWith("[") && line.endsWith("]")) {
        if (line === "[image]") {
          inImage = true;
          result.image = {};
          continue;
        }

        if (line === "[[stories]]") {
          if (currentStory) {
            result.stories.push(currentStory);
          }
          currentStory = {};
          inImage = false;
          continue;
        }

        // Reset section flags for other sections
        inImage = false;
        continue;
      }

      // Check if this is the start of a multi-line array
      if (line.match(/^(\w+)\s*=\s*\[$/)) {
        const match = line.match(/^(\w+)\s*=\s*\[$/);
        arrayKey = match[1];
        inArray = true;
        arrayValues = [];
        continue;
      }

      // Check if this is the end of a multi-line array
      if (inArray && line === "]") {
        result[arrayKey] = arrayValues;
        inArray = false;
        arrayKey = null;
        arrayValues = [];
        continue;
      }

      // Check if we're inside a multi-line array
      if (inArray) {
        let cleanValue = line.replace(/,$/g, ""); // Remove trailing comma
        cleanValue = cleanValue.replace(/^"/, "").replace(/"$/, ""); // Remove quotes
        if (cleanValue) {
          arrayValues.push(cleanValue);
        }
        continue;
      }

      const match = line.match(/^(\w+)\s*=\s*(.+)$/);
      if (match) {
        const key = match[1];
        let value = match[2].trim();

        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("[") && value.endsWith("]")) {
          value = value
            .slice(1, -1)
            .split(",")
            .map((v) => v.trim().replace(/"/g, ""));
        } else if (!isNaN(value)) {
          value = parseInt(value);
        }

        if (inImage) {
          result.image[key] = value;
        } else if (currentStory) {
          currentStory[key] = value;
        } else {
          result[key] = value;
        }
      }
    }

    if (currentStory) {
      result.stories.push(currentStory);
    }

    return result;
  };

  const handleItemClick = (item) => {
    if (item.level === "category") {
      setNavigationPath([...navigationPath, item]);
    } else if (item.level === "story") {
      onStorySelect({
        path: item.path,
        image: item.storyImage,
        title: item.title,
      });
    }
  };

  const handleBackClick = () => {
    if (navigationPath.length > 0) {
      setNavigationPath(navigationPath.slice(0, -1));
    }
  };

  const getCurrentTitle = () => {
    if (navigationPath.length === 0) {
      return "Open Bible Stories";
    } else {
      return navigationPath[navigationPath.length - 1].title;
    }
  };

  if (loading) {
    return (
      <div className="navigation-loading">{t("navigationGrid.loading")}</div>
    );
  }

  return (
    <div className="navigation-container">
      <div className="navigation-header">
        {navigationPath.length > 0 && (
          <button className="back-button" onClick={handleBackClick}>
            ← Back
          </button>
        )}
        <h1 className="navigation-title">{getCurrentTitle()}</h1>
      </div>

      <div className={`navigation-grid ${currentLevel}`}>
        {currentItems.map((item) => {
          return (
            <div
              key={item.path}
              className={`navigation-item ${item.level}`}
              onClick={() => handleItemClick(item)}
            >
              {item.image && (
                <div style={{ position: "relative" }}>
                  <img
                    src={
                      item.image.startsWith("http")
                        ? item.image
                        : `/navIcons/${item.image}`
                    }
                    alt={item.title}
                    className="navigation-image"
                  />
                  {item.availability && (
                    <AvailabilityBadge
                      status={item.availability.status}
                      size="small"
                    />
                  )}
                </div>
              )}
              <div className="navigation-item-title">{item.title}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default NavigationGrid;
