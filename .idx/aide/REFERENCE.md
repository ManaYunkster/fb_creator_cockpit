# Technical Reference

This document contains reference material for code, methods, functions, and constructs that have proven to be non-obvious or poorly documented. It serves as a quick-reference guide to prevent re-solving problems we've already encountered.

---

### 1. Gemini Files API: Correctly Setting `displayName` on Upload

-   **File(s) Affected:** `services/geminiFileService.ts`
-   **Problem:** The documentation and common examples for the `@google/genai` SDK are conflicting regarding how to set a file's display name during upload. Some sources suggest a `fileMetadata` object, while others show a top-level `displayName` property. Attempting to use `fileMetadata` results in a TypeScript error: `Object literal may only specify known properties, and 'fileMetadata' does not exist in type 'UploadFileParameters'`. This issue took significant time to debug.
-   **Solution:** The correct and working implementation is to pass `displayName` as a **top-level property** within the `config` object of the `ai.files.upload` method.

    ```typescript
    // Correct Implementation
    const response = await ai.files.upload({
        file: fileToUpload,
        config: {
            displayName: finalDisplayName,
            mimeType: fileToUpload.type,
        }
    });
    ```

---

### 2. Local Display Name Caching System

-   **File(s) Affected:** `services/geminiFileService.ts`, `types.ts`, `components/FileManagementPanel.tsx`
-   **Problem:** The Gemini API does not reliably return the `displayName` provided during upload, often defaulting to its internal file ID (e.g., `files/123456`). This makes identifying files in the UI difficult.
-   **Solution:** We have implemented a client-side caching mechanism using `localStorage` to persist user-intended display names.
    -   **Mechanism:**
        1.  When a file is uploaded via `geminiFileService.uploadFile`, an optional `cacheAs` property can be provided. This string (the user's original filename) is stored in `localStorage` with a key like `displayName_[API_FILE_NAME]`.
        2.  The `FileManagementPanel` now explicitly uses this system: when a user uploads a file, the user-provided name is passed as the `cacheAs` option, while the system-generated prefixed name is sent as the `displayName` to the API. This ensures the UI always shows the friendly name the user provided.
        3.  When files are listed or retrieved (`listFiles`, `getFile`), the service checks `localStorage` for a corresponding entry.
        4.  The `GeminiFile` type is extended with `cachedDisplayName: string` and `isDisplayNameCached: boolean`. If a cached name is found, it's populated into `cachedDisplayName`.
    -   **UI Implementation:** Components like `FileManagementPanel.tsx` prioritize displaying `cachedDisplayName`. The file table shows the friendly, cached name in the main "Name" column, while the full, prefixed API name is visible in a sub-line and tooltip for reference.
    -   **Deletion:** When a file is deleted via `deleteFile`, its corresponding `localStorage` entry is also removed to maintain consistency.

---

### 3. Internal File Naming Convention

-   **File(s) Affected:** `config/file_naming_config.ts`, `services/geminiCorpusService.ts`, `components/FileManagementPanel.tsx`
-   **Problem:** To provide clear, machine-readable context to the AI, we need a standardized way to classify files based on their purpose and scope. Relying on just the original filename is brittle and doesn't scale.
-   **Solution:** We have implemented a rule-based file naming system that prepends a structured prefix to files before they are uploaded to the Gemini API. This allows the application to programmatically identify and filter files for specific tasks.
    -   **Structure:** `__cc_[context]_[scope]__[original_filename]`
    -   **`__cc`**: The application prefix for Creator Cockpit (`cc`).
    -   **`[context]`**: The general purpose of the file (e.g., `content`, `instrux`, `corpus`).
    -   **`[scope]`**: Where the file applies (e.g., `global`, `spa`, `chat`).
    -   **`__` (Separator):** A double underscore is used to clearly separate the system-generated prefix from the user's original filename, making parsing more robust.
    -   **Source of Truth:** The complete mapping of file purposes to their respective `context` and `scope` prefixes is defined in `/src/config/file_naming_config.ts`. This is the single source of truth for the entire system.
    -   **Implementation:**
        -   User-facing uploads in the `FileManagementPanel` use this system via the "Purpose" dropdown.
        -   Programmatic uploads, such as those in `geminiCorpusService.ts`, also use this system to automatically classify generated files (e.g., `__cc_corpus_posts__all_posts.json`).

---

### 4. Dynamic File Metadata via Internal Naming Convention

-   **File(s) Affected:** `services/geminiFileService.ts`, `types.ts`, `config/file_naming_config.ts`
-   **Problem:** After establishing the internal naming convention (see #3), we needed a way to make the encoded information (`context`, `scope`) programmatically available on file objects throughout the application without extra API calls or complex lookups.
-   **Solution:** We have implemented a dynamic parsing system that enriches the `GeminiFile` object at the point of retrieval.
    -   **Mechanism:**
        1.  The `parseInternalFileName` function in `/src/config/file_naming_config.ts` uses a regular expression to deconstruct a prefixed filename (e.g., `__cc_content_global__brand-brief.md`) into its core components: `context`, `scope`, and `originalName`.
        2.  In `geminiFileService.ts`, the `processFileMetadata` function is called for every file retrieved from the Gemini API (`listFiles`, `getFile`).
        3.  This function attempts to parse the file's `displayName` using `parseInternalFileName`.
        4.  If successful, the `context` and `scope` properties (added to the `GeminiFile` interface in `types.ts`) are populated on the file object.
    -   **UI & Logic Implementation:** This enrichment allows other parts of the application, such as the various AI tools, to dynamically group and filter files based on their purpose without needing to re-parse the filename string. The `FileManagementPanel` now directly exposes this parsed data by displaying it in dedicated "Context" and "Scope" columns, making the classification of each file immediately visible to the user.

---

### 5. Protection of Corpus Files in File Management

-   **File(s) Affected:** `components/FileManagementPanel.tsx`
-   **Problem:** Core data integrity is at risk if users can accidentally delete individual files that are part of the synchronized corpus (e.g., `all_posts.json`). This would create an inconsistent state for all AI tools that rely on that data.
-   **Solution:** A protection mechanism has been implemented in the File Management panel to safeguard these critical files.
    -   **Identification:** Any file with a `context` of `corpus` (i.e., named with the `__cc_corpus_*` prefix) is identified as a protected file.
    -   **UI Safeguards:**
        1.  The selection checkbox for these files is disabled.
        2.  They are automatically excluded from "Select All" actions.
        3.  The standard delete icon is replaced with a distinct, blue **lock icon** to visually communicate their protected status.
        4.  A tooltip on the lock icon and a reduced row opacity further reinforce that these files are managed by the "Content Corpus" tool and cannot be deleted individually.

---

### 6. Application Startup Orchestration and Deadlock Prevention

-   **File(s) Affected:** `App.tsx`, `contexts/ContentContext.tsx`, `contexts/GeminiCorpusContext.tsx`
-   **Problem:** The application's initial data synchronization was getting stuck in a deadlock. The startup sequence created a circular dependency:
    1.  `App.tsx` waited for `ContentContext` to be ready before starting the Gemini corpus sync.
    2.  `ContentContext` waited for `GeminiCorpusContext` to be ready before loading its local documents.
    3.  `GeminiCorpusContext` waited for the sync to be triggered by `App.tsx`.
-   **Solution:** The deadlock was resolved by refactoring `ContentContext` to perform a two-stage load.
    1.  **Stage 1 (On Mount):** `ContentContext` immediately loads and classifies all local documents from the `/src/context_documents/` directory, without waiting for the Gemini sync. Once complete, it signals that it is ready (`isContextReady`).
    2.  **Orchestration:** This "ready" signal from `ContentContext` breaks the deadlock, allowing the main orchestrator in `App.tsx` to proceed and trigger the `syncCorpus` function.
    3.  **Stage 2 (Post-Sync):** After the `GeminiCorpusContext` status changes to `READY`, a `useEffect` in `ContentContext` filters its initial list of documents against the now-available list of synced files from the API. This ensures the UI only displays documents that were successfully uploaded, maintaining data consistency.

---

### 7. Semantic Versioning and Build System

-   **File(s) Affected:** `config/app_config.ts`, `App.tsx`, `/.idx/aide/GEMINI.md`
-   **Problem:** The application only tracked a daily build number, which is insufficient for managing formal releases with distinct feature sets, bug fixes, and major updates.
-   **Solution:** A dual-tracking system has been implemented to provide both granular build tracking and formal release versioning.
    -   **Semantic Versioning (`VERSION`):**
        -   Managed in `config/app_config.ts`, following the `[major].[minor].[maintenance]` format (e.g., `1.0.0`).
        -   This version number is intended to be updated deliberately to signify official releases.
        -   The AIDE command `#version [major|minor|maintenance]` is used to increment this number according to semantic versioning rules.
    -   **Build Number (`BUILD`):**
        -   Also managed in `config/app_config.ts`, following the `YYYYMMDD.build` format (e.g., `20250914.6`).
        -   This number is automatically incremented with every `#build` command and represents a specific deployment or set of changes within a given day.
    -   **UI Implementation:** The footer in `App.tsx` has been updated to display both the version and the build number (e.g., "Version 1.0.0 (Build 20250914.6)"), providing clear and comprehensive release identification.

---

### 8. DB-First File Synchronization

-   **File(s) Affected:** `contexts/GeminiCorpusContext.tsx`, `services/geminiFileService.ts`, `services/dbService.ts`
-   **Problem:** The application's file state could become inconsistent between the local cache and the remote Gemini API, leading to errors. The previous model, where the API was the source of truth, was brittle and did not support robust offline-first functionality.
-   **Solution:** A "DB-first" architecture has been implemented. The local IndexedDB is now the single source of truth for all file metadata and content. The Gemini Files API is treated as a provisioned mirror of this local state.
    -   **Source of Truth:** The `files` (metadata) and `file_contents` (raw `Blob` data) object stores in IndexedDB are the authoritative source for all files in the application.
    -   **Mechanism:**
        1.  All file creation events (user uploads, corpus processing, context document loading) now write the file's content and metadata to IndexedDB *first*, before any API interaction.
        2.  On every application startup, `GeminiCorpusContext` orchestrates a synchronization process.
        3.  It compares the list of files in the local DB with the list of files on the Gemini API.
            -   **Files to Upload:** Any file present in the DB but missing from the API is automatically uploaded from the `file_contents` store. The local metadata in the `files` store is then updated with the API response (e.g., the final `name` and `uri`).
            -   **Files to Delete:** Any file present on the API but *not* in the local DB (an "orphan") is automatically deleted from the API.
    -   **Outcome:** This architecture makes the application more resilient and offline-capable. The app always works with a consistent local state and self-heals by ensuring the remote API state matches it.

---

### 9. Atomic Database Restore and In-Place Refresh

-   **File(s) Affected:** `services/dbService.ts`, `components/DatabaseRestorer.tsx`, `contexts/DataContext.tsx`, `contexts/ContentContext.tsx`
-   **Problem:** The initial database restore feature was flawed. It was not atomic, which could lead to a corrupted or empty database if the import process failed midway. It also relied on a jarring full-page reload to refresh the application's state.
-   **Solution:** A more robust and user-friendly solution was implemented with two key architectural changes:
    1.  **Atomic Transaction:** The `dbService.importDB` function was re-architected. Instead of deleting and recreating the database (a non-atomic "nuke and pave" approach), the final, working solution uses a single, comprehensive IndexedDB transaction. Within this transaction, it first clears all existing object stores and then populates them with the data from the backup file. This ensures that the entire operation either succeeds completely or fails cleanly, leaving the original data intact and preventing database corruption.
    2.  **In-Place State Refresh:** The page reload was eliminated. After a successful database import, the `DatabaseRestorer` component now calls newly exposed `loadCorpus()` and `loadContext()` functions from the respective contexts. These functions force a complete re-read of all data from the now-restored IndexedDB into the application's React state. Finally, it triggers the `refreshSyncedFiles()` function to reconcile the remote Gemini API with the new local state. This provides a smooth, fast, in-place update without disrupting the user experience.

---

### 10. File Sync Mismatch After Database Restore

-   **File(s) Affected:** `contexts/GeminiCorpusContext.tsx`
-   **Problem:** After restoring a database, files generated by the corpus (`__cc_corpus_*`) were correctly uploaded to the Gemini API, but the local "Managed Files" panel showed outdated, local-only versions. This happened because the synchronization logic didn't account for a scenario where a local placeholder record (e.g., `name: "local/..."`) corresponds to a file that already exists on the API. The system would upload new files and delete orphaned ones, but it wouldn't *update* the local placeholder with the real API metadata (e.g., `name: "files/..."`).
-   **Solution:** An additional step was added to the synchronization process in `GeminiCorpusContext.tsx`. Before checking for files to upload or delete, a new loop iterates through the local database files. If it finds a file with a local placeholder name (`name.startsWith('local/')`) that has a matching `displayName` in the list of current API files, it performs a local update. It deletes the old placeholder record from the DB and inserts the complete, authoritative file record fetched from the API. This ensures that after a restore, all local records accurately reflect their synced, remote status.

---

### 11. Atomic "Nuke and Pave" Database Restore

-   **File(s) Affected:** `contexts/GeminiCorpusContext.tsx`, `components/DatabaseRestorer.tsx`
-   **Problem:** Restoring a database backup created complex data consistency issues. A simple reconciliation of files between the restored local DB and the existing remote Gemini API was brittle and prone to edge cases, such as stale local records pointing to old API file IDs.
-   **Solution:** To guarantee a perfectly consistent state, a "nuke and pave" strategy was implemented via the `forceResync` method.
    -   **Mechanism:**
        1.  When a restore is initiated, the `forceResync` function is called.
        2.  It first lists all files in the Gemini API and **deletes only the files managed by this application** (those with the `__cc` prefix), leaving other unrelated files untouched.
        3.  It then reads the full list of files from the newly restored local IndexedDB, which is now the absolute source of truth.
        4.  Finally, it re-uploads every file from the local DB to the now-clean remote API.
    -   **Outcome:** This atomic approach eliminates all reconciliation complexity and ensures that the remote API is always a perfect mirror of the restored local state, preventing any possibility of stale data.

---

### 12. Dynamic Context Data in UI Tools

-   **File(s) Affected:** `components/SocialPostAssistant.tsx`, `components/ChatAssistantPanel.tsx`, `components/QuoteFinder.tsx`
-   **Problem:** After a database restore, UI components that used context documents (e.g., brand briefs) were not reflecting the new data. The tools would throw "file not available" errors because they were holding onto a stale list of context documents that was cached by a `useMemo` hook.
-   **Solution:** The `useMemo` hook responsible for memoizing the list of `contextProfiles` was removed from all affected components.
    -   **Mechanism:** By removing the memoization, the `contextProfiles` variable is now re-calculated on every single render.
    -   **Outcome:** This ensures that immediately after the `ContentContext` is updated with new data (e.g., after a database restore), the UI components will instantly see and use the fresh list of documents. While this may cause a negligible increase in re-renders, it guarantees data freshness and resolves the stale state bug, which is a higher priority for application correctness.

---

### 13. Multi-Device Synchronization Model

-   **File(s) Affected:** `contexts/GeminiCorpusContext.tsx`, `hooks/useCorpusProcessor.tsx`
-   **Principle:** The application is designed to support a user working across multiple devices (e.g., a home desktop and a travel laptop). To enable this, the Gemini Files API is treated as the federated "source of truth" for the user's complete collection of files. Each local IndexedDB instance is a partial, synchronized snapshot.
-   **Synchronization Logic (`refreshSyncedFiles`):**
    -   On application startup, the system performs a bi-directional metadata merge.
    1.  It fetches all file metadata from the local DB and the remote API.
    2.  **Local to Remote:** Files existing in the local DB but not on the remote API are uploaded.
    3.  **Remote to Local:** Crucially, if a file exists on the API but not in the local DB (e.g., uploaded from another device), its metadata is downloaded and added to the local DB. The file content itself is not downloaded, but the file becomes visible and usable in tools like the Chat Assistant. This prevents one device from accidentally deleting another device's files during a standard sync.
-   **Corpus Upload (`useCorpusProcessor`):** A manual corpus upload is a "targeted replace" operation, not a full wipe of all remote files.
    1.  The new corpus data is processed and saved to the local database, overwriting any previous corpus and context data.
    2.  The system identifies the `displayName`s of all newly generated corpus assets AND all existing context documents.
    3.  It then connects to the Gemini API and deletes only the remote files that match these specific `displayName`s.
    4.  Finally, it triggers the standard `refreshSyncedFiles` process. This process sees the new local files as missing from the remote (because we just deleted the old versions) and uploads them. This preserves any other application-managed files (e.g., files uploaded via the Chat Assistant on another device) on the remote API, ensuring a safe and consistent update.

---

### 14. Dynamic UTM Campaign Generation

-   **File(s) Affected:** `components/SocialPostAssistant.tsx`, `components/QuoteFinder.tsx`
-   **Problem:** The `utm_campaign` parameter needs to be contextually relevant to the article being promoted. Manually setting this for every generation is tedious and error-prone.
-   **Solution:** A shared, dynamic logic pattern has been implemented in both the Social Post Assistant and the Callback Finder to automatically generate a relevant `utm_campaign` value.
    -   **Mechanism:**
        1.  A `slugify` helper function is used to convert a string (like an article title) into a URL-friendly format (e.g., "My Great Article" becomes "my-great-article").
        2.  A `useEffect` hook monitors the source of the content (URL, file upload, etc.).
        3.  If the source is a URL from the Substack corpus, it finds the matching post in the `DataContext` and uses its title to generate the slug.
        4.  If the source is a file upload, it uses the filename (minus the extension) as the source for the slug.
        5.  If the source is a custom URL or pasted text, it attempts to parse the page title (for URLs) or uses a generic fallback if no title is available.
    -   **UI Implementation:** The `utm_campaign` input field in the UI is populated with this dynamically generated value. The user can still override it manually if needed. This pattern ensures a consistent and meaningful default campaign name across different tools and workflows.

---

### 15. Establishing Persistent File Context in a Multi-Turn Chat

-   **File(s) Affected:** `components/ChatAssistantPanel.tsx`
-   **Problem:** For a multi-turn chat session, files intended as persistent context for the entire conversation were not being correctly "remembered" by the model, leading to hallucinations. Initial attempts to attach files to the `systemInstruction` or via the `ai.chats.create({ files: [...] })` method were ineffective.
-   **Solution:** The correct, documented pattern for the `@google/genai` SDK is to attach the persistent files as part of the **first user message** sent in the chat session.
    -   **Mechanism:**
        1.  When a new chat session is initiated (i.e., `chatRef.current` is null), create a clean chat session with only the `systemInstruction`: `ai.chats.create({ config: { systemInstruction } })`.
        2.  Construct the first user message as a multi-part array. This array must include the user's text prompt, any turn-specific files (e.g., from an attachment bar), AND all persistent context files (e.g., from "Corpus" or "Context" pills).
        3.  Send this comprehensive first message using `chat.sendMessageStream({ message: parts })`.
    -   **Outcome:** The Gemini API registers the files from this first turn as part of the chat's history. For all subsequent turns in that same `Chat` session, the model will automatically have access to this file context without needing the files to be re-sent. This is the authoritative method for establishing persistent file context in a multi-turn chat.

---

### 16. Resilient IndexedDB Connection Handling

-   **File(s) Affected:** `services/dbService.ts`
-   **Problem:** The IndexedDB database was not persisting data between browser sessions. The log indicated that an `onupgradeneeded` event was firing on every application load, suggesting the database was being re-initialized instead of loaded. This is often caused by stale or unexpectedly closed connections, especially in multi-tab environments.
-   **Solution:** To ensure a stable and persistent database connection, the `initDB` service was made more resilient by adding two critical event handlers to the `IDBDatabase` instance itself:
    1.  **`onversionchange`**: This event is fired when a different browser tab requests a database upgrade. The correct response is to immediately close the current connection (`db.close()`) to allow the upgrade process to proceed without being blocked. This prevents stale connections.
    2.  **`onclose`**: This event is fired if the database connection is closed unexpectedly (e.g., by the browser's resource management).
    -   **Mechanism:** In both handlers, the memoized `dbPromise` is set to `null`. This forces the next call to `initDB()` to re-establish a fresh connection from scratch, rather than returning the now-defunct one.
-   **Outcome:** This pattern ensures that the application always works with a valid database connection, resolving the persistence issue and improving overall stability.

---

### 17. Dynamic Prompt Loading Architecture

-   **File(s) Affected:** `services/promptService.ts`, `config/prompts_config.ts`, `src/prompts/`
-   **Problem:** Hardcoding AI prompt templates as multiline strings directly within `promptService.ts` was inflexible. It made editing prompts cumbersome, required a full application rebuild for minor text changes, and tightly coupled prompt content with application logic.
-   **Solution:** A data-driven, dynamic loading architecture was implemented to externalize all prompt content.
    -   **Mechanism:**
        1.  All prompt templates (both system instructions and user-facing prompts) are now individual `.md` files located in the `/src/prompts/` directory.
        2.  The `prompts_config.ts` file acts as a manifest, defining a unique `id` and `filePath` for each prompt.
        3.  On application startup, the `promptService.initPrompts()` function is called. It iterates through the manifest, uses `fetch()` to load the content of each markdown file, and stores it in an in-memory `Map` (`loadedPrompts`) keyed by the prompt's ID.
        4.  The `promptService.getPromptContent(id)` function provides fast, synchronous access to the pre-loaded prompt content from anywhere in the application.
    -   **Outcome:** This architecture decouples prompt management from application code. Prompts can now be edited and refined easily by modifying the markdown files directly. Adding new prompts is as simple as creating a new file and adding a corresponding entry to the configuration manifest, with no changes needed to the core service logic. This makes the system more modular, maintainable, and scalable.