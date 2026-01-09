import React, { useState, useEffect } from "react";
import useMediaPlayer from "../hooks/useMediaPlayer";
import useTranslation from "../hooks/useTranslation";
import "./AudioPlayer.css";

const AudioPlayer = () => {
  const { t } = useTranslation();
  const {
    currentPlaylist,
    isPlaying,
    isLoading,
    currentSegmentIndex,
    virtualTime,
    totalDuration,
    play,
    pause,
    stop,
    seekTo,
    setMinimized,
    getCurrentSegment,
    getCurrentVerse,
    getSegmentMap,
  } = useMediaPlayer();

  const [isDragging, setIsDragging] = useState(false);
  const [localTime, setLocalTime] = useState(0);

  useEffect(() => {
    if (!isDragging) {
      setLocalTime(virtualTime);
    }
  }, [virtualTime, isDragging]);

  if (!currentPlaylist || currentPlaylist.length === 0) {
    return null;
  }

  const currentSegment = getCurrentSegment();
  const currentReference =
    currentSegment?.reference || t("audioPlayer.defaultReference");
  const currentVerse = getCurrentVerse();

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleStop = () => {
    stop();
  };

  const handleSeekChange = (e) => {
    const newTime = parseFloat(e.target.value);
    setLocalTime(newTime);
  };

  const handleSeekMouseDown = () => {
    setIsDragging(true);
  };

  const handleSeekMouseUp = (e) => {
    setIsDragging(false);
    const newTime = parseFloat(e.target.value);
    seekTo(newTime);
  };

  const handleMinimize = () => {
    setMinimized(true);
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Create marks for segment boundaries using virtual timeline
  const segmentMap = getSegmentMap();
  const segmentMarks = segmentMap
    .map((segment, index) => {
      // Each segment should have virtualStart from the enhanced segment map
      if (segment.virtualStart !== undefined && totalDuration > 0) {
        return {
          position: (segment.virtualStart / totalDuration) * 100,
          index,
        };
      }
      return null;
    })
    .filter(Boolean);

  return (
    <div className="audio-player">
      <div className="audio-player-header">
        <div className="audio-player-info">
          <div className="audio-player-title">
            {currentSegmentIndex + 1}/{currentPlaylist.length} -{" "}
            {currentVerse || t("audioPlayer.loadingVerse")}
          </div>
        </div>
        <button
          className="audio-player-minimize-btn"
          onClick={handleMinimize}
          aria-label={t("audioPlayer.minimize")}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: "block" }}
          >
            <path d="M7 10l5 5 5-5z" fill="#fff" />
          </svg>
        </button>
      </div>

      <div className="audio-player-controls">
        <button
          className={`audio-player-btn audio-player-btn-play ${isPlaying ? "playing" : ""}`}
          onClick={handlePlayPause}
          disabled={isLoading}
          aria-label={
            isPlaying ? t("audioPlayer.pause") : t("audioPlayer.play")
          }
        >
          {isPlaying ? (
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              style={{ display: "block" }}
            >
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" fill="#fff" />
            </svg>
          ) : (
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              style={{ display: "block" }}
            >
              <path d="M8 5v14l11-7z" fill="#fff" />
            </svg>
          )}
        </button>

        <button
          className="audio-player-btn audio-player-btn-stop"
          onClick={handleStop}
          disabled={isLoading}
          aria-label={t("audioPlayer.stop")}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: "block" }}
          >
            <rect x="6" y="6" width="12" height="12" fill="#fff" />
          </svg>
        </button>

        <div className="audio-player-progress-container">
          <div className="audio-player-progress-wrapper">
            <input
              type="range"
              className="audio-player-progress"
              min="0"
              max={totalDuration || 100}
              value={localTime}
              onChange={handleSeekChange}
              onMouseDown={handleSeekMouseDown}
              onMouseUp={handleSeekMouseUp}
              onTouchStart={handleSeekMouseDown}
              onTouchEnd={handleSeekMouseUp}
              disabled={isLoading || !totalDuration}
              aria-label={t("audioPlayer.seek")}
            />
            <div
              className="audio-player-progress-fill"
              style={{
                width: `${totalDuration ? (localTime / totalDuration) * 100 : 0}%`,
              }}
            />
            {segmentMarks.map((mark, i) => (
              <div
                key={i}
                className="audio-player-segment-mark"
                style={{ left: `${mark.position}%` }}
              />
            ))}
          </div>
          <div className="audio-player-time">
            <span className="audio-player-time-current">
              {formatTime(localTime)}
            </span>
            <span className="audio-player-time-separator">/</span>
            <span className="audio-player-time-duration">
              {formatTime(totalDuration)}
            </span>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="audio-player-loading">
          {t("audioPlayer.loadingAudio")}
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;
