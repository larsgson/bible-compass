import React, { useState, useEffect } from "react";
import "./StoryViewer.css";
import BibleText from "./BibleText";
import { parseMarkdownIntoSections } from "../utils/markdownParser";
import useLanguage from "../hooks/useLanguage";

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
 * Parse a reference to extract book, chapter, verse info
 */
const parseReference = (reference) => {
  if (!reference) return null;

  const match = reference.match(/^([A-Z0-9]+)\s+(\d+):(.+)$/i);
  if (!match) return null;

  const book = match[1].toUpperCase();
  const chapter = parseInt(match[2], 10);
  const versePart = match[3];

  if (versePart.includes(",")) {
    const verses = versePart.split(",").map((v) => parseInt(v.trim(), 10));
    return { book, chapter, verses };
  }

  if (versePart.includes("-")) {
    const [start, end] = versePart
      .split("-")
      .map((v) => parseInt(v.trim(), 10));
    return { book, chapter, verseStart: start, verseEnd: end };
  }

  const verse = parseInt(versePart, 10);
  return { book, chapter, verseStart: verse, verseEnd: verse };
};

/**
 * Get testament from book code
 */
const getTestament = (bookCode) => {
  const ntBooks = [
    "MAT",
    "MRK",
    "LUK",
    "JHN",
    "ACT",
    "ROM",
    "1CO",
    "2CO",
    "GAL",
    "EPH",
    "PHP",
    "COL",
    "1TH",
    "2TH",
    "1TI",
    "2TI",
    "TIT",
    "PHM",
    "HEB",
    "JAS",
    "1PE",
    "2PE",
    "1JN",
    "2JN",
    "3JN",
    "JUD",
    "REV",
  ];
  return ntBooks.includes(bookCode.toUpperCase()) ? "nt" : "ot";
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
        refs.forEach(({ ref, sectionNum }) => {
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

  if (loading) {
    return <div className="story-loading">Loading story...</div>;
  }

  // Error state - story not found
  if (error) {
    return (
      <div className="story-viewer">
        <div className="story-header">
          <button className="back-button" onClick={onBack}>
            ← Back to Stories
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
            ← Back to Stories
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
          ← Back to Stories
        </button>
        <h1 className="story-title">{parsedData.title || storyData.title}</h1>
      </div>
      <div className="story-content story-sections-vertical">
        {/* Display consolidated audio playlist data before sections */}
        {audioPlaylistData.length > 0 &&
          (() => {
            // Group entries by audio URL
            const groupedByAudio = [];
            let currentGroup = null;

            audioPlaylistData.forEach((entry) => {
              if (!currentGroup || currentGroup.audioUrl !== entry.audioUrl) {
                // Start new group
                currentGroup = {
                  audioUrl: entry.audioUrl,
                  audioFile: entry.audioFile,
                  entries: [],
                };
                groupedByAudio.push(currentGroup);
              }
              currentGroup.entries.push(entry);
            });

            return (
              <div
                className="audio-playlist-info"
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.85em",
                  padding: "1em",
                  backgroundColor: "#f5f5f5",
                  marginBottom: "2em",
                  borderRadius: "4px",
                  whiteSpace: "pre-wrap",
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    marginBottom: "1em",
                    fontSize: "1.1em",
                  }}
                >
                  Audio Playlist Data (Grouped by Audio File):
                </div>
                {groupedByAudio.map((group, groupIndex) => (
                  <div key={groupIndex} style={{ marginBottom: "2em" }}>
                    <div
                      style={{
                        color: "#cc0066",
                        fontWeight: "bold",
                        marginBottom: "0.5em",
                        borderBottom: "2px solid #cc0066",
                        paddingBottom: "0.3em",
                      }}
                    >
                      Audio: {group.audioFile}
                    </div>
                    {group.entries.map((entry, entryIndex) => (
                      <div
                        key={entryIndex}
                        style={{ marginBottom: "1.5em", paddingLeft: "1em" }}
                      >
                        <div
                          style={{
                            color: "#0066cc",
                            fontWeight: "bold",
                            marginBottom: "0.3em",
                          }}
                        >
                          Section {entry.sectionNum} - {entry.reference}
                        </div>
                        {entry.timingData ? (
                          <div style={{ color: "#333" }}>
                            {JSON.stringify(entry.timingData, null, 2)}
                          </div>
                        ) : (
                          <div style={{ color: "#999", fontStyle: "italic" }}>
                            (No timing data available)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })()}

        {parsedData.sections.map((section, index) => (
          <div key={index} className="story-section">
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
            {section.reference && (
              <BibleText
                reference={section.reference}
                className="story-reference-main"
              />
            )}
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
        ))}
      </div>
    </div>
  );
}

export default StoryViewer;
