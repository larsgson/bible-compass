import React, {
  createContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";

const MediaPlayerContext = createContext(null);

export const MediaPlayerProvider = ({ children }) => {
  const [state, setState] = useState({
    currentPlaylist: null,
    queue: [],
    isPlaying: false,
    isPaused: false,
    currentSegmentIndex: 0,
    currentTime: 0,
    duration: 0,
    virtualTime: 0,
    totalDuration: 0,
    isLoading: false,
    error: null,
    playbackRate: 1.0,
    isMinimized: false,
  });

  const audioRef = useRef(null);
  const currentSegmentRef = useRef(null);
  const isSeekingRef = useRef(false);
  const playlistRef = useRef(null);
  const queueRef = useRef([]);
  const segmentMapRef = useRef([]); // Enhanced playlist with virtual timeline
  const virtualTimeRef = useRef(0);
  const isPlayingRef = useRef(false);

  // Build segment map with virtual timeline
  const buildSegmentMap = useCallback((playlist) => {
    if (!playlist || !playlist.length) return [];

    let cumulativeTime = 0;
    const segmentMap = playlist.map((segment, index) => {
      const timingData = segment.timingData;
      const timestamps = timingData?.timestamps || [];

      // Calculate segment duration from timestamps
      let segmentDuration = 0;
      if (timestamps.length >= 2) {
        segmentDuration = timestamps[timestamps.length - 1] - timestamps[0];
      }

      const startTimestamp = timestamps[0] || 0;
      const endTimestamp = timestamps[timestamps.length - 1] || startTimestamp;

      const enhancedSegment = {
        ...segment,
        index,
        startTimestamp,
        endTimestamp,
        duration: segmentDuration,
        virtualStart: cumulativeTime,
        virtualEnd: cumulativeTime + segmentDuration,
      };

      cumulativeTime += segmentDuration;
      return enhancedSegment;
    });

    return segmentMap;
  }, []);

  // Calculate virtual time from real audio position
  const calculateVirtualTime = useCallback(() => {
    const segmentMap = segmentMapRef.current;
    const currentIndex = currentSegmentRef.current;
    const audio = audioRef.current;

    if (!segmentMap.length || !audio || currentIndex >= segmentMap.length) {
      return 0;
    }

    const currentSegment = segmentMap[currentIndex];
    const realTime = audio.currentTime;
    const offset = realTime - currentSegment.startTimestamp;
    const virtualTime = currentSegment.virtualStart + offset;

    return Math.max(0, virtualTime);
  }, []);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    // Audio event handlers
    const handleTimeUpdate = () => {
      if (!isSeekingRef.current && audioRef.current) {
        const realTime = audioRef.current.currentTime;
        const virtualTime = calculateVirtualTime();

        setState((prev) => ({
          ...prev,
          currentTime: realTime,
          virtualTime: virtualTime,
        }));

        virtualTimeRef.current = virtualTime;

        // Check if we've reached the end of current segment
        const segmentMap = segmentMapRef.current;
        const currentIndex = currentSegmentRef.current;
        if (segmentMap.length && currentIndex < segmentMap.length) {
          const currentSegment = segmentMap[currentIndex];
          if (realTime >= currentSegment.endTimestamp) {
            handleSegmentEnd();
          }
        }
      }
    };

    const handleDurationChange = () => {
      if (audioRef.current) {
        setState((prev) => ({
          ...prev,
          duration: audioRef.current.duration,
        }));
      }
    };

    const handleEnded = () => {
      handleSegmentEnd();
    };

    const handleCanPlay = () => {
      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    };

    const handleWaiting = () => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
      }));
    };

    const handleError = (e) => {
      console.error("Audio playback error:", e);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to load audio",
        isPlaying: false,
      }));
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("error", handleError);
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Update playback rate when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = state.playbackRate;
    }
  }, [state.playbackRate]);

  // Keep refs in sync and rebuild segment map when playlist changes
  useEffect(() => {
    playlistRef.current = state.currentPlaylist;
    currentSegmentRef.current = state.currentSegmentIndex;

    if (state.currentPlaylist) {
      const segmentMap = buildSegmentMap(state.currentPlaylist);
      segmentMapRef.current = segmentMap;

      // Calculate total duration
      const totalDuration =
        segmentMap.length > 0
          ? segmentMap[segmentMap.length - 1].virtualEnd
          : 0;

      setState((prev) => ({
        ...prev,
        totalDuration: totalDuration,
      }));
    }
  }, [state.currentPlaylist, state.currentSegmentIndex, buildSegmentMap]);

  useEffect(() => {
    queueRef.current = state.queue;
  }, [state.queue]);

  const updateState = useCallback((updates) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Load audio for a specific segment
  const loadSegmentAudio = useCallback(
    (segmentOrIndex, seekOffset = 0) => {
      if (!audioRef.current) return;

      const audio = audioRef.current;
      const segmentMap = segmentMapRef.current;

      // Handle both segment object and index
      let segment;
      if (typeof segmentOrIndex === "number") {
        if (segmentOrIndex < 0 || segmentOrIndex >= segmentMap.length) return;
        segment = segmentMap[segmentOrIndex];
      } else {
        segment = segmentOrIndex;
      }

      if (!segment) return;

      const needsNewFile = audio.src !== segment.audioUrl;
      const targetTime = segment.startTimestamp + seekOffset;

      if (needsNewFile) {
        updateState({ isLoading: true });
        audio.src = segment.audioUrl;
        audio.load();

        const handleLoaded = () => {
          audio.currentTime = targetTime;
          audio.removeEventListener("loadeddata", handleLoaded);
        };

        audio.addEventListener("loadeddata", handleLoaded);
      } else {
        // Same file, just seek
        audio.currentTime = targetTime;
      }
    },
    [updateState],
  );

  // Handle playlist end - move to queue or stop
  const handlePlaylistEnd = useCallback(() => {
    updateState({
      isPlaying: false,
      isPaused: false,
    });

    // Check if there's a queued playlist
    const queue = queueRef.current;
    if (queue.length > 0) {
      const nextPlaylist = queue[0];
      const remainingQueue = queue.slice(1);

      updateState({
        currentPlaylist: nextPlaylist,
        queue: remainingQueue,
        currentSegmentIndex: 0,
        currentTime: 0,
      });

      if (nextPlaylist && nextPlaylist.length > 0) {
        loadSegmentAudio(nextPlaylist[0]);
        audioRef.current
          .play()
          .then(() => {
            updateState({ isPlaying: true });
          })
          .catch((err) => {
            console.error("Failed to play queued playlist:", err);
          });
      }
    }
  }, [loadSegmentAudio, updateState, buildSegmentMap]);

  // Handle segment end - move to next segment or playlist
  const handleSegmentEnd = useCallback(() => {
    const segmentMap = segmentMapRef.current;
    const currentIndex = currentSegmentRef.current;
    const wasPlaying = isPlayingRef.current;

    if (!segmentMap || !segmentMap.length) return;

    // Move to next segment
    const nextIndex = currentIndex + 1;
    if (nextIndex < segmentMap.length) {
      // Pause current audio before loading next segment
      if (audioRef.current) {
        audioRef.current.pause();
      }

      updateState({ currentSegmentIndex: nextIndex });
      loadSegmentAudio(nextIndex);

      if (wasPlaying) {
        // Wait for audio to be loaded before playing
        const tryPlay = () => {
          if (audioRef.current && audioRef.current.readyState >= 2) {
            audioRef.current.play().catch((err) => {
              console.error("Failed to play next segment:", err);
            });
          } else {
            setTimeout(tryPlay, 50);
          }
        };
        setTimeout(tryPlay, 50);
      }
    } else {
      // Playlist ended - stop playback
      if (audioRef.current) {
        audioRef.current.pause();
      }
      handlePlaylistEnd();
    }
  }, [loadSegmentAudio, updateState, handlePlaylistEnd]);

  // Load playlist with options
  const loadPlaylist = useCallback(
    (playlistData, options = {}) => {
      const {
        mode = "replace",
        autoPlay = false,
        clearQueue = false,
        position = "end",
      } = options;

      if (!playlistData || !playlistData.length) {
        console.warn("Empty playlist provided");
        return;
      }

      if (mode === "queue") {
        // Add to queue
        const newQueue = clearQueue ? [playlistData] : [...queueRef.current];

        if (position === "start") {
          newQueue.unshift(playlistData);
        } else if (typeof position === "number") {
          newQueue.splice(position, 0, playlistData);
        } else {
          newQueue.push(playlistData);
        }

        updateState({ queue: newQueue });
      } else {
        // Replace mode
        if (audioRef.current) {
          audioRef.current.pause();
        }

        const segmentMap = buildSegmentMap(playlistData);
        segmentMapRef.current = segmentMap;

        const totalDuration =
          segmentMap.length > 0
            ? segmentMap[segmentMap.length - 1].virtualEnd
            : 0;

        updateState({
          currentPlaylist: playlistData,
          currentSegmentIndex: 0,
          currentTime: 0,
          virtualTime: 0,
          totalDuration: totalDuration,
          isPlaying: false,
          isPaused: false,
          error: null,
          queue: clearQueue ? [] : state.queue,
        });

        // Load first segment
        if (segmentMap.length > 0) {
          loadSegmentAudio(0);

          if (autoPlay) {
            setTimeout(() => {
              play();
            }, 100);
          }
        }
      }
    },
    [state.queue, loadSegmentAudio, updateState, buildSegmentMap],
  );

  // Play
  const play = useCallback(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    audio
      .play()
      .then(() => {
        isPlayingRef.current = true;
        updateState({
          isPlaying: true,
          isPaused: false,
          error: null,
        });
      })
      .catch((err) => {
        console.error("Failed to play:", err);
        updateState({
          error: "Failed to play audio",
        });
      });
  }, [updateState]);

  // Pause
  const pause = useCallback(() => {
    if (!audioRef.current) return;

    audioRef.current.pause();
    isPlayingRef.current = false;
    updateState({
      isPlaying: false,
      isPaused: true,
    });
  }, [updateState]);

  // Stop
  const stop = useCallback(() => {
    if (!audioRef.current) return;

    audioRef.current.pause();
    isPlayingRef.current = false;

    // Reset to first segment
    const segmentMap = segmentMapRef.current;
    if (segmentMap.length > 0) {
      loadSegmentAudio(0);
    }

    updateState({
      isPlaying: false,
      isPaused: false,
      currentSegmentIndex: 0,
      currentTime: 0,
      virtualTime: 0,
    });
  }, [updateState, loadSegmentAudio]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [state.isPlaying, play, pause]);

  // Seek to virtual time in playlist
  const seekTo = useCallback(
    (virtualTime) => {
      if (!audioRef.current) return;

      const segmentMap = segmentMapRef.current;
      if (!segmentMap.length) return;

      const wasPlaying = isPlayingRef.current;

      // Find which segment contains this virtual time
      let targetSegment = null;
      let targetIndex = 0;

      for (let i = 0; i < segmentMap.length; i++) {
        const segment = segmentMap[i];
        if (
          virtualTime >= segment.virtualStart &&
          virtualTime <= segment.virtualEnd
        ) {
          targetSegment = segment;
          targetIndex = i;
          break;
        }
      }

      // If not found, clamp to boundaries
      if (!targetSegment) {
        if (virtualTime < 0) {
          targetSegment = segmentMap[0];
          targetIndex = 0;
        } else {
          targetSegment = segmentMap[segmentMap.length - 1];
          targetIndex = segmentMap.length - 1;
        }
      }

      if (!targetSegment) return;

      // Calculate offset within the segment
      const offsetInSegment = virtualTime - targetSegment.virtualStart;
      const needsSegmentChange = targetIndex !== currentSegmentRef.current;

      isSeekingRef.current = true;

      if (needsSegmentChange) {
        // Pause current audio before switching segments
        if (audioRef.current) {
          audioRef.current.pause();
        }

        updateState({
          currentSegmentIndex: targetIndex,
          virtualTime: virtualTime,
        });
        loadSegmentAudio(targetIndex, offsetInSegment);

        // Resume playback if it was playing
        if (wasPlaying) {
          const tryPlay = () => {
            if (audioRef.current && audioRef.current.readyState >= 2) {
              audioRef.current.play().catch((err) => {
                console.error("Failed to resume after seek:", err);
              });
            } else {
              setTimeout(tryPlay, 50);
            }
          };
          setTimeout(tryPlay, 100);
        }
      } else {
        // Same segment, just seek
        const realTime = targetSegment.startTimestamp + offsetInSegment;
        audioRef.current.currentTime = realTime;

        // Update virtual time immediately for paused state
        updateState({ virtualTime: virtualTime });
        virtualTimeRef.current = virtualTime;

        // Resume playback if it was playing
        if (wasPlaying && audioRef.current.paused) {
          audioRef.current.play().catch((err) => {
            console.error("Failed to resume after seek:", err);
          });
        }
      }

      setTimeout(() => {
        isSeekingRef.current = false;
      }, 200);
    },
    [updateState, loadSegmentAudio],
  );

  // Jump to specific segment
  const playSegment = useCallback(
    (index) => {
      const segmentMap = segmentMapRef.current;
      if (!segmentMap || index < 0 || index >= segmentMap.length) return;

      updateState({ currentSegmentIndex: index });
      loadSegmentAudio(index);

      if (state.isPlaying) {
        setTimeout(() => {
          play();
        }, 50);
      }
    },
    [state.isPlaying, loadSegmentAudio, play, updateState],
  );

  // Next segment
  const nextSegment = useCallback(() => {
    const playlist = state.currentPlaylist;
    const nextIndex = state.currentSegmentIndex + 1;

    if (!playlist || nextIndex >= playlist.length) return;

    playSegment(nextIndex);
  }, [state.currentPlaylist, state.currentSegmentIndex, playSegment]);

  // Previous segment
  const previousSegment = useCallback(() => {
    const prevIndex = state.currentSegmentIndex - 1;

    if (prevIndex < 0) return;

    playSegment(prevIndex);
  }, [state.currentSegmentIndex, playSegment]);

  // Set playback rate
  const setPlaybackRate = useCallback(
    (rate) => {
      if (rate < 0.25 || rate > 2.0) return;

      updateState({ playbackRate: rate });
    },
    [updateState],
  );

  // Clear queue
  const clearQueue = useCallback(() => {
    updateState({ queue: [] });
  }, [updateState]);

  // Remove from queue
  const removeFromQueue = useCallback(
    (index) => {
      const newQueue = [...state.queue];
      newQueue.splice(index, 1);
      updateState({ queue: newQueue });
    },
    [state.queue, updateState],
  );

  // Get current segment (enhanced with virtual timeline info)
  const getCurrentSegment = useCallback(() => {
    const segmentMap = segmentMapRef.current;
    const currentIndex = currentSegmentRef.current;

    if (!segmentMap.length || currentIndex >= segmentMap.length) {
      return null;
    }
    return segmentMap[currentIndex];
  }, []);

  // Get the full segment map (for displaying markers, etc.)
  const getSegmentMap = useCallback(() => {
    return segmentMapRef.current;
  }, []);

  // Get current verse playing based on timing data (uses REAL audio time)
  const getCurrentVerse = useCallback(() => {
    const segment = getCurrentSegment();
    if (!segment || !segment.timingData || !segment.timingData.timestamps) {
      return null;
    }

    const timestamps = segment.timingData.timestamps;
    const currentTime = audioRef.current?.currentTime || 0;

    // Parse the reference to get book, chapter, and verse info
    const refMatch = segment.reference.match(/^([A-Z0-9]+)\s+(\d+):(.+)$/i);
    if (!refMatch) return null;

    const book = refMatch[1];
    const chapter = refMatch[2];
    const verseSpec = refMatch[3];

    // Parse verse specification (e.g., "1-2" or "1,3,5" or "1")
    let verses = [];
    if (verseSpec.includes(",")) {
      // Multiple non-contiguous verses: "1,3,5"
      const parts = verseSpec.split(",");
      parts.forEach((part) => {
        if (part.includes("-")) {
          const [start, end] = part.trim().split("-").map(Number);
          for (let v = start; v <= end; v++) {
            verses.push(v);
          }
        } else {
          verses.push(Number(part.trim()));
        }
      });
    } else if (verseSpec.includes("-")) {
      // Range: "1-2"
      const [start, end] = verseSpec.split("-").map(Number);
      for (let v = start; v <= end; v++) {
        verses.push(v);
      }
    } else {
      // Single verse: "1"
      verses.push(Number(verseSpec));
    }

    // Find which verse is currently playing
    // timestamps array has start time for each verse, plus one final end time
    for (let i = 0; i < verses.length; i++) {
      const verseStart = timestamps[i];
      const verseEnd = timestamps[i + 1] || Infinity;

      if (currentTime >= verseStart && currentTime < verseEnd) {
        return `${book} ${chapter}:${verses[i]}`;
      }
    }

    // Default to first verse if before all timestamps
    if (currentTime < timestamps[0]) {
      return `${book} ${chapter}:${verses[0]}`;
    }

    // Default to last verse if after all timestamps
    return `${book} ${chapter}:${verses[verses.length - 1]}`;
  }, [getCurrentSegment]);

  // Toggle minimized state
  const toggleMinimized = useCallback(() => {
    updateState({ isMinimized: !state.isMinimized });
  }, [state.isMinimized, updateState]);

  // Set minimized state
  const setMinimized = useCallback(
    (minimized) => {
      updateState({ isMinimized: minimized });
    },
    [updateState],
  );

  const value = {
    ...state,
    loadPlaylist,
    play,
    pause,
    stop,
    togglePlayPause,
    seekTo,
    playSegment,
    nextSegment,
    previousSegment,
    setPlaybackRate,
    clearQueue,
    removeFromQueue,
    getCurrentSegment,
    getCurrentVerse,
    getSegmentMap,
    toggleMinimized,
    setMinimized,
  };

  return (
    <MediaPlayerContext.Provider value={value}>
      {children}
    </MediaPlayerContext.Provider>
  );
};

export default MediaPlayerContext;
