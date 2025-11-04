# Service & Data Flow Map (SERVICEMAP)

This document maps the flow of data and responsibilities between the core services and hooks in the Creator Cockpit application. It clarifies the "how" behind the application's DB-first architecture, focusing on the interactions that drive data synchronization and processing.

## 1. Core Service & Hook Responsibilities

This section provides a high-level summary of each key module's role in the data flow.

---

### **`dbService.ts`**

-   **File Path:** `services/dbService.ts`
-   **Core Responsibility:** Manages all interactions with the browser's IndexedDB. It is the application's single source of truth for all persistent data, including file metadata and content.
-   **Key Functions:**
    -   `getItem()`, `getAll()`, `putItem()`: Standard CRUD operations for IndexedDB object stores.
    -   `purgeDatabase()`: Wipes all data from all object stores.
    -   `exportDatabase()`: Exports the entire database content into a compressed `.zip` file.
    -   `importDatabase()`: Atomically wipes the existing database and restores it from a backup file.

---

### **`geminiFileService.ts`**

-   **File Path:** `services/geminiFileService.ts`
-   **Core Responsibility:** Acts as the low-level wrapper for the `@google/genai` SDK, handling all direct communication with the Gemini Files API. It is the gateway to the remote file store.
-   **Key Functions:**
    -   `listGeminiFiles()`: Fetches the metadata for all files from the remote API.
    -   `uploadFile()`: Uploads a file's content to the API.
    -   `deleteFileFromCorpus()`: Deletes a file from the remote API and also removes its corresponding records from the local IndexedDB (`files` and `file_contents` stores).
    -   `ensureRemoteFileExists()`: Provides "just-in-time" file validation. Before a file is used in a prompt, this function is called to check if it still exists on the remote API. If it has expired or is missing, this function automatically re-uploads the content from the local DB and returns the new, valid file object, preventing API errors.
    -   `registerLocalFile()`: The primary entry point for adding a new file to the system. It saves the file's metadata and content blob to IndexedDB via `dbService`, queuing it for the next sync cycle.

---

### **`useCorpusProcessor.tsx`**

-   **File Path:** `hooks/useCorpusProcessor.tsx`
-   **Core Responsibility:** Encapsulates all business logic for parsing and processing a raw Substack `.zip` export. It acts as the engine that transforms raw data into structured data and file assets.
-   **Key Functions:**
    -   It reads the `.zip` file in memory.
    -   It uses `corpusProcessingService` to parse the CSVs into structured JSON.
    -   It calls `geminiCorpusService.registerCorpusFiles()` to save the generated JSON files (e.g., `all_posts.json`) and all individual post `.html` files into IndexedDB, preparing them for synchronization.

---

### **`geminiCorpusService.ts`**

-   **File Path:** `services/geminiCorpusService.ts`
-   **Core Responsibility:** Orchestrates the registration of processed data into the local database. It acts as a bridge between the high-level processing hooks (like `useCorpusProcessor`) and the low-level database services.
-   **Key Functions:**
    -   `registerCorpusFiles()`: Takes the output from the corpus processor and uses `geminiFileService.registerLocalFile()` to save each generated file (posts, subscribers, HTML content, etc.) into IndexedDB.

---

### **`promptService.ts`**

-   **File Path:** `services/promptService.ts`
-   **Core Responsibility:** Loads, caches, and provides on-demand access to all external AI prompt templates. It decouples prompt content from application logic.
-   **Data Flow:** On application startup, it reads a manifest from `prompts_config.ts` and uses `fetch()` to load the content of each corresponding `.md` file from `src/prompts/` into an in-memory `Map`.
-   **Key Functions:**
    -   `initPrompts()`: The initialization function that pre-loads all prompts into the cache.
    -   `getPromptContent()`: Provides synchronous access to the cached content of a specific prompt by its ID.

## 2. Key Workflow Sequences

This section details the step-by-step data flow for the application's most critical and complex operations.

---

### **Workflow 1: Application Startup & Sync**

This is the primary data synchronization process that runs on every application load.

