/**
 * Shared utilities for Bible reference parsing and verse extraction
 */

/**
 * Determine testament from book code
 * @param {string} bookCode - The book code (e.g., "MAT", "GEN")
 * @returns {string} "nt" or "ot"
 */
export const getTestament = (bookCode) => {
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
 * Parse a Bible reference string into book, chapter, and verse range
 * Examples: "GEN 1:1-5", "MAT 5:3", "REV 21:1-4", "GEN 1:20,22" (comma = non-consecutive verses)
 * @param {string} reference - The Bible reference string
 * @returns {Object|null} Parsed reference object or null if invalid
 */
export const parseReference = (reference) => {
  if (!reference) return null;

  // Match pattern: BOOK CHAPTER:VERSES where VERSES can be "1", "1-5", or "1,3,5"
  const match = reference.match(/^([A-Z0-9]+)\s+(\d+):(.+)$/i);
  if (!match) {
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
 * Extract specific verses from chapter verse array
 * @param {Array|string} verseArray - Array of verse objects with num and text, or string (old format)
 * @param {number} verseStart - Start verse number (if range)
 * @param {number} verseEnd - End verse number (if range)
 * @param {Array} verses - Array of specific verse numbers (if comma-separated)
 * @returns {string|null} Extracted verse text or null
 */
export const extractVerses = (
  verseArray,
  verseStart,
  verseEnd,
  verses = null,
) => {
  if (!verseArray) return null;

  // If it's a string (old format), return it as-is
  if (typeof verseArray === "string") {
    return verseArray;
  }

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

    if (selectedVerses.length === 0) {
      return null;
    }

    // Format without verse numbers
    return selectedVerses
      .map((v) => v.text)
      .join(" ")
      .trim();
  }

  return null;
};

/**
 * Extract Bible text for a given reference from the chapterText cache
 * @param {string} reference - Bible reference (e.g., "MAT 1:18-19")
 * @param {Object} chapterText - Cache of loaded chapters
 * @returns {string|null} Extracted text or null
 */
export const getTextForReference = (reference, chapterText) => {
  if (!reference || !chapterText) return null;

  const parsed = parseReference(reference);
  if (!parsed) return null;

  const { book, chapter, verseStart, verseEnd, verses } = parsed;
  const chapterKey = `${book}.${chapter}`;

  if (!chapterText[chapterKey]) {
    return null;
  }

  const extractedVerses = extractVerses(
    chapterText[chapterKey],
    verseStart,
    verseEnd,
    verses,
  );

  return extractedVerses;
};
