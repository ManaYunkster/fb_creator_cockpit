# Reference Materials & Architectural Decisions

---

## `ContentContext`: Database-First Architecture

**Date:** 2025-11-09

**Context:** The initial implementation of `ContentContext` relied on fetching and classifying static context documents from the `/src/context_documents` directory on every application startup. This was inefficient and led to a race condition where files could be registered with the Gemini API multiple times, creating orphaned `local_only` duplicates in the database.

**Problem:** The startup logic was not idempotent. It lacked a persistent source of truth to know which foundational documents had already been processed and registered, causing redundant processing and data duplication.

**Solution:** The architecture was refactored to a "database-first" model, making IndexedDB the central source of truth for all permanent context documents.

### Key Logic Steps in `ContentContext.tsx`:

1.  **Check for Permanent Documents:** On application load, the context first queries the `permanent_documents` object store in IndexedDB.
2.  **Load from DB:** If documents are found in the database, they are loaded directly into the application state. This is now the standard and fast path.
3.  **Seed if Empty:** If the `permanent_documents` store is empty (e.g., on a fresh install or after a database reset), the context performs a one-time seeding process:
    a. It fetches the predefined `PreloadedAsset` files (e.g., `brand-brief.md`, `author-bio.md`).
    b. It uses the Gemini API to generate a `classification` and `summary` for each document.
    c. The resulting `ContextDocument` objects are saved to the `permanent_documents` store in IndexedDB.
4.  **Verify Registration:** After loading documents from the database (either from a pre-existing state or after seeding), the context verifies that each permanent document has been registered with the `GeminiFile` service. It checks the `files` database table and only registers a document if it is missing, preventing the creation of duplicates.

This new model ensures that the expensive classification and registration process happens only once. By treating the database as the definitive record, the application startup is now faster, more resilient, and free from the previous race condition.

---

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