1.  **Initiation:** `App.tsx` mounts the `GeminiCorpusContext`.
2.  **Trigger:** The `useEffect` hook in `GeminiCorpusContext` calls `syncCorpus()`.
3.  **Fetch Local State:** `syncCorpus()` calls `dbService.getAll('files')` to retrieve the metadata for all files that *should* exist, as defined by the local database (the source of truth).
4.  **Fetch Remote State:** It then calls `geminiFileService.listGeminiFiles()` to get the current state of the remote API.
5.  **Reconciliation:** The context compares the two lists:
    -   Files in the local DB but not on the API are added to an `uploadQueue`.
    -   Application-managed (`__cc_*`) files on the API but not in the local DB are added to a `deleteQueue`.
6.  **Execution:**
    -   For each file in the `uploadQueue`, it retrieves the content blob from the `file_contents` store (via `dbService`) and uploads it using `geminiFileService.uploadFile()`.
    -   For each file in the `deleteQueue`, it calls `geminiFileService.deleteFileFromCorpus()` (which only deletes the remote file in this specific sync context, not the local record which is already gone).

---

### **Workflow 2: New File Upload (from File Management)**

This flow describes how a user-added file is integrated into the system.

1.  **User Action:** The user selects a file and clicks "Register File" in the `FileManagementPanel.tsx` component.
2.  **Local Registration:** The component calls `geminiFileService.registerLocalFile()`.
3.  **DB Persistence:** This service function performs two database operations via `dbService`:
    -   It saves the file's metadata (name, type, purpose-derived internal name, etc.) to the `files` object store.
    -   It saves the file's raw `Blob` content to the `file_contents` object store.
4.  **Queueing for Sync:** The file now exists in the local database. The main `syncCorpus()` process (from Workflow 1) will automatically discover it on the next application load or when a manual sync is triggered, identify it as missing from the API, and upload it.

---

### **Workflow 3: Database Restore**

This flow outlines the "nuke and pave" process for restoring state from a backup.

1.  **User Action:** The user uploads a backup `.zip` file in the `DatabaseRestorer.tsx` component.
2.  **Atomic Import:** The component calls `dbService.importDatabase()`. This service function completely wipes all existing data from all IndexedDB object stores and then repopulates them from the backup file within a single, atomic transaction to prevent partial states.
3.  **Trigger Force Resync:** Upon successful import, the UI calls `GeminiCorpusContext.forceResync()`.
4.  **Remote Purge ("Nuke"):** `forceResync()` first calls `geminiFileService.listGeminiFiles()` to get all remote files. It then iterates through this list and calls `geminiFileService.deleteFileFromCorpus()` for every file that is application-managed (i.e., has the `__cc_` prefix). This clears the remote slate of all app data without touching other user files.
5.  **Standard Sync ("Pave"):** After the remote purge is complete, `forceResync()` calls the standard `syncCorpus()` function. Since the remote is now empty and the local DB is fully restored, the sync process (Workflow 1) will treat every file in the local DB as "missing" and re-upload the entire set, guaranteeing a perfectly mirrored state.

---

### **Workflow 4: Prompt Loading & Retrieval**

This flow details how AI prompt templates are loaded and accessed.

1.  **Initiation:** `App.tsx` mounts.
2.  **Trigger:** A `useEffect` hook within `App.tsx` calls `promptService.initPrompts()`.
3.  **Read Manifest:** The service reads the `prompts_config.ts` file, which contains an array of prompt objects, each with a unique `id` and `filePath`.
4.  **Fetch & Cache:** It iterates through the manifest. For each prompt, it uses a dynamic `fetch()` call to read the raw text content of the specified markdown file from the `/src/prompts/` directory.
5.  **Store in Memory:** The fetched content is stored in an in-memory `Map` within the `promptService`, keyed by the prompt's `id`.
6.  **Synchronous Access:** When any other part of the application (e.g., `SocialPostAssistant`, `QuoteFinder`) needs a prompt, it calls `promptService.getPromptContent('prompt-id')`. The service synchronously returns the requested content from its cache.