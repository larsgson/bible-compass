import { useEffect, useState, useRef } from "react";
import useLanguage from "../hooks/useLanguage";

// Track which testament warnings we've already shown
const testamentWarningsShown = new Set();

/**
 * Parse a Bible reference string into book, chapter, and verse range
 * Examples: "GEN 1:1-5", "MAT 5:3", "REV 21:1-4", "GEN 1:20,22" (comma = non-consecutive verses)
 */
const parseReference = (reference) => {
  if (!reference) return null;

  // Match pattern: BOOK CHAPTER:VERSES where VERSES can be "1", "1-5", or "1,3,5"
  const match = reference.match(/^([A-Z0-9]+)\s+(\d+):(.+)$/i);
  if (!match) {
    console.log(`[parseReference] ✗ Failed to match pattern for: ${reference}`);
    return null;
  }

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
  if (!verseArray) {
    console.log(`[extractVerses] ✗ verseArray is null/undefined`);
    return null;
  }

  // If it's a string (old format), return it as-is
  if (typeof verseArray === "string") {
    console.log(
      `[extractVerses] Got string format, returning as-is (${verseArray.length} chars)`,
    );
    return verseArray;
  }

  // If it's an array (new format from DBT API)
  if (Array.isArray(verseArray)) {
    let selectedVerses;

    // Handle comma-separated verses (specific verse numbers)
    if (verses && Array.isArray(verses)) {
      console.log(
        `[extractVerses] Processing array with ${verseArray.length} verses, looking for specific verses: ${verses.join(", ")}`,
      );
      selectedVerses = verseArray.filter((v) => verses.includes(v.num));
    } else {
      // Handle range
      console.log(
        `[extractVerses] Processing array with ${verseArray.length} verses, looking for verses ${verseStart}-${verseEnd}`,
      );
      selectedVerses = verseArray.filter(
        (v) => v.num >= verseStart && v.num <= verseEnd,
      );
    }

    console.log(`[extractVerses] Found ${selectedVerses.length} verses`);

    if (selectedVerses.length === 0) {
      console.log(`[extractVerses] ✗ No verses found`);
      return null;
    }

    // Format without verse numbers
    const result = selectedVerses
      .map((v) => v.text)
      .join(" ")
      .trim();

    console.log(
      `[extractVerses] ✓ Formatted result: ${result.length} characters`,
    );
    return result;
  }

  console.log(`[extractVerses] ✗ Unknown format:`, typeof verseArray);
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
  const [bookRef, setBookRef] = useState("");
  const [chapterRef, setChapterRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const warningKeyRef = useRef(null);
  const textLoadAttemptedRef = useRef(new Set()); // Track attempted text loads

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
      setBookRef(book);
      setChapterRef(chapter);
      const testament = getTestament(book);
      const chapterKey = `${book}.${chapter}`;

      // Early detection: Check if testament data is available
      if (selectedLanguage && languageData && languageData[selectedLanguage]) {
        const langData = languageData[selectedLanguage][testament];
        if (!langData) {
          // Show warning once per language-testament combination
          const warningKey = `${selectedLanguage}-${testament}`;
          if (!testamentWarningsShown.has(warningKey)) {
            console.log(
              `[BibleText] ⚠️ No ${testament.toUpperCase()} data available for language "${selectedLanguage}" - verses will be empty`,
            );
            testamentWarningsShown.add(warningKey);
          }
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
            if (extractedVerses) {
              setDisplayText(extractedVerses);
            } else {
              setDisplayText("");
            }
          } else {
            console.log(`[BibleText] ✗ API returned null for ${chapterKey}`);
            setError("Could not load Bible text");
          }
        } catch (err) {
          console.log(`[BibleText] ✗ Error loading ${chapterKey}:`, err);
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
