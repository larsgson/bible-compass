import React, { useMemo } from "react";
import useMediaPlayer from "../hooks/useMediaPlayer";
import useTranslation from "../hooks/useTranslation";
import "./MinimizedAudioPlayer.css";

const MinimizedAudioPlayer = () => {
  const { t } = useTranslation();
  const {
    currentPlaylist,
    isPlaying,
    currentSegmentIndex,
    play,
    pause,
    setMinimized,
    getCurrentSegment,
    getCurrentVerse,
  } = useMediaPlayer();

  if (!currentPlaylist || currentPlaylist.length === 0) {
    return null;
  }

  const currentSegment = getCurrentSegment();
  const currentReference = currentSegment?.reference || "";
  const currentVerse = getCurrentVerse();

  // Get the image URL for the current section
  const currentImageUrl = useMemo(() => {
    if (!currentSegment || !currentSegment.imageUrl) {
      return null;
    }
    return currentSegment.imageUrl;
  }, [currentSegment]);

  const handlePlayPause = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleExpand = () => {
    setMinimized(false);
  };

  return (
    <div className="minimized-audio-player" onClick={handleExpand}>
      {currentImageUrl && (
        <div className="minimized-audio-player-image">
          <img
            src={currentImageUrl}
            alt={`${t("fullPlayingPane.sectionAlt")} ${currentSegmentIndex + 1}`}
          />
        </div>
      )}

      <div className="minimized-audio-player-overlay">
        <div className="minimized-audio-player-content">
          <div className="minimized-audio-player-info">
            <div className="minimized-audio-player-title">
              {currentSegmentIndex + 1}/{currentPlaylist.length} -{" "}
              {currentVerse || "Loading..."}
            </div>
          </div>

          <button
            className="minimized-audio-player-btn"
            onClick={handlePlayPause}
            aria-label={
              isPlaying ? t("audioPlayer.pause") : t("audioPlayer.play")
            }
          >
            {isPlaying ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                style={{ display: "block" }}
              >
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" fill="#fff" />
              </svg>
            ) : (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                style={{ display: "block" }}
              >
                <path d="M8 5v14l11-7z" fill="#fff" />
              </svg>
            )}
          </button>
        </div>

        {isPlaying && <div className="minimized-audio-player-pulse" />}
      </div>
    </div>
  );
};

export default MinimizedAudioPlayer;
