import { useEffect, useState, useRef } from "react";
import useLanguage from "../hooks/useLanguage";

/**
 * Parse a Bible reference string into book, chapter, and verse range
 * Examples: "GEN 1:1-5", "MAT 5:3", "REV 21:1-4", "GEN 1:20,22" (comma = non-consecutive verses)
 */
const parseReference = (reference) => {
  if (!reference) return null;

  // Match pattern: BOOK CHAPTER:VERSES where VERSES can be "1", "1-5", or "1,3,5"
  const match = reference.match(/^([A-Z0-9]+)\s+(\d+):(.+)$/i);
  if (!match) return null;

  const book = match[1].toUpperCase();
  const chapter = parseInt(match[2], 10);
  const versePart = match[3];

  // Check if it's comma-separated (individual verses)
  if (versePart.includes(",")) {
    const verses = versePart.split(",").map((v) => parseInt(v.trim(), 10));
    return {
      book,
      chapter,
      verses, // Array of specific verse numbers
    };
  }

  // Check if it's a range (e.g., "1-5")
  if (versePart.includes("-")) {
    const [start, end] = versePart
      .split("-")
      .map((v) => parseInt(v.trim(), 10));
    return {
      book,
      chapter,
      verseStart: start,
      verseEnd: end,
    };
  }

  // Single verse
  const verse = parseInt(versePart, 10);
  return {
    book,
    chapter,
    verseStart: verse,
    verseEnd: verse,
  };
};

/**
 * Determine testament from book code
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
 * Extract specific verses from chapter verse array
 * @param {Array} verseArray - Array of verse objects with num and text
 * @param {number} verseStart - Start verse number (if range)
 * @param {number} verseEnd - End verse number (if range)
 * @param {Array} verses - Array of specific verse numbers (if comma-separated)
 */
const extractVerses = (verseArray, verseStart, verseEnd, verses = null) => {
  if (!verseArray) return null;

  // If it's a string (old format), return it as-is
  if (typeof verseArray === "string") return verseArray;

  // If it's an array (new format from DBT API)
  if (Array.isArray(verseArray)) {
    let selectedVerses;

    // Handle comma-separated verses (specific verse numbers)
    if (verses && Array.isArray(verses)) {
      selectedVerses = verseArray.filter((v) => verses.includes(v.num));
    } else {
      // Handle range
      selectedVerses = verseArray.filter(
        (v) => v.num >= verseStart && v.num <= verseEnd,
      );
    }

    if (selectedVerses.length === 0) return null;

    // Format without verse numbers
    return selectedVerses
      .map((v) => v.text)
      .join(" ")
      .trim();
  }

  return null;
};

function BibleText({ reference, className = "" }) {
  const {
    loadChapter,
    chapterText,
    isLoadingChapter,
    languageData,
    selectedLanguage,
  } = useLanguage();
  const [displayText, setDisplayText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const textLoadAttemptedRef = useRef(new Set());

  useEffect(() => {
    const fetchBibleText = async () => {
      if (!reference) {
        setDisplayText("");
        setBookRef("");
        setChapterRef("");
        return;
      }

      const parsed = parseReference(reference);
      if (!parsed) {
        setError("Invalid reference format");
        setBookRef("");
        setChapterRef("");
        return;
      }

      const { book, chapter, verseStart, verseEnd, verses } = parsed;
      const testament = getTestament(book);
      const chapterKey = `${book}.${chapter}`;

      // Early detection: Check if testament data is available
      if (selectedLanguage && languageData && languageData[selectedLanguage]) {
        const langData = languageData[selectedLanguage][testament];
        if (!langData) {
          setDisplayText("");
          setError(null);
          setLoading(false);
          return;
        }
      }

      // Check if already cached
      if (chapterText[chapterKey]) {
        const extractedVerses = extractVerses(
          chapterText[chapterKey],
          verseStart,
          verseEnd,
          verses,
        );
        if (extractedVerses) {
          setDisplayText(extractedVerses);
        } else {
          setDisplayText("");
        }
        setError(null);
        return;
      }

      // Only attempt to load text once per chapter
      if (!textLoadAttemptedRef.current.has(chapterKey)) {
        textLoadAttemptedRef.current.add(chapterKey);
        setLoading(true);
        setError(null);

        try {
          const verseArray = await loadChapter(book, chapter, testament);
          if (verseArray) {
            const extractedVerses = extractVerses(
              verseArray,
              verseStart,
              verseEnd,
              verses,
            );
            setDisplayText(extractedVerses || "");
          } else {
            setError("Could not load Bible text");
          }
        } catch (err) {
          setError("Error loading Bible text");
        } finally {
          setLoading(false);
        }
      }
    };

    fetchBibleText();
  }, [reference, loadChapter, chapterText, selectedLanguage]);

  if (!reference) {
    return null;
  }

  if (loading || isLoadingChapter) {
    return (
      <div className={`bible-text loading ${className}`}>
        Loading {reference}...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bible-text error ${className}`}>
        <span className="bible-reference">{reference}</span>
      </div>
    );
  }

  return (
    <div className={`bible-text ${className}`}>
      {displayText && <div className="bible-text-content">{displayText}</div>}
      {!displayText && <span className="bible-reference">{reference}</span>}
    </div>
  );
}

export default BibleText;
