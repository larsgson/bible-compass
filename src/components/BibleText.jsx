import { useEffect, useState, useRef } from "react";
import useLanguage from "../hooks/useLanguage";
import {
  parseReference,
  extractVerses,
  getTestament,
} from "../utils/bibleUtils";

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
