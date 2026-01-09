import React, { useState, useEffect } from "react";
import useMediaPlayer from "../hooks/useMediaPlayer";
import useTranslation from "../hooks/useTranslation";
import "./FullPlayingPane.css";

const FullPlayingPane = () => {
  const { t } = useTranslation();
  const {
    currentPlaylist,
    isPlaying,
    currentSegmentIndex,
    getCurrentSegment,
    totalDuration,
  } = useMediaPlayer();

  const [showText, setShowText] = useState(false);

  const currentSegment = getCurrentSegment();

  // Get current section data from parsed sections
  const currentSectionData = useMemo(() => {
    if (!currentSegment || !currentSegment.imageUrl) {
      return null;
    }

    return {
      imageUrl: currentSegment.imageUrl,
      text: currentSegment.text || "",
      reference: currentSegment.reference || "",
      sectionNum: currentSegment.sectionNum || currentSegmentIndex + 1,
    };
  }, [currentSegment, currentSegmentIndex]);

  // Calculate animation duration based on segment timing
  const animationDuration = useMemo(() => {
    if (!currentSegment || !currentSegment.duration) {
      return 10; // Default 10 seconds
    }
    return currentSegment.duration;
  }, [currentSegment]);

  // Cycle through different Ken Burns animations
  const animationVariant = useMemo(() => {
    return (currentSegmentIndex % 4) + 1;
  }, [currentSegmentIndex]);

  if (!currentSectionData || !currentPlaylist || currentPlaylist.length === 0) {
    return null;
  }

  const toggleText = () => {
    setShowText(!showText);
  };

  return (
    <div className={`full-playing-pane ${showText ? "text-visible" : ""}`}>
      <div className="full-playing-pane-image-container">
        <img
          key={currentSegmentIndex}
          src={currentSectionData.imageUrl}
          alt={`${t("fullPlayingPane.sectionAlt")} ${currentSectionData.sectionNum}`}
          className={`full-playing-pane-image ${
            isPlaying ? `ken-burns-${animationVariant}` : ""
          }`}
          style={{
            animationDuration: isPlaying ? `${animationDuration}s` : "0s",
          }}
        />
      </div>

      <button
        className="full-playing-pane-toggle-btn"
        onClick={toggleText}
        aria-label={
          showText
            ? t("fullPlayingPane.hideText")
            : t("fullPlayingPane.showText")
        }
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            display: "block",
            transition: "transform 0.3s ease",
            transform: showText ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path d="M7 10l5 5 5-5z" fill="#eee" />
        </svg>
      </button>

      <div
        className={`full-playing-pane-text ${showText ? "visible" : "hidden"}`}
      >
        {currentSectionData.text && currentSectionData.text.trim() ? (
          <div className="full-playing-pane-text-content">
            {currentSectionData.text.split("\n").map((line, index) => {
              const trimmedLine = line.trim();
              if (!trimmedLine) return null;
              return (
                <p key={index} className="full-playing-pane-paragraph">
                  {trimmedLine}
                </p>
              );
            })}
          </div>
        ) : (
          <div className="full-playing-pane-text-content">
            <p className="full-playing-pane-paragraph">
              No text available for this section.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FullPlayingPane;
