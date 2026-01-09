/**
 * Story content availability utilities
 * Determines what TEXT content is available for a story in a given language
 */

/**
 * Calculate text availability for a story
 * @param {Object} storyMetadata - Cached story metadata with testaments info
 * @param {Object} languageData - Language data with OT/NT text filesets
 * @returns {Object} Availability status
 */
export const getStoryAvailability = (storyMetadata, languageData) => {
  // Default to unknown if no language data
  if (!languageData) {
    return {
      status: "unknown",
      hasText: false,
      missingTestaments: [],
      availableTestaments: [],
    };
  }

  // If no metadata, assume story needs both OT and NT (most stories do)
  const testaments = storyMetadata?.testaments || {
    usesOT: true,
    usesNT: true,
  };

  // If story uses no testaments, it's empty (shouldn't happen, but handle it)
  if (!testaments.usesOT && !testaments.usesNT) {
    return {
      status: "empty",
      hasText: false,
      missingTestaments: [],
      availableTestaments: [],
    };
  }

  // Check which testaments are needed
  const testamentsNeeded = [];
  if (testaments.usesOT) testamentsNeeded.push("ot");
  if (testaments.usesNT) testamentsNeeded.push("nt");

  const missingTestaments = [];
  const availableTestaments = [];

  // Check text OR audio availability for each needed testament
  for (const testament of testamentsNeeded) {
    const testamentData = languageData[testament];

    if (!testamentData) {
      missingTestaments.push(testament);
      continue;
    }

    // Check if testament has TEXT fileset
    const hasText = !!testamentData.filesetId;

    // Check if testament has AUDIO with timecode (can play audio stories without text)
    const hasAudioWithTimecode =
      testamentData.audioFilesetId &&
      (testamentData.audioCategory === "audio-with-timecode" ||
        testamentData.audioCategory === "with-timecode");

    // Testament is available if it has either text OR audio with timecode
    if (hasText || hasAudioWithTimecode) {
      availableTestaments.push(testament);
    } else {
      missingTestaments.push(testament);
    }
  }

  // Determine status: empty if ANY required testament is missing content, otherwise full
  const status = missingTestaments.length > 0 ? "empty" : "full";
  const hasText = missingTestaments.length === 0;

  return {
    status,
    hasText,
    missingTestaments,
    availableTestaments,
  };
};

/**
 * Get availability status for multiple stories (e.g., in a category)
 * @param {Array} storyIds - Array of story IDs
 * @param {Object} storyMetadataCache - Cache of story metadata
 * @param {Object} languageData - Language data
 * @returns {Object} Aggregated statistics
 */
export const getCategoryAvailability = (
  storyIds,
  storyMetadataCache,
  languageData,
) => {
  const stats = {
    total: storyIds.length,
    full: 0,
    empty: 0,
    unknown: 0,
  };

  storyIds.forEach((storyId) => {
    const metadata = storyMetadataCache[storyId];
    const availability = getStoryAvailability(metadata, languageData);

    switch (availability.status) {
      case "full":
        stats.full++;
        break;
      case "empty":
        stats.empty++;
        break;
      default:
        stats.unknown++;
    }
  });

  return stats;
};

/**
 * Get icon for story availability status
 * @param {string} status - Status from getStoryAvailability
 * @returns {string} Icon character
 */
export const getAvailabilityIcon = (status) => {
  const iconMap = {
    full: "✓",
    empty: "∅",
    unknown: "?",
  };

  return iconMap[status] || "?";
};
