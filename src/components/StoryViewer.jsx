import React, { useState, useEffect } from "react";
import "./StoryViewer.css";
import BibleText from "./BibleText";
import { parseMarkdownIntoSections } from "../utils/markdownParser";
import { parseReference, getTestament } from "../utils/bibleUtils";
import useLanguage from "../hooks/useLanguage";
import useMediaPlayer from "../hooks/useMediaPlayer";
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
  const { chapterText, audioUrls, loadAudioUrl, selectedLanguage } =
    useLanguage();
  const { loadPlaylist, isMinimized, currentSegmentIndex, currentPlaylist } =
    useMediaPlayer();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);
  const [chapterCount, setChapterCount] = useState(0);
  const [audioPlaylistData, setAudioPlaylistData] = useState([]);

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

      // Collect and process all references for audio playlist
      if (parsed && parsed.sections && parsed.sections.length > 0) {
        collectAudioPlaylistData(parsed.sections);
      }

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

  // Re-collect audio playlist when sections change or audio becomes available
  useEffect(() => {
    if (parsedData && parsedData.sections && parsedData.sections.length > 0) {
      collectAudioPlaylistData(parsedData.sections);
    }
  }, [parsedData, audioUrls, selectedLanguage]);

  // Load playlist and auto-play when audio data is ready
  useEffect(() => {
    if (audioPlaylistData && audioPlaylistData.length > 0) {
      loadPlaylist(audioPlaylistData, { mode: "replace", autoPlay: true });
    }
  }, [audioPlaylistData, loadPlaylist]);

  if (loading) {
    return <div className="story-loading">Loading story...</div>;
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
            <h2>Story Not Available</h2>
            <p>This story content has not been added to the collection yet.</p>
            <p className="story-error-detail">
              Please check back later or select another story.
            </p>
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
          <p>No sections available</p>
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
        // FULL PLAYER MODE - show only playing pane
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

      {/* Audio Player - show full or minimized based on state */}
      {currentPlaylist &&
        currentPlaylist.length > 0 &&
        (isMinimized ? <MinimizedAudioPlayer /> : <AudioPlayer />)}
    </div>
  );
}

export default StoryViewer;
