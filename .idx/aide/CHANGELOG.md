# Changelog

All notable changes to this project will be documented in this file.

## Version 1.9.0 (Build 20251109.1)

*   **REFACTOR (Architecture):** Overhauled the `ContentContext` to use a "database-first" architecture. The system now performs a one-time seeding of permanent context documents into IndexedDB and treats the database as the source of truth, eliminating redundant processing and race conditions during application startup.
*   **FIX (Data Integrity):** The new `ContentContext` architecture prevents the creation of orphaned `local_only` file records by verifying if a permanent document has already been registered with the Gemini API before attempting to add it.
*   **FIX (Logging):** Corrected invalid `log.warn` calls in `GeminiCorpusContext.tsx` to use the appropriate `log.info` and `log.error` methods, adhering to the established logging standards.
*   **DOCS (AIDE):** Introduced a new architectural document, `.idx/aide/DATAMAP.md`, which provides a comprehensive map of the core data structures used in the application. Updated all internal AIDE documentation to reflect this addition and the new `ContentContext` architecture.

## Version 1.8.1 (Build 20251106.1)

*   **FIX (Data Integrity):** Implemented a comprehensive, multi-step data synchronization and self-healing process in `GeminiCorpusContext.tsx`.
    *   The new logic performs a robust "local-first" cleanup to resolve `displayName` collisions in IndexedDB before reconciling with the remote API.
    *   It intelligently prioritizes newer local content over stale remote records, deletes remote duplicates, and removes stale local pointers to non-existent remote files.
    *   This "three-way merge" between local metadata, local content, and the remote state resolves persistent data consistency issues and prevents stale "Local record. Not synced." entries.
*   **DOCS (AIDE):** Documented the new synchronization architecture in `.idx/aide/REFERENCE.md` and corrected internal pathing rules to use relative paths exclusively.

### **Build 20251104.9** - 2025-11-04

*   **FIX (Social Post Assistant):** Resolved TypeScript errors in `SocialPostAssistant.tsx` by adding a type guard to the `filter` operation on `geminiContextFiles.values()`, ensuring correct type inference for `GeminiFile` objects.

### **Build 20251104.8** - 2025-11-04

*   **REFACTOR (UI):** Centralized all tooltip and pill name formatting logic into a new `uiFormatService`. This removes redundant code from `ChatAssistantPanel`, `QuoteFinder`, and `ContextProfiles`, ensuring a consistent look and feel for context and corpus pills across the entire application.
*   **FIX (Build):** Restored the missing `export default` statement in `ChatAssistantPanel.tsx`, resolving a critical build error that prevented the application from compiling.

### **Build 20251104.7** - 2025-11-04

*   **FIX (Chat Assistant):** Resolved a runtime error in `ChatAssistantPanel.tsx` by updating the component to use the `contextFiles` property from `geminiCorpusContext`, aligning it with the recent context API changes and preventing a crash on load.

### **Build 20251104.6** - 2025-11-04

*   **FEAT (UI/UX):** Implemented a `stripPrefix` helper function in `ContextProfiles.tsx` and `QuoteFinder.tsx` to remove the `__cc_` prefix from document IDs displayed in the context pill tooltips, improving readability and user experience.

### **Build 20251104.5** - 2025-11-04

*   **FEAT (UI/UX):** Implemented a `stripPrefix` helper function in `FilesTable.tsx` to remove the `__cc_` prefix from displayed file names, improving readability and user experience in the file management table.

### **Build 20251104.4** - 2025-11-04

*   **FIX (Social Post Assistant):** Resolved critical TypeScript errors by properly typing the `geminiCorpusContext` and ensuring consistent use of the `contextFiles` property across all components. This corrects type inference issues that were causing build failures.

### **Build 20251104.3** - 2025-11-04

*   **FIX (Social Post Assistant):** Resolved TypeScript errors in `SocialPostAssistant.tsx` by explicitly importing `ImageInspiration` and `TextInspiration` types and correcting the reference to `geminiCorpusContext.contextFiles`.

