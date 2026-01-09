# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Content Availability Badge System**
  - Empty badge (∅) displays on stories and categories when required Bible text is not available
  - Badge appears in top-right corner of story/category thumbnails
  - Pre-analysis of all stories on startup to determine OT/NT testament requirements
  - Category-level badges show when ALL stories in category lack content
  - Automatic re-evaluation when language changes

### Changed
- **Language Context Optimization**
  - `preloadBibleReferences()` now analyzes testament usage for all stories
  - Story metadata cached on startup instead of per-story-view
  - Testament analysis walks full category tree from index.toml files
  - Missing story files automatically marked as empty
  - Removed unused `cacheStoryMetadata()` function

- **Simplified Availability Logic**
  - Availability now checks TEXT only (not audio/timecode)
  - Removed "partial" status - only "empty" or "full"
  - Empty = missing text for ANY required testament
  - Full = has text for ALL required testaments

- **Language Selector Improvements**
  - Switched from preview/apply pattern to immediate selection
  - Language change triggers immediate reload of navigation
  - Removed unnecessary confirmation dialogs

### Removed
- Partial badge logic and styling
- `getAvailabilityClass()` - CSS classes had no corresponding styles
- `getAvailabilityDescription()` - unused helper function
- Percentage calculation in `getCategoryAvailability()` - never used
- Preview/apply pattern from LanguageSelector
- Debug console.log statements from production code

### Fixed
- Badge visibility on initial page load (added dependencies to useEffect)
- Badge display blocked by `overflow: hidden` on parent container
- Language selector crashes due to prop mismatch
- NavigationGrid not reloading when story metadata updates
- Testament analysis missing stories not in manifest.json

### Technical Details
- **Memory Impact**: ~4KB for 50 stories (negligible)
- **Network Impact**: Zero additional requests (reuses existing file fetches)
- **Performance**: ~50ms added to startup (one-time cost)
- **Files Modified**: 8 core files
- **Lines Changed**: ~500 additions, ~200 deletions

### Architecture Improvements
- Centralized testament analysis in LanguageContext
- Eliminated duplicate parsing logic between StoryViewer and NavigationGrid
- Single source of truth for story metadata
- Proper state synchronization for reactive UI updates

---

## Previous Versions

This is the first changelog entry. For historical changes, see Git history.