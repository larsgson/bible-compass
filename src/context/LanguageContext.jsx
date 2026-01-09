import React, { useState, useEffect, useCallback, useRef } from "react";

const LanguageContext = React.createContext([{}, () => {}]);

// Priority-ordered list of language filesets to probe
// Note: Proxy auto-adds _ET suffix for type=text, so these are base IDs
const ENGLISH_FILESET_CANDIDATES = {
  nt: [
    "ENGESVN", // English Standard Version NT - text
  ],
  ot: [
    "ENGESVO", // English Standard Version OT - text
  ],
};

const FRENCH_FILESET_CANDIDATES = {
  nt: [
    "FRNTLS", // French Louis Segond NT - text
    "FRNLSV", // French La Sainte Bible NT - text
  ],
  ot: [
    "FRNTLS", // French Louis Segond OT - text
    "FRNLSV", // French La Sainte Bible OT - text
    "FRNDBY", // French Darby OT - text
  ],
};

const LanguageProvider = ({ children, initialLanguage = "fra" }) => {
  // Helper function to parse TOML files
  const parseToml = (text) => {
    const lines = text.split("\n");
    const result = { stories: [] };
    let currentStory = null;
    let inImage = false;
    let inArray = false;
    let arrayKey = null;
    let arrayValues = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      if (line.startsWith("#") || line === "") continue;

      // Check for section headers
      if (line.startsWith("[") && line.endsWith("]")) {
        if (line === "[image]") {
          inImage = true;
          result.image = {};
          continue;
        }

        if (line === "[[stories]]") {
          if (currentStory) {
            result.stories.push(currentStory);
          }
          currentStory = {};
          inImage = false;
          continue;
        }

        // Reset section flags for other sections
        inImage = false;
        continue;
      }

      // Check if this is the start of a multi-line array
      if (line.match(/^(\w+)\s*=\s*\[$/)) {
        const match = line.match(/^(\w+)\s*=\s*\[$/);
        arrayKey = match[1];
        inArray = true;
        arrayValues = [];
        continue;
      }

      // Check if this is the end of a multi-line array
      if (inArray && line === "]") {
        result[arrayKey] = arrayValues;
        inArray = false;
        arrayKey = null;
        arrayValues = [];
        continue;
      }

      // Check if we're inside a multi-line array
      if (inArray) {
        let cleanValue = line.replace(/,$/g, ""); // Remove trailing comma
        cleanValue = cleanValue.replace(/^"/, "").replace(/"$/, ""); // Remove quotes
        if (cleanValue) {
          arrayValues.push(cleanValue);
        }
        continue;
      }

      const match = line.match(/^(\w+)\s*=\s*(.+)$/);
      if (match) {
        const key = match[1];
        let value = match[2].trim();

        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("[") && value.endsWith("]")) {
          value = value
            .slice(1, -1)
            .split(",")
            .map((v) => v.trim().replace(/"/g, ""));
        } else if (!isNaN(value)) {
          value = parseInt(value);
        }

        if (inImage) {
          result.image[key] = value;
        } else if (currentStory) {
          currentStory[key] = value;
        } else {
          result[key] = value;
        }
      }
    }

    if (currentStory) {
      result.stories.push(currentStory);
    }

    return result;
  };

  const [state, setState] = useState({
    selectedLanguage: initialLanguage, // Set from prop or default to English
    availableLanguages: [],
    languageData: {}, // Bible data for each language: { langCode: { ot: {...}, nt: {...} } }
    languageNames: {}, // Language display names: { langCode: { english: "...", vernacular: "..." } }
    chapterText: {}, // Loaded chapter text: { "GEN.1": "chapter content...", ... }
    audioUrls: {}, // Cached audio URLs: { "lang-testament-BOOK.chapter": "url", ... }
    timingFileCache: {}, // Cached timing files: { "lang-testament": timingData }
    storyMetadata: {}, // Lightweight story metadata cache: { storyId: { testaments, title } } - ~50KB for 1000 stories vs ~10MB if caching parsed sections
    isLoadingSummary: false,
    summaryError: null,
    isLoadingChapter: false,
    isLoadingAudio: false,
    probeStatus: {}, // Track probe results: { langCode: { testament: { filesetId: status } } }
  });

  // Use ref to track loading chapters to avoid stale state issues
  const loadingChaptersRef = useRef({});
  const chapterTextRef = useRef({});
  const selectedLanguageRef = useRef(initialLanguage);
  const languageDataRef = useRef({});
  const loadingAudioRef = useRef({}); // Track loading audio URLs
  const audioUrlsRef = useRef({}); // Track cached audio URLs
  const timingFileCacheRef = useRef({}); // Track cached timing files
  const preloadStartedRef = useRef(false);
  const initializationStartedRef = useRef(false);

  const updateState = (updates) => {
    setState((prevState) => {
      const newState = { ...prevState, ...updates };
      // Keep refs in sync with state
      if (updates.chapterText) {
        chapterTextRef.current = newState.chapterText;
      }
      if (updates.languageData) {
        languageDataRef.current = newState.languageData;
      }
      if (updates.selectedLanguage) {
        selectedLanguageRef.current = updates.selectedLanguage;
      }
      if (updates.audioUrls) {
        audioUrlsRef.current = newState.audioUrls;
      }
      if (updates.timingFileCache) {
        timingFileCacheRef.current = newState.timingFileCache;
      }
      return newState;
    });
  };

  // Get story metadata from cache
  const getStoryMetadata = useCallback(
    (storyId) => {
      return state.storyMetadata[storyId] || null;
    },
    [state.storyMetadata],
  );

  // Load summary.json to get available languages
  const loadSummary = useCallback(async () => {
    updateState({ isLoadingSummary: true, summaryError: null });

    try {
      const response = await fetch("/ALL-langs-data/summary.json");
      if (!response.ok) {
        throw new Error(`Failed to load summary.json: ${response.status}`);
      }

      const summaryData = await response.json();

      // Extract language list from nested structure
      // Structure: canons -> nt/ot -> category -> langCode
      const languages = new Set();

      if (summaryData.canons) {
        ["nt", "ot"].forEach((testament) => {
          if (summaryData.canons[testament]) {
            const testamentData = summaryData.canons[testament];
            Object.keys(testamentData).forEach((category) => {
              if (typeof testamentData[category] === "object") {
                Object.keys(testamentData[category]).forEach((langCode) => {
                  languages.add(langCode);
                });
              }
            });
          }
        });
      }

      const languagesArray = Array.from(languages).sort();

      // Extract language names
      const languageNames = {};
      if (summaryData.canons) {
        ["nt", "ot"].forEach((testament) => {
          if (summaryData.canons[testament]) {
            const testamentData = summaryData.canons[testament];
            Object.keys(testamentData).forEach((category) => {
              if (typeof testamentData[category] === "object") {
                Object.keys(testamentData[category]).forEach((langCode) => {
                  const langInfo = testamentData[category][langCode];
                  if (langInfo && !languageNames[langCode]) {
                    languageNames[langCode] = {
                      english: langInfo.n || "",
                      vernacular: langInfo.v || "",
                    };
                  }
                });
              }
            });
          }
        });
      }

      updateState({
        availableLanguages: languagesArray,
        languageNames: languageNames,
        isLoadingSummary: false,
        summaryError: null,
      });

      return { languages: languagesArray, languageNames };
    } catch (error) {
      updateState({
        isLoadingSummary: false,
        summaryError: error.message,
      });
      throw error;
    }
  }, []);

  // Probe a specific fileset to check if it works with the DBT API
  // NOTE: The proxy automatically adds _ET for type=text, so we just pass the base ID
  const probeFileset = useCallback(async (filesetId, testament = "nt") => {
    const testBook = testament === "nt" ? "MAT" : "GEN";
    const testChapter = "1";

    try {
      // Proxy will automatically add _ET suffix for type=text
      const url = `/.netlify/functions/dbt-proxy?type=text&fileset_id=${filesetId}&book_id=${testBook}&chapter_id=${testChapter}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          return { success: true, filesetId, needsET: false };
        }
      }

      return { success: false, filesetId, error: `HTTP ${response.status}` };
    } catch (error) {
      return { success: false, filesetId, error: error.message };
    }
  }, []);

  // Probe multiple filesets and return the first working one
  const probeFilesets = useCallback(
    async (filesetCandidates, testament = "nt") => {
      for (const filesetId of filesetCandidates) {
        const result = await probeFileset(filesetId, testament);
        if (result.success) {
          return result;
        }
      }

      return null;
    },
    [probeFileset],
  );

  // Load bible-data.json for a specific language using manifest
  const loadLanguageData = useCallback(
    async (langCode) => {
      // Try manifest-based loading first for all languages
      try {
        // Load the manifest to find which categories have this language
        const manifestPath = `/ALL-langs-data/manifest.json`;
        const manifestResponse = await fetch(manifestPath);

        if (!manifestResponse.ok) {
          throw new Error("Failed to load manifest.json");
        }

        const manifest = await manifestResponse.json();
        const langData = {};
        const testaments = ["ot", "nt"];

        for (const testament of testaments) {
          // Check each category in manifest for this language
          // Load both text and audio filesets separately
          if (manifest.files?.[testament]) {
            const allCategories = Object.keys(manifest.files[testament]);

            // Text priority order
            const textPriorityOrder = [
              "with-timecode",
              "syncable",
              "text-only",
            ];

            // Audio priority order (with-timecode is highest priority!)
            const audioPriorityOrder = [
              "with-timecode",
              "audio-with-timecode",
              "syncable",
              "text-only",
              "audio-only",
            ];

            const testamentData = {
              category: null,
              distinctId: null,
              filesetId: null,
              basePath: null,
              audioFilesetId: null,
              audioCategory: null,
            };

            // First, try to find text fileset
            for (const category of textPriorityOrder) {
              if (allCategories.includes(category)) {
                const langList = manifest.files[testament][category];
                if (langList && langList[langCode]) {
                  const distinctIds = langList[langCode];
                  const distinctId = Array.isArray(distinctIds)
                    ? distinctIds[0]
                    : distinctIds;

                  try {
                    const dataPath = `/ALL-langs-data/${testament}/${category}/${langCode}/${distinctId}/data.json`;
                    const dataResponse = await fetch(dataPath);

                    if (dataResponse.ok) {
                      const filesetData = await dataResponse.json();
                      let filesetId = null;

                      if (filesetData.t) {
                        const textValue = filesetData.t;

                        // Check if it's a suffix (ends with .txt) or full ID
                        if (textValue.endsWith(".txt")) {
                          const suffix = textValue.replace(".txt", "");

                          // Determine if it's a full ID or a suffix based on length
                          // Full text IDs are typically 6+ characters, suffixes are shorter (like "N_ET", ".txt")
                          if (suffix.length >= 6) {
                            // It's a full fileset ID
                            filesetId = suffix;
                          } else {
                            // It's a suffix - concatenate with distinctId
                            filesetId = distinctId + suffix;
                          }
                        } else {
                          // It's a full fileset ID - use as is
                          filesetId = textValue;
                        }
                      } else {
                        // Fallback to distinctId if no 't' field
                        filesetId = distinctId;
                      }

                      testamentData.category = category;
                      testamentData.distinctId = distinctId;
                      testamentData.filesetId = filesetId;
                      // basePath is NOT set - no local chapter JSON files exist, text loads from API
                      break; // Found text data
                    }
                  } catch (err) {
                    continue;
                  }
                }
              }
            }

            // Second, try to find audio fileset (separate from text)
            for (const category of audioPriorityOrder) {
              if (allCategories.includes(category)) {
                const langList = manifest.files[testament][category];
                if (langList && langList[langCode]) {
                  const distinctIds = langList[langCode];
                  const distinctId = Array.isArray(distinctIds)
                    ? distinctIds[0]
                    : distinctIds;

                  try {
                    const dataPath = `/ALL-langs-data/${testament}/${category}/${langCode}/${distinctId}/data.json`;
                    const dataResponse = await fetch(dataPath);

                    if (dataResponse.ok) {
                      const filesetData = await dataResponse.json();
                      // Audio fileset is in 'a' field
                      let audioFilesetId = null;

                      if (filesetData.a) {
                        const audioValue = filesetData.a;

                        // Check if it's a suffix (ends with .mp3) or full ID
                        if (audioValue.endsWith(".mp3")) {
                          const suffix = audioValue.replace(".mp3", "");

                          // Determine if it's a full ID or a suffix based on length
                          // Full audio IDs are typically 10+ characters, suffixes are shorter (like "N1DA", "N2DA")
                          if (suffix.length >= 10) {
                            // It's a full fileset ID
                            audioFilesetId = suffix;
                          } else {
                            // It's a suffix - concatenate with distinctId
                            audioFilesetId = distinctId + suffix;
                          }
                        } else {
                          // It's a full fileset ID - use as is
                          audioFilesetId = audioValue;
                        }
                      }

                      if (audioFilesetId) {
                        testamentData.audioFilesetId = audioFilesetId;
                        testamentData.audioCategory = category;
                        // Save distinctId for timing file lookup
                        if (!testamentData.distinctId) {
                          testamentData.distinctId = distinctId;
                        }
                        break; // Found audio data
                      }
                    }
                  } catch (err) {
                    continue;
                  }
                }
              }
            }

            // Store testament data if we found either text or audio
            if (testamentData.filesetId || testamentData.audioFilesetId) {
              langData[testament] = testamentData;
            }
          }
        }

        if (Object.keys(langData).length > 0) {
          const newLanguageData = {
            ...languageDataRef.current,
            [langCode]: langData,
          };
          languageDataRef.current = newLanguageData;
          updateState({
            languageData: newLanguageData,
          });
        }

        return null;
      } catch (error) {
        console.error(
          `[loadLanguageData] Error loading ${langCode} from manifest:`,
          error,
        );

        // Fallback to auto-probe for eng/fra if manifest fails
        if (langCode === "eng" || langCode === "fra") {
          const langData = {};
          const candidates =
            langCode === "eng"
              ? ENGLISH_FILESET_CANDIDATES
              : FRENCH_FILESET_CANDIDATES;

          for (const testament of ["ot", "nt"]) {
            const testamentCandidates = candidates[testament];
            if (!testamentCandidates || testamentCandidates.length === 0) {
              continue;
            }
            const probeResult = await probeFilesets(
              testamentCandidates,
              testament,
            );

            if (probeResult && probeResult.success) {
              langData[testament] = {
                category: "api-probed",
                distinctId: probeResult.filesetId,
                filesetId: probeResult.filesetId,
                needsET: probeResult.needsET,
                basePath: null,
              };
            }
          }

          if (Object.keys(langData).length > 0) {
            const newLanguageData = {
              ...languageDataRef.current,
              [langCode]: langData,
            };
            languageDataRef.current = newLanguageData;
            updateState({
              languageData: newLanguageData,
            });
          }
        }

        return null;
      }
    },
    [state.languageData, probeFilesets],
  );

  // Load a specific chapter text using DBT API proxy
  const loadChapter = useCallback(
    async (bookId, chapterNum, testament = "ot") => {
      const chapterKey = `${bookId}.${chapterNum}`;

      // Check if already loading using ref (check this first!)
      if (loadingChaptersRef.current[chapterKey]) {
        return null;
      }

      // Check if already cached using ref (real-time value)
      if (chapterTextRef.current[chapterKey]) {
        return chapterTextRef.current[chapterKey];
      }

      const selectedLanguage = selectedLanguageRef.current;
      const languageData = languageDataRef.current;

      if (!selectedLanguage) {
        return null;
      }

      // Load language data if not already loaded
      if (!languageData[selectedLanguage]) {
        await loadLanguageData(selectedLanguage);
      }

      if (!languageData[selectedLanguage]) {
        return null;
      }

      // Use provided testament, default to OT for Genesis
      const testamentToUse = testament;

      // Early detection: check if testament data exists
      const langData = languageData[selectedLanguage][testamentToUse];
      if (!langData) {
        return null;
      }

      // Check if this is audio-only (no text fileset available)
      // Both "audio-with-timecode" and "audio-only" categories mean no text exists
      if (
        (langData.audioCategory === "audio-with-timecode" ||
          langData.audioCategory === "audio-only") &&
        !langData.filesetId
      ) {
        // No text available for this testament - return empty
        return null;
      }

      // Mark as loading
      loadingChaptersRef.current[chapterKey] = true;
      updateState({ isLoadingChapter: true });

      try {
        let verseArray = [];

        // Load text from DBT API
        const filesetId = langData.filesetId || langData.distinctId;

        if (!filesetId) {
          throw new Error(
            `No fileset ID for ${testamentToUse} in ${selectedLanguage}`,
          );
        }

        const url = `/.netlify/functions/dbt-proxy?type=text&fileset_id=${filesetId}&book_id=${bookId}&chapter_id=${chapterNum}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();

        // Extract verse array from API response
        if (data.data && Array.isArray(data.data)) {
          verseArray = data.data.map((verse) => ({
            num: parseInt(verse.verse_start, 10),
            text: verse.verse_text,
          }));
        }

        // Update state with loaded chapter
        delete loadingChaptersRef.current[chapterKey];

        setState((prevState) => ({
          ...prevState,
          chapterText: {
            ...prevState.chapterText,
            [chapterKey]: verseArray,
          },
          isLoadingChapter: false,
        }));

        // Update ref immediately
        chapterTextRef.current[chapterKey] = verseArray;

        return verseArray;
      } catch (error) {
        delete loadingChaptersRef.current[chapterKey];

        setState((prevState) => ({
          ...prevState,
          isLoadingChapter: false,
        }));
        return null;
      }
    },
    [state, loadLanguageData],
  );

  // Preload Bible references from all markdown files and analyze testament usage per story
  const preloadBibleReferences = useCallback(async () => {
    // Prevent multiple preload attempts
    if (preloadStartedRef.current) {
      return;
    }
    preloadStartedRef.current = true;

    try {
      // Get list of all categories from main index
      const indexResponse = await fetch("/templates/OBS/index.toml");
      if (!indexResponse.ok) {
        throw new Error("Could not load OBS index");
      }
      const indexText = await indexResponse.text();
      const indexData = parseToml(indexText);
      const categories = indexData.categories || [];

      // Collect all story paths from all categories
      const storyPaths = [];
      for (const categoryDir of categories) {
        try {
          const catResponse = await fetch(
            `/templates/OBS/${categoryDir}/index.toml`,
          );
          if (catResponse.ok) {
            const catText = await catResponse.text();
            const catData = parseToml(catText);
            if (catData.stories) {
              catData.stories.forEach((story) => {
                storyPaths.push(`${categoryDir}/${story.id}.md`);
              });
            }
          }
        } catch (err) {
          console.error(`Error loading category ${categoryDir}:`, err);
        }
      }

      const allReferences = new Set();
      const storyTestaments = {}; // Track testament usage per story

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

      // Scan all markdown files for references and analyze testament usage
      for (const storyPath of storyPaths) {
        // Extract story ID from path (e.g., "03-Exodus/09.md" -> "09")
        const pathMatch = storyPath.match(/\/(\d+)\.md$/);
        const storyId = pathMatch ? pathMatch[1] : null;

        if (!storyId) continue;

        try {
          const mdResponse = await fetch(`/templates/OBS/${storyPath}`);
          if (mdResponse.ok) {
            const content = await mdResponse.text();

            // Initialize testament tracking for this story
            const testamentsUsed = new Set();

            // Extract all references for this story
            const refMatches = content.matchAll(/<<<REF:\s*([^>]+)>>>/g);
            for (const match of refMatches) {
              const ref = match[1].trim();
              allReferences.add(ref);

              // Determine testament for this reference
              const bookMatch = ref.match(/^([A-Z0-9]+)\s+/i);
              if (bookMatch) {
                const book = bookMatch[1].toUpperCase();
                const testament = ntBooks.includes(book) ? "nt" : "ot";
                testamentsUsed.add(testament);
              }
            }

            // Cache testament info for this story
            storyTestaments[storyId] = {
              usesOT: testamentsUsed.has("ot"),
              usesNT: testamentsUsed.has("nt"),
            };
          } else {
            // Story file doesn't exist - mark as having no testaments (will show as empty)
            storyTestaments[storyId] = {
              usesOT: false,
              usesNT: false,
            };
          }
        } catch (err) {
          // Error fetching story - mark as having no testaments
          storyTestaments[storyId] = {
            usesOT: false,
            usesNT: false,
          };
        }
      }

      // Update state with story testament metadata
      const newStoryMetadata = {};
      for (const [storyId, testaments] of Object.entries(storyTestaments)) {
        newStoryMetadata[storyId] = {
          testaments,
          title: null, // Title can be added later when story is opened
          cachedAt: Date.now(),
        };
      }

      updateState({
        storyMetadata: {
          ...state.storyMetadata,
          ...newStoryMetadata,
        },
      });

      // Parse references and extract unique chapters
      const chaptersToLoad = new Set();
      for (const ref of allReferences) {
        const match = ref.match(/^([A-Z0-9]+)\s+(\d+):/i);
        if (match) {
          const book = match[1].toUpperCase();
          const chapter = parseInt(match[2], 10);
          chaptersToLoad.add(`${book}.${chapter}`);
        }
      }

      // Load all chapters in background
      for (const chapterKey of chaptersToLoad) {
        const [book, chapter] = chapterKey.split(".");
        const testament = ntBooks.includes(book) ? "nt" : "ot";

        // Only load if not already cached or loading (use ref for real-time check)
        if (
          !chapterTextRef.current[chapterKey] &&
          !loadingChaptersRef.current[chapterKey]
        ) {
          await loadChapter(book, parseInt(chapter, 10), testament);
          // Small delay between each request
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error("Error preloading Bible references:", error);
      preloadStartedRef.current = false; // Reset on error so it can retry
    }
  }, [loadChapter, state.storyMetadata]);

  // Load audio URL for a specific chapter (cache only what's requested)
  const loadAudioUrl = useCallback(
    async (bookId, chapterNum, testament = "ot") => {
      const { selectedLanguage } = state;
      if (!selectedLanguage) {
        return null;
      }

      const audioKey = `${selectedLanguage}-${testament}-${bookId}.${chapterNum}`;

      // Check if already cached using ref (real-time value)
      if (audioUrlsRef.current[audioKey]) {
        return audioUrlsRef.current[audioKey];
      }

      // Check if already loading
      if (loadingAudioRef.current[audioKey]) {
        return null;
      }

      // Get language data
      const languageData = languageDataRef.current;

      // Load language data if not already loaded
      if (!languageData[selectedLanguage]) {
        await loadLanguageData(selectedLanguage);
      }

      const langData = languageData[selectedLanguage]?.[testament];
      if (!langData) {
        return null;
      }

      // Check if this language/testament has audio using the audioFilesetId
      if (!langData.audioFilesetId) {
        return null; // No audio available for this testament
      }

      // Mark as loading
      loadingAudioRef.current[audioKey] = true;
      updateState({ isLoadingAudio: true });

      try {
        // Get audio fileset ID - use the separate audioFilesetId
        const audioFilesetId = langData.audioFilesetId;

        if (!audioFilesetId) {
          throw new Error(
            `No audio fileset ID for ${testament} in ${selectedLanguage}`,
          );
        }

        // Fetch audio data from DBT API
        const url = `/.netlify/functions/dbt-proxy?type=audio&fileset_id=${audioFilesetId}&book_id=${bookId}&chapter_id=${chapterNum}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Audio API request failed: ${response.status}`);
        }

        const data = await response.json();

        // Extract audio URL from API response
        // DBT API returns array with audio file path
        let audioUrl = null;
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          audioUrl = data.data[0].path;
        }

        if (!audioUrl) {
          throw new Error("No audio URL in response");
        }

        // Check if this category has timecode data
        const hasTimecode = ["with-timecode", "audio-with-timecode"].includes(
          langData.audioCategory,
        );

        let timingData = null;

        if (hasTimecode) {
          const timingCacheKey = `${selectedLanguage}-${testament}`;

          // Check if timing file is already cached
          if (timingFileCacheRef.current[timingCacheKey]) {
            timingData = timingFileCacheRef.current[timingCacheKey];
          } else {
            // Load and cache the whole timing file
            try {
              const audioCategory = langData.audioCategory;
              const distinctId = langData.distinctId || selectedLanguage;
              const langCode = selectedLanguage;

              // Try timing file with audio category first, then fallback to with-timecode
              const timingCategoriesToTry = [audioCategory];
              if (audioCategory === "audio-with-timecode") {
                timingCategoriesToTry.push("with-timecode");
              }

              for (const timingCategory of timingCategoriesToTry) {
                const timingPath = `/ALL-timings/${testament}/${timingCategory}/${langCode}/${distinctId}/timing.json`;

                try {
                  const timecodeResponse = await fetch(timingPath);

                  if (timecodeResponse.ok) {
                    timingData = await timecodeResponse.json();

                    // Cache the whole timing file for current language only
                    timingFileCacheRef.current = {
                      [timingCacheKey]: timingData,
                    };
                    updateState({
                      timingFileCache: { [timingCacheKey]: timingData },
                    });
                    break; // Found timing data, stop trying
                  }
                } catch (err) {
                  // Continue to next category
                }
              }
            } catch (timecodeError) {
              // Continue without timing data
            }
          }
        }

        // Create cache entry object with reference string for future cross-chapter support
        const cacheEntry = {
          reference: `${bookId} ${chapterNum}`, // e.g., "MAT 1"
          url: audioUrl,
          hasTimecode: hasTimecode,
          timingData: timingData,
          audioFilesetId: audioFilesetId,
        };

        // Update cache
        delete loadingAudioRef.current[audioKey];

        setState((prevState) => ({
          ...prevState,
          audioUrls: {
            ...prevState.audioUrls,
            [audioKey]: cacheEntry,
          },
          isLoadingAudio: false,
        }));

        // Update ref immediately
        audioUrlsRef.current[audioKey] = cacheEntry;

        return cacheEntry;
      } catch (error) {
        console.error(`Failed to load audio URL for ${audioKey}:`, error);
        delete loadingAudioRef.current[audioKey];

        setState((prevState) => ({
          ...prevState,
          isLoadingAudio: false,
        }));
        return null;
      }
    },
    [state, loadLanguageData],
  );

  // Set selected language and load its data
  const setSelectedLanguage = useCallback(
    async (langCode) => {
      // Clear timing file cache when language changes
      timingFileCacheRef.current = {};
      updateState({
        selectedLanguage: langCode,
        timingFileCache: {},
      });
      // Pre-load language data if not cached
      if (!state.languageData[langCode]) {
        await loadLanguageData(langCode);
      }

      // Log language info using ref (has most up-to-date data)
      const langData = languageDataRef.current[langCode];
      if (langData) {
        const otTextCat = langData.ot?.category || "N/A";
        const otAudioCat = langData.ot?.audioCategory || "N/A";
        const ntTextCat = langData.nt?.category || "N/A";
        const ntAudioCat = langData.nt?.audioCategory || "N/A";

        console.log(
          `Language changed to ${langCode.toUpperCase()} - OT: text(${otTextCat})/audio(${otAudioCat}), NT: text(${ntTextCat})/audio(${ntAudioCat})`,
        );

        const otIds = langData.ot
          ? `Text: ${langData.ot.filesetId || "N/A"}, Audio: ${langData.ot.audioFilesetId || "N/A"}`
          : "Text: N/A, Audio: N/A";
        const ntIds = langData.nt
          ? `Text: ${langData.nt.filesetId || "N/A"}, Audio: ${langData.nt.audioFilesetId || "N/A"}`
          : "Text: N/A, Audio: N/A";
        console.log(`  OT IDs - ${otIds}`);
        console.log(`  NT IDs - ${ntIds}`);
      }
    },
    [state.languageData, loadLanguageData],
  );

  // Get available books for selected language
  const getAvailableBooks = useCallback(
    (testament = null) => {
      const { selectedLanguage, languageData } = state;

      if (!selectedLanguage || !languageData[selectedLanguage]) {
        return [];
      }

      const books = [];
      const langData = languageData[selectedLanguage];

      if (testament === "ot" || testament === null) {
        if (langData.ot) {
          books.push({
            testament: "ot",
            filesetId: langData.ot.filesetId || langData.ot.distinctId,
            category: langData.ot.category,
          });
        }
      }

      if (testament === "nt" || testament === null) {
        if (langData.nt) {
          books.push({
            testament: "nt",
            filesetId: langData.nt.filesetId || langData.nt.distinctId,
            category: langData.nt.category,
          });
        }
      }

      return books;
    },
    [state],
  );

  // Initialize on mount - load summary and language data
  useEffect(() => {
    // Prevent multiple initializations (React StrictMode calls effects twice)
    if (initializationStartedRef.current) {
      return;
    }
    initializationStartedRef.current = true;

    const init = async () => {
      try {
        await loadSummary();
        // Load language data for selected language
        await loadLanguageData(state.selectedLanguage);
        // Preload Bible chapters from markdown files
        await preloadBibleReferences();

        // Log initial language info after data is loaded
        const langCode = state.selectedLanguage;
        const langData = languageDataRef.current[langCode];
        if (langData) {
          const otTextCat = langData.ot?.category || "N/A";
          const otAudioCat = langData.ot?.audioCategory || "N/A";
          const ntTextCat = langData.nt?.category || "N/A";
          const ntAudioCat = langData.nt?.audioCategory || "N/A";

          console.log(
            `Initial language ${langCode.toUpperCase()} - OT: text(${otTextCat})/audio(${otAudioCat}), NT: text(${ntTextCat})/audio(${ntAudioCat})`,
          );

          const otIds = langData.ot
            ? `Text: ${langData.ot.filesetId || "N/A"}, Audio: ${langData.ot.audioFilesetId || "N/A"}`
            : "Text: N/A, Audio: N/A";
          const ntIds = langData.nt
            ? `Text: ${langData.nt.filesetId || "N/A"}, Audio: ${langData.nt.audioFilesetId || "N/A"}`
            : "Text: N/A, Audio: N/A";
          console.log(`  OT IDs - ${otIds}`);
          console.log(`  NT IDs - ${ntIds}`);
        }
      } catch (error) {
        // Initialization failed
        initializationStartedRef.current = false; // Reset on error
      }
    };
    init();
  }, []);

  // Sync external language prop changes with state
  useEffect(() => {
    if (initialLanguage && initialLanguage !== state.selectedLanguage) {
      // Clear caches when language changes
      chapterTextRef.current = {};
      loadingChaptersRef.current = {};
      loadingAudioRef.current = {};
      timingFileCacheRef.current = {};
      preloadStartedRef.current = false; // Reset preload flag to allow reloading
      selectedLanguageRef.current = initialLanguage; // Update ref immediately

      // Load language data if not already loaded
      if (!languageDataRef.current[initialLanguage]) {
        loadLanguageData(initialLanguage).then(() => {
          // Update selectedLanguage AFTER data is loaded
          updateState({
            selectedLanguage: initialLanguage,
            languageData: { ...languageDataRef.current },
            chapterText: {},
            audioUrls: {},
            timingFileCache: {},
          });
          // Reload Bible references for new language
          preloadBibleReferences();

          // Log language info after loading
          const langData = languageDataRef.current[initialLanguage];
          if (langData) {
            const otTextCat = langData.ot?.category || "N/A";
            const otAudioCat = langData.ot?.audioCategory || "N/A";
            const ntTextCat = langData.nt?.category || "N/A";
            const ntAudioCat = langData.nt?.audioCategory || "N/A";

            console.log(
              `Language changed to ${initialLanguage.toUpperCase()} - OT: text(${otTextCat})/audio(${otAudioCat}), NT: text(${ntTextCat})/audio(${ntAudioCat})`,
            );

            const otIds = langData.ot
              ? `Text: ${langData.ot.filesetId || "N/A"}, Audio: ${langData.ot.audioFilesetId || "N/A"}`
              : "Text: N/A, Audio: N/A";
            const ntIds = langData.nt
              ? `Text: ${langData.nt.filesetId || "N/A"}, Audio: ${langData.nt.audioFilesetId || "N/A"}`
              : "Text: N/A, Audio: N/A";
            console.log(`  OT IDs - ${otIds}`);
            console.log(`  NT IDs - ${ntIds}`);
          }
        });
      } else {
        // Language data already cached, update state to trigger recalculation
        updateState({
          selectedLanguage: initialLanguage,
          languageData: { ...languageDataRef.current },
          chapterText: {},
          audioUrls: {},
          timingFileCache: {},
        });
        // Reload Bible references for new language
        preloadBibleReferences();

        // Log language info from cache
        const langData = languageDataRef.current[initialLanguage];
        if (langData) {
          const otTextCat = langData.ot?.category || "N/A";
          const otAudioCat = langData.ot?.audioCategory || "N/A";
          const ntTextCat = langData.nt?.category || "N/A";
          const ntAudioCat = langData.nt?.audioCategory || "N/A";

          console.log(
            `Language changed to ${initialLanguage.toUpperCase()} - OT: text(${otTextCat})/audio(${otAudioCat}), NT: text(${ntTextCat})/audio(${ntAudioCat})`,
          );

          const otIds = langData.ot
            ? `Text: ${langData.ot.filesetId || "N/A"}, Audio: ${langData.ot.audioFilesetId || "N/A"}`
            : "Text: N/A, Audio: N/A";
          const ntIds = langData.nt
            ? `Text: ${langData.nt.filesetId || "N/A"}, Audio: ${langData.nt.audioFilesetId || "N/A"}`
            : "Text: N/A, Audio: N/A";
          console.log(`  OT IDs - ${otIds}`);
          console.log(`  NT IDs - ${ntIds}`);
        }
      }
    }
  }, [initialLanguage]);

  const value = {
    ...state,
    loadSummary,
    loadLanguageData,
    loadChapter,
    loadAudioUrl,
    setSelectedLanguage,
    getAvailableBooks,
    probeFileset,
    probeFilesets,
    preloadBibleReferences,
    getStoryMetadata,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export { LanguageContext, LanguageProvider };
export default LanguageContext;