### **Build 20251104.2** - 2025-11-04

*   **REFACTOR (Social Post Assistant):** Performed a major refactoring of the `SocialPostAssistant` component. The monolithic component was broken down into smaller, more manageable sub-components (`UrlInput`, `InspirationsInput`, `PlatformSettings`, `UtmPanel`, `ContextProfiles`, `GeneratedPostCard`, `RegenerationModal`, `MaximizedEditorModal`), improving code organization, maintainability, and readability.

### **Build 20251104.1** - 2025-11-04

*   **REFACTOR (File Management):** Performed a major refactoring of the `FileManagementPanel` component. The monolithic component was broken down into smaller, more manageable sub-components (`FileUploadPanel`, `FilesTable`, `FileInfoModal`, `FileActions`), improving code organization and maintainability.
*   **FIX (File Sync):** Overhauled the file synchronization and deletion logic to be more robust and intelligent, resolving several critical bugs related to orphaned files.
    *   The `forceResync` logic now correctly uses the local `files` metadata table as the source of truth, preventing the accidental deletion of valid context files that don't have local content on a new device.
    *   The system now performs an "upload-and-replace" strategy, automatically deleting the old remote version of a file after a newer local version is uploaded, preventing the accumulation of duplicates on the server.
    *   The file deletion process now correctly handles local-only orphans, removing them from the local database without making a failing API call.
    *   Error handling for API deletion calls was made more robust to correctly identify and ignore 403/404 errors for remote orphans, regardless of how the error object is structured.
*   **FEAT (Data Integrity):** Implemented a multi-layered data sanitization and self-healing system.
    *   A new `ensureRemoteFileExists` function was added to `geminiFileService` and integrated into `promptService`. This provides a "just-in-time" guarantee that any file attached to a prompt is valid on the remote API, automatically re-uploading it if it has expired or is missing.
    *   The `dbService` now automatically purges all orphaned local content records (content without metadata) on application startup, before database exports, and whenever the File Management panel is loaded, ensuring a consistently clean local state.
*   **DOCS (AIDE):** Updated all internal AIDE documentation (`APPMAP.md`, `SERVICEMAP.md`, `REFERENCE.md`) to reflect all architectural changes, new functions, and the new "File Synchronization Philosophy." Also clarified the pathing convention rule in `GEMINI.md`.

## Version 1.7.0 (Build 20251103.1)

*   **REFACTOR (Architecture):** Performed a major refactor of the AI prompt system. All user-facing prompt templates have been externalized into individual markdown files within a new `/src/prompts/` directory. This decouples prompt content from application logic, making them easier to manage and update.
*   **REFACTOR (Services):** The `promptService` has been updated to dynamically load all prompt templates from their respective files on application startup, replacing the previous hardcoded string implementation.
*   **DOCS (AIDE):** Updated `.idx/aide/CONTEXTMAP.md` to include a new "Prompt Templates" section. This table documents all prompt files, their purpose, which tool and function uses them, providing a clear reference for the new prompt architecture.

## Version 1.6.0 (Build 20251102.2)

*   **FEAT (File Management):** Enhanced file status display in the File Management panel. Files are now explicitly categorized as 'Local only', 'API only (temporary)', or 'Synced' based on their presence in the local database and on the Gemini API. A 'Sync status unknown' fallback is also included.
*   **FIX (File Management):** Resolved a race condition in `dbService.ts` that caused the database purge to be blocked. A 100ms delay was added after closing the IndexedDB connection to ensure successful deletion.
*   **REFACTOR (File Management):** Removed the `apiFileNames` state variable from `FileManagementPanel.tsx` as it is no longer needed with the new file status logic.

## Version 1.5.0 (Build 20251102.1)

*   **Feature:** Added a "Purge Database" button to the Prompt Inspector modal. This provides a developer utility to clear all application data from IndexedDB.
*   **Fix:** Resolved an issue where the Prompt Inspector was not displaying prompt content. The panel now correctly initializes the `promptService` and dynamically loads the content for the selected prompt.
