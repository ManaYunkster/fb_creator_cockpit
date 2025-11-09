# Reference Materials & Architectural Decisions

## Data Synchronization: Local-First Cleanup and Three-Way Merge

**Date:** 2025-11-06

**Context:** The application was suffering from a data integrity issue where stale "local-only" records persisted in the local IndexedDB even after the corresponding file was successfully synced to the Gemini API. This resulted in duplicate entries in the UI and inconsistent application state.

**Problem:** The original synchronization logic was not robust enough to handle cases where the local and remote states were out of sync, particularly when a local placeholder record was not properly cleaned up after a successful file upload.

**Solution:** A more robust, multi-step synchronization process was implemented in `contexts/GeminiCorpusContext.tsx`. This process runs on every application load and prioritizes healing the local database *before* attempting to reconcile with the remote API.

### Key Logic Steps:

1.  **Local-First Cleanup:** The process begins by resolving `displayName` collisions exclusively within the local IndexedDB.
    *   It groups all metadata records by `displayName`.
    *   If a collision is found, it determines the "canonical" version by comparing modification dates. Crucially, it checks if a local placeholder (`local/...`) has a corresponding content file that is *newer* than the synced version (`files/...`). If so, the local version is prioritized.
    *   All non-canonical (stale) records are deleted from the local database.

2.  **Remote Deduplication:** The logic then fetches all files from the Gemini API and deletes any remote duplicates, ensuring only the most recent version of a file with a given `displayName` is kept.

3.  **Stale Pointer Removal:** After cleaning the remote, it performs a final local check, deleting any local records (`files/...`) that point to remote files that no longer exist (e.g., were deleted or expired).

4.  **Standard Sync:** Only after these comprehensive cleanup steps does the standard sync process proceed, uploading any genuinely new or modified files to the now-consistent remote API.

This "three-way merge" (local metadata, local content, remote state) ensures that the application is self-healing and can recover from a variety of data inconsistencies without requiring manual intervention or a full "Force Resync."
