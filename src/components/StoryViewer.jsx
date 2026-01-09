import React, { useState, useEffect } from "react";
import "./StoryViewer.css";
import BibleText from "./BibleText";
import { parseMarkdownIntoSections } from "../utils/markdownParser";
import { parseReference, getTestament } from "../utils/bibleUtils";
import useLanguage from "../hooks/useLanguage";
import useMediaPlayer from "../hooks/useMediaPlayer";
import useTranslation from "../hooks/useTranslation";
import AudioPlayer from "./AudioPlayer";
import MinimizedAudioPlayer from "./MinimizedAudioPlayer";
import FullPlayingPane from "./FullPlayingPane";

/**
 * Split a complex reference into individual reference parts
 */
const splitReference = (reference) => {
  if (!reference) return [];

  const parts = reference.split(",").map((p) => p.trim());
  const results = [];

  let currentBook = null;
  let currentChapter = null;

  parts.forEach((part) => {
    const bookMatch = part.match(/^([A-Z0-9]+)\s*(\d+):(.+)$/i);

    if (bookMatch) {
      currentBook = bookMatch[1].toUpperCase();
      currentChapter = bookMatch[2];
      const verses = bookMatch[3];
      results.push(`${currentBook} ${currentChapter}:${verses}`);
    } else {
      const chapterMatch = part.match(/^(\d+):(.+)$/);

      if (chapterMatch) {
        currentChapter = chapterMatch[1];
        const verses = chapterMatch[2];
        results.push(`${currentBook} ${currentChapter}:${verses}`);
      } else {
        results.push(`${currentBook} ${currentChapter}:${part}`);
      }
    }
  });

  return results;
};

/**
 * Extract raw timing data for a specific reference
 */
const extractRawTimingData = (
  timingData,
  audioFilesetId,
  bookId,
  chapterNum,
  verseSpec,
) => {
  if (!timingData || !audioFilesetId || !timingData[audioFilesetId]) {
    return null;
  }

  const filesetData = timingData[audioFilesetId];
  const searchRef = `${bookId}${chapterNum}:${verseSpec}`;

  for (const [storyNum, storyData] of Object.entries(filesetData)) {
    if (storyData[searchRef]) {
      return {
        reference: searchRef,
        timestamps: storyData[searchRef],
      };
    }
  }

  return null;
};

