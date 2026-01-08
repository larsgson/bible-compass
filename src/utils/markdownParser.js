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
 * Extract specific verses from chapter verse array
 * @param {Array} verseArray - Array of verse objects with num and text
 * @param {number} verseStart - Start verse number (if range)
 * @param {number} verseEnd - End verse number (if range)
 * @param {Array} verses - Array of specific verse numbers (if comma-separated)
 */
const extractVerses = (verseArray, verseStart, verseEnd, verses = null) => {
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
 * Replace <<<REF>>> markers in text with actual Bible verses from cache
 */
const replaceBibleReferences = (text, chapterText) => {
  if (!text || !chapterText) return text;

  // Find all <<<REF: ...>>> markers in the text
  const refPattern = /<<<REF:\s*(.+?)>>>/g;
  let result = text;
  let match;
  let replacementCount = 0;

  while ((match = refPattern.exec(text)) !== null) {
    const fullMatch = match[0];
    const reference = match[1].trim();

    console.log(`[markdownParser] Found reference in text: ${reference}`);

    const parsed = parseReference(reference);
    if (!parsed) {
      console.log(`[markdownParser] ✗ Could not parse reference: ${reference}`);
      continue;
    }

    const { book, chapter, verseStart, verseEnd, verses } = parsed;
    const chapterKey = `${book}.${chapter}`;

    // Check if chapter is in cache
    if (chapterText[chapterKey]) {
      const extractedVerses = extractVerses(
        chapterText[chapterKey],
        verseStart,
        verseEnd,
        verses,
      );
      if (extractedVerses) {
        result = result.replace(fullMatch, extractedVerses);
        replacementCount++;
        console.log(
          `[markdownParser] ✓ Replaced ${reference} with ${extractedVerses.length} characters of Bible text`,
        );
      } else {
        console.log(
          `[markdownParser] ✗ Could not extract verses from ${chapterKey}`,
        );
      }
    } else {
      console.log(
        `[markdownParser] ✗ Chapter ${chapterKey} not in cache (available: ${Object.keys(chapterText).join(", ")})`,
      );
    }
  }

  if (replacementCount > 0) {
    console.log(`[markdownParser] Total replacements: ${replacementCount}`);
  }

  return result;
};

/**
 * Parse markdown content into structured sections
 * Each section contains an image URL and associated text content
 * @param {string} markdown - The markdown content to parse
 * @param {object} chapterText - Optional cache of loaded Bible chapters
 */
export const parseMarkdownIntoSections = (markdown, chapterText = {}) => {
  if (!markdown) {
    return { title: "", sections: [] };
  }

  console.log(
    `[markdownParser] Parsing markdown with ${Object.keys(chapterText).length} cached chapters:`,
    Object.keys(chapterText).join(", "),
  );

  const sections = [];
  const lines = markdown.split("\n");
  let currentSection = null;
  let storyTitle = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Extract story title (H1)
    if (line.startsWith("# ") && !storyTitle) {
      storyTitle = line.substring(2).trim();
      continue;
    }

    // Skip story markers
    if (line.startsWith("<<<STORY:")) {
      continue;
    }

    // Extract reference (<<<REF: GEN 1:1-2>>>)
    if (line.startsWith("<<<REF:")) {
      const refMatch = line.match(/<<<REF:\s*(.+?)>>>/);
      if (refMatch && currentSection) {
        currentSection.reference = refMatch[1].trim();
      }
      continue;
    }

    // Check if line contains an image
    const imageMatch = line.match(/!\[.*?\]\((.*?)\)/);
    if (imageMatch) {
      // Save previous section if exists (even if no text content)
      if (currentSection) {
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        imageUrl: imageMatch[1],
        text: "",
        reference: "",
      };
    } else if (currentSection && line) {
      // Add text to current section
      currentSection.text += (currentSection.text ? "\n" : "") + line;
    }
  }

  // Add last section (even if no text content)
  if (currentSection) {
    sections.push(currentSection);
  }

  // Replace <<<REF>>> markers in section text with actual Bible verses
  sections.forEach((section) => {
    if (section.text) {
      section.text = replaceBibleReferences(section.text, chapterText);
    }
  });

  return {
    title: storyTitle,
    sections: sections,
  };
};

/**
 * Extract title from markdown content
 */
export const getTitleFromMarkdown = (markdown) => {
  if (!markdown || markdown.length === 0) {
    return "";
  }

  // Try to find H1 header
  const regExpr = /#[\s|\d|\.]*(.*)\n/;
  const found = markdown.match(regExpr);
  if (found?.[1]) {
    return found[1];
  }

  // Try without number ID string
  const regExpr2 = /#\s*(\S.*)\n/;
  const found2 = markdown.match(regExpr2);
  if (found2?.[1]) {
    return found2[1];
  }

  // Try any non-empty line
  const regExpr3 = /\s*(\S.*)\n/;
  const found3 = markdown.match(regExpr3);
  if (found3?.[1]) {
    return found3[1];
  }

  // Last resort
  const regExpr4 = /.*(\w.*)\n/;
  const found4 = markdown.match(regExpr4);
  return found4?.[1] || "";
};