function StoryViewer({ storyData, onBack }) {
  const { t } = useTranslation();
  const {
    chapterText,
    audioUrls,
    loadAudioUrl,
    selectedLanguage,
    languageData,
    getStoryMetadata,
  } = useLanguage();
  const { loadPlaylist, isMinimized, currentSegmentIndex, currentPlaylist } =
    useMediaPlayer();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);
  const [chapterCount, setChapterCount] = useState(0);
  const [audioPlaylistData, setAudioPlaylistData] = useState([]);
  const [storyCapabilities, setStoryCapabilities] = useState({
    hasTimecode: false,
    usesOT: false,
    usesNT: false,
  });

  useEffect(() => {
    loadStory();
  }, [storyData]);

  // Reparse when chapter count changes (not on every chapterText update)
  useEffect(() => {
    const newCount = Object.keys(chapterText).length;
    if (content && newCount > 0 && newCount !== chapterCount) {
      const parsed = parseMarkdownIntoSections(content, chapterText);
      setParsedData(parsed);
      setChapterCount(newCount);
    }
  }, [chapterText]);

  const loadStory = async () => {
    setLoading(true);
    try {
      // Always load and parse (browser caches markdown, parsing is fast)
      const response = await fetch(`/templates/OBS/${storyData.path}`);

      if (!response.ok) {
        throw new Error(`Story not found: ${response.status}`);
      }

      const text = await response.text();

      // Check if we got HTML instead of markdown (happens with 404 pages)
      if (
        text.trim().startsWith("<!doctype") ||
        text.trim().startsWith("<!DOCTYPE")
      ) {
        throw new Error("Story file not found or returned HTML");
      }

      setContent(text);

      // Parse content into sections, passing chapter text cache for Bible text replacement
      const parsed = parseMarkdownIntoSections(text, chapterText);
      setParsedData(parsed);
      setChapterCount(Object.keys(chapterText).length);

      setError(null);
    } catch (err) {
      setContent("");
      setParsedData(null);
      setError(err.message);
    }
    setLoading(false);
  };

  const collectAudioPlaylistData = async (sections) => {
    const allPlaylistEntries = [];
    const chaptersNeeded = new Map();

    // First pass: collect all references with section tracking
    sections.forEach((section, sectionIndex) => {
      if (!section.reference) return;

      const splitRefs = splitReference(section.reference);

      splitRefs.forEach((ref) => {
        const parsed = parseReference(ref);
        if (parsed) {
          const { book, chapter } = parsed;
          const testament = getTestament(book);
          const chapterKey = `${book}.${chapter}`;
          const audioKey = `${selectedLanguage}-${testament}-${chapterKey}`;

          if (!chaptersNeeded.has(audioKey)) {
            chaptersNeeded.set(audioKey, {
              book,
              chapter,
              testament,
              audioKey,
              refs: [],
            });
          }

          chaptersNeeded.get(audioKey).refs.push({
            ref,
            sectionNum: sectionIndex + 1,
            imageUrl: section.imageUrl,
            text: section.text,
          });
        }
      });
    });

    // Second pass: load audio for all needed chapters
    for (const [audioKey, chapterInfo] of chaptersNeeded.entries()) {
      const { book, chapter, testament, refs } = chapterInfo;

      // Check if already cached
      let audioEntry = audioUrls[audioKey];

      // If not cached, try to load
      if (!audioEntry) {
        try {
          audioEntry = await loadAudioUrl(book, chapter, testament);
        } catch (err) {
          console.log(`Failed to load audio for ${audioKey}`);
        }
      }

      if (audioEntry && audioEntry.url) {
        const fullFilename = audioEntry.url.substring(
          audioEntry.url.lastIndexOf("/") + 1,
        );
        const filename = fullFilename.split("?")[0];

        // Process each reference for this chapter
        refs.forEach(({ ref, sectionNum, imageUrl, text }) => {
          const parsed = parseReference(ref);
          if (!parsed) return;

          const {
            book: refBook,
            chapter: refChapter,
            verseStart,
            verseEnd,
            verses,
          } = parsed;

          let verseSpec;
          if (verses && Array.isArray(verses)) {
            verseSpec = verses.join(",");
          } else if (verseStart === verseEnd) {
            verseSpec = String(verseStart);
          } else {
            verseSpec = `${verseStart}-${verseEnd}`;
          }

          // Extract timing data for this specific reference
          let timingEntry = null;
          if (audioEntry.hasTimecode && audioEntry.timingData) {
            const audioFilesetId =
              audioEntry.audioFilesetId ||
              Object.keys(audioEntry.timingData)[0];

            timingEntry = extractRawTimingData(
              audioEntry.timingData,
              audioFilesetId,
              refBook,
              refChapter,
              verseSpec,
            );
          }

          allPlaylistEntries.push({
            sectionNum,
            reference: ref,
            audioFile: filename,
            audioUrl: audioEntry.url,
            timingData: timingEntry,
            book: refBook,
            chapter: refChapter,
            testament,
            imageUrl,
            text,
          });
        });
      }
    }

    setAudioPlaylistData(allPlaylistEntries);
  };

  // Analyze what features are available for this story based on its references
  const analyzeStoryCapabilities = (sections) => {
    // Try to get cached testament analysis first (lightweight metadata)
    const storyId = storyData.id || storyData.path;
    const cachedMetadata = getStoryMetadata(storyId);

    // Get testament info from pre-cached metadata
    const testamentsInfo = cachedMetadata?.testaments || {
      usesOT: true,
      usesNT: true,
    };

    const langData = languageData[selectedLanguage];
    if (!langData) {
      setStoryCapabilities({
        hasTimecode: false,
        usesOT: testamentsInfo.usesOT,
        usesNT: testamentsInfo.usesNT,
      });
      return;
    }

    // Check if ALL required testaments have audio with timecode
    // Audio player requires timecode to build playlist
    let hasTimecode = true;
    const testamentsToCheck = [];
    if (testamentsInfo.usesOT) testamentsToCheck.push("ot");
    if (testamentsInfo.usesNT) testamentsToCheck.push("nt");

    for (const testament of testamentsToCheck) {
      const testamentData = langData[testament];

      if (!testamentData) {
        hasTimecode = false;
        break;
      }

      // Check audio availability
      if (!testamentData.audioFilesetId) {
        hasTimecode = false;
        break;
      }

      // Check timecode availability - required for playlist
      const hasTimecodeForTestament = [
        "with-timecode",
        "audio-with-timecode",
      ].includes(testamentData.audioCategory);

      if (!hasTimecodeForTestament) {
        hasTimecode = false;
        break;
      }
    }

    const capabilities = {
      hasTimecode,
      usesOT: testamentsInfo.usesOT,
      usesNT: testamentsInfo.usesNT,
    };

    setStoryCapabilities(capabilities);
  };

  // Analyze story capabilities when parsed data or language data changes
  useEffect(() => {
    if (
      parsedData &&
      parsedData.sections &&
      parsedData.sections.length > 0 &&
      selectedLanguage &&
      languageData &&
      languageData[selectedLanguage]
    ) {
      analyzeStoryCapabilities(parsedData.sections);
    }
  }, [parsedData, selectedLanguage, languageData]);

  // Re-collect audio playlist when sections change or timecode becomes available
  useEffect(() => {
    if (
      parsedData &&
      parsedData.sections &&
      parsedData.sections.length > 0 &&
      storyCapabilities.hasTimecode
    ) {
      collectAudioPlaylistData(parsedData.sections);
    } else if (!storyCapabilities.hasTimecode) {
      // Clear playlist if timecode is not available
      setAudioPlaylistData([]);
    }
  }, [parsedData, audioUrls, selectedLanguage, storyCapabilities.hasTimecode]);

  // Load playlist and auto-play when audio data is ready (only if timecode available)
  useEffect(() => {
    if (audioPlaylistData.length > 0 && storyCapabilities.hasTimecode) {
      loadPlaylist(audioPlaylistData, { mode: "replace", autoPlay: true });
    }
  }, [audioPlaylistData, loadPlaylist, storyCapabilities.hasTimecode]);

  // Separate effect to clear playlist when timecode becomes unavailable
  useEffect(() => {
    if (
      !storyCapabilities.hasTimecode &&
      currentPlaylist &&
      currentPlaylist.length > 0
    ) {
      loadPlaylist([], { mode: "replace", autoPlay: false });
    }
  }, [storyCapabilities.hasTimecode, currentPlaylist, loadPlaylist]);

  if (loading) {
    return <div className="story-loading">{t("storyViewer.loadingStory")}</div>;
  }

  // Error state - story not found
  if (error) {
    return (
      <div className="story-viewer">
        <div className="story-header">
          <button className="back-button" onClick={onBack}>
            ←
          </button>
          <h1 className="story-title">{storyData.title}</h1>
        </div>
        <div className="story-hero-image">
          <img
            src={storyData.image || "/navIcons/000-01.png"}
            alt={storyData.title}
            onError={(e) => {
              e.target.src = "/navIcons/000-01.png";
            }}
          />
        </div>
        <div className="story-content">
          <div className="story-error">
            <h2>{t("storyViewer.errorTitle")}</h2>
            <p>{t("storyViewer.errorMessage")}</p>
            <p className="story-error-detail">{t("storyViewer.errorDetail")}</p>
          </div>
        </div>
      </div>
    );
  }

  // Display sections
  if (!parsedData || !parsedData.sections || parsedData.sections.length === 0) {
    return (
      <div className="story-viewer">
        <div className="story-header">
          <button className="back-button" onClick={onBack}>
            ←
          </button>
          <h1 className="story-title">{storyData.title}</h1>
        </div>
        <div className="story-content">
          <p>{t("storyViewer.noSections")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="story-viewer">
      <div className="story-header">
        <button className="back-button" onClick={onBack}>
          ←
        </button>
        <h1 className="story-title">{parsedData.title || storyData.title}</h1>
      </div>

      {/* Conditional rendering based on player state */}
      {!isMinimized && currentPlaylist && currentPlaylist.length > 0 ? (
        // FULL PLAYER MODE - show only playing pane (requires timecode to have playlist)
        <div className="story-content story-content-full-player">
          <FullPlayingPane />
        </div>
      ) : (
        // DEFAULT MODE - show all story sections
        <div className="story-content story-sections-vertical">
          {parsedData.sections.map((section, index) => {
            // Check if this section is currently playing
            const isPlaying =
              currentPlaylist &&
              currentPlaylist.length > 0 &&
              currentSegmentIndex >= 0 &&
              currentPlaylist[currentSegmentIndex]?.sectionNum === index + 1;

            return (
              <div
                key={index}
                className={`story-section ${isPlaying ? "story-section-playing" : ""}`}
              >
                <div className="story-section-image-wrapper">
                  {section.imageUrl && (
                    <img
                      src={section.imageUrl}
                      alt={`Section ${index + 1}`}
                      className="story-image"
                    />
                  )}
                  {section.reference && (
                    <div className="story-section-ref-overlay">
                      {section.reference}
                    </div>
                  )}
                </div>
                {section.text && section.text.trim() && (
                  <div className="story-section-text">
                    {section.text.split("\n").map((line, lineIndex) => {
                      const trimmedLine = line.trim();
                      if (!trimmedLine) return null;
                      return (
                        <p key={lineIndex} className="story-paragraph">
                          {trimmedLine}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Audio Player - show full or minimized based on state (requires timecode) */}
      {currentPlaylist &&
        currentPlaylist.length > 0 &&
        (isMinimized ? <MinimizedAudioPlayer /> : <AudioPlayer />)}
    </div>
  );
}

export default StoryViewer;
