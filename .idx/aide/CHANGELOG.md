## Version 1.6.0 (Build 20251102.2)

*   **FEAT (File Management):** Enhanced file status display in the File Management panel. Files are now explicitly categorized as 'Local only', 'API only (temporary)', or 'Synced' based on their presence in the local database and on the Gemini API. A 'Sync status unknown' fallback is also included.
*   **FIX (File Management):** Resolved a race condition in `dbService.ts` that caused the database purge to be blocked. A 100ms delay was added after closing the IndexedDB connection to ensure successful deletion.
*   **REFACTOR (File Management):** Removed the `apiFileNames` state variable from `FileManagementPanel.tsx` as it is no longer needed with the new file status logic.

# Changelog

## Version 1.5.0 (Build 20251102.1)

*   **Feature:** Added a "Purge Database" button to the Prompt Inspector modal. This provides a developer utility to clear all application data from IndexedDB.
*   **Fix:** Resolved an issue where the Prompt Inspector was not displaying prompt content. The panel now correctly initializes the `promptService` and dynamically loads the content for the selected prompt.

All notable changes to this project will be documented in this file.

---

### **Build 20251021.3** - 2025-10-21

-   **FIX (Database):** Enhanced IndexedDB connection handling in `dbService.ts` by adding `onclose` and `onversionchange` event listeners. This resolves a persistence issue where the database was not being retained between sessions by making the connection more resilient to unexpected closures.

### **Build 20251021.2** - 2025-10-21

-   **FEAT (QuoteFinder):** Added a dropdown menu to the Callback Finder for selecting UTM tag presets. This centralizes UTM configuration, mirroring the functionality of the Social Post Assistant. A new "Substack Callback" preset was also added as the default for this tool.

### **Build 20251021.1** - 2025-10-21

-   **FEAT (UI/UX):** Replaced the "information" icon with a "paperclip" icon for the "Attach Existing File" button in the Chat Assistant panel to provide a more intuitive and conventional user experience.

### **Build 20251020.1** - 2025-10-20

-   **REFACTOR (Architecture):** Performed a major refactor of the AI prompt system. All system instructions and user prompt templates have been externalized into individual markdown files within a new `/src/prompts/` directory. A new `promptService` now manages the loading and retrieval of these prompts, centralizing logic and preparing the application for future integration with a managed prompt solution.
-   **FIX (Chat Assistant):** Corrected the file attachment logic to align with the official Gemini API pattern for multi-turn chat. Persistent context files (from "Corpus" and "Context" pills) are now correctly included in the *first user message* of a new session, ensuring they are retained in the chat history and resolving model hallucinations.
-   **FEAT (Chat Assistant):** Added a "Stop" button that appears during response generation, allowing the user to cancel a streaming response from the AI.
-   **UX (Chat Assistant):** Restored and improved several key UI features:
    -   The "New Chat" button has been reinstated in the panel footer.
    -   The "Copy Response" button now appears on hover for each AI message.
    -   The teal "Corpus Data" toggle pills have been restored to the bottom of the panel.
    -   A warning message now appears if context is changed mid-conversation, prompting the user to start a new chat.
    -   The layout has been corrected so that AI response bubbles span the full width of the panel for better readability.
-   **DOCS (AIDE):** Updated the AIDE command prefix from `!` to `#` across all internal documentation files (`README.md`, `BACKLOG.md`, `REFERENCE.md`).

### **Build 20250920.1** - 2025-09-20

-   **FIX (Chat Assistant):** Implemented an automatic file synchronization on load. The Chat Assistant now fetches the latest file list from the Gemini API when it opens, ensuring that the corpus pills and file attachments always reflect the true state of the remote storage, preventing errors from stale or missing files.
-   **FEAT (Chat Assistant):** Implemented a file status polling system to prevent errors caused by sending prompts with files that are still processing. The UI now provides clear visual feedback with a spinner for processing files and an error icon for failed uploads.
-   **FEAT (Chat Assistant):** Added a new "Corpus" section to the Chat Assistant header, with toggle pills that allow users to easily include key data files (Posts, Subscribers, Opens, Deliveries) in the chat context.
-   **FIX (UI):** Refined the layout of the Chat Assistant header, removing extra vertical space to create a more compact and polished appearance.

### **Build 20250917.2** - 2025-09-17

-   **FEAT (UTM Tagging):** Added a comprehensive UTM tagging feature to the "Callback Finder," mirroring the functionality of the Social Post Assistant. The `utm_campaign` field is now dynamically populated from the article title, and the default source is set to `substack-callback`.
-   **FEAT (UI/UX):** Replaced the regeneration icon in both the "Callback Finder" and the "Social Post Assistant" with a new, consistent circular refresh icon to improve visual language across the application.
-   **UX (UTM Tagging):** The layout of the UTM form in the Callback Finder was updated to place the campaign and term fields on the same line for a cleaner, more consistent user experience.

### **Build 20250917.1** - 2025-09-17

-   **FEAT (Multi-Device Sync):** Re-architected the Content Corpus upload process to support multi-device workflows. The system now performs a "targeted replace," deleting only previous versions of corpus and context files from the Gemini API before syncing the new versions, preserving all other user files.
-   **FEAT (UI/UX):** The File Management panel now groups files into "User-managed" and "Application-managed" sections on first load, with user-editable files sorted to the top. This provides a clearer and more intuitive view of the file list.
-   **DOCS (AIDE):** Added a new architectural note to the internal reference (`/.aide/REFERENCE.md`) to formally document the multi-device synchronization model.

### **Build 20250914.12** - 2025-09-14

-   **FIX (DB Restore):** Improved the resilience of the database restore process. The file re-upload logic now gracefully handles and skips any orphaned file records (metadata without content) that may exist in a backup, preventing errors and ensuring the synchronization process completes successfully.

### **Build 20250914.11** - 2025-09-14

-   **REFACTOR (Startup):** Optimized the application's startup sequence by eliminating a redundant data synchronization. The initial sync now intelligently waits for all local data contexts to be fully loaded, preventing a premature sync on an empty database and improving efficiency.
-   **REFACTOR (DB Restore):** Re-architected the database restore process to be more resilient and safe. The post-restore synchronization now performs a "nuke and pave" operation, deleting all application-managed files from the Gemini API and re-uploading the complete set from the newly restored local database. This guarantees a perfectly consistent state.
-   **FIX (DB Restore Safety):** The remote file deletion process during a database restore is now scoped to only remove files managed by this application (i.e., those with a `__cc` prefix), preventing the accidental deletion of unrelated files in the user's Gemini project.
-   **FIX (Stale State):** Resolved a critical bug where UI tools would use stale context data after a database restore. The logic was updated to ensure that components always fetch the latest context information on every render, guaranteeing data freshness.
-   **FIX (Data Sync):** Implemented a fix to ensure that when a context document is uploaded or deleted in the File Management tool, the corresponding record is correctly added or removed from the `context_documents` database, ensuring data consistency between the file system and the context system.
-   **CHORE (Dependencies):** Corrected multiple invalid module import paths that were using non-standard aliases, resolving application startup errors.

### **Build 20250914.10** - 2025-09-14

-   **FIX (DB Restore Sync):** Overhauled the file synchronization logic in `GeminiCorpusContext` with a more robust, two-pass reconciliation algorithm. This fixes a critical bug where restoring a database could lead to stale file records in the UI. The new logic correctly treats the local DB as the source of truth, uploading missing files, deleting orphaned API files, and updating stale local records to ensure perfect synchronization after a restore or any other file operation.

### **Build 20250914.9** - 2025-09-14

-   **FIX (DB Restore Sync):** Patched the file synchronization logic in `GeminiCorpusContext` to correctly handle files that exist locally as placeholders after a database restore but are already present in the Gemini API. The new logic identifies these placeholders and updates them with the authoritative API metadata, resolving an issue where corpus-generated files (`__cc_corpus_*`) would show stale, local-only data in the File Management panel after a restore. This ensures data consistency while maintaining the DB-first architecture.

### **Build 20250914.8** - 2025-09-14

-   **FEAT (Data Portability):** Implemented a comprehensive database backup and restore feature.
    -   The "Export Packager" can now generate a complete, compressed (`.zip`) backup of the application's local IndexedDB.
    -   A new "Database Restore" tool allows users to upload a backup file via click or drag-and-drop to completely restore the application's state.
-   **FIX (DB Restore):** Re-architected the database import process to be fully atomic. The new logic uses a single transaction to clear and repopulate all data stores, preventing crashes and data corruption from partial restores.
-   **UX (DB Restore):** The database restore process no longer requires a disruptive full-page reload. It now performs a smooth, in-place refresh of all application data contexts and automatically synchronizes the remote Gemini Files API to mirror the newly restored state.

### **Build 20250914.7** - 2025-09-14

-   **REFACTOR (Architecture):** Completed a major architectural overhaul to implement a "DB-first" file synchronization model. The application's local IndexedDB is now the single source of truth for all files. On startup, a new synchronization process reconciles this local state with the Gemini Files API, a-utomaticsally uploading missing files and deleting orphaned ones to ensure the remote API is always a mirror of the local database.
-   **FEAT (Database):** Added a new `file_contents` object store to IndexedDB to persist the raw `Blob` content of all files, enabling the new DB-first synchronization and upload process.
-   **REFACTOR (Services & Components):** Refactored `geminiFileService`, `geminiCorpusService`, `FileManagementPanel`, `ContentContext`, and `useCorpusProcessor` to support the new DB-first architecture, ensuring all file operations are persisted locally before any remote API interaction.

### **Build 20250914.6** - 2025-09-14

-   **FEAT (Versioning):** Implemented a formal semantic versioning system (`major.minor.maintenance`) for the application, initializing at version `1.0.0`.
-   **FEAT (AIDE):** Added a new `!version [major|minor|maintenance]` command to allow for programmatic version increments.
-   **REFACTOR (UI):** The application footer has been updated to display both the version and build numbers for clearer release tracking.

### **Build 20250914.5** - 2025-09-14

-   **FIX (Startup):** Resolved a critical application deadlock that occurred during the initial data synchronization. Refactored `ContentContext` to load local documents immediately, breaking the circular dependency between `App`, `ContentContext`, and `GeminiCorpusContext`, ensuring a reliable startup sequence.

### **Build 20250914.4** - 2025-09-14

-   **FEAT (File Management):** Implemented protections for corpus-generated files (`__cc_corpus_*`). These files are now visually distinguished, and their selection checkboxes and delete buttons are disabled to prevent accidental deletion and maintain data integrity.
-   **FEAT (UI/UX):** Replaced the disabled delete icon for protected corpus files with a clear, blue lock icon to better signify their protected status.
-   **REFACTOR (UI):** Updated the labels for tool-specific file purposes in the "Purpose" dropdown to be more descriptive (e.g., "Instructions (Social Post Assistant)").

### **Build 20250914.3** - 2025-09-14

-   **FIX (File Management):** The "select all" checkbox in the file management table now correctly operates only on the files visible on the current page, preventing unintended selections across all pages.
-   **FIX (UI):** Corrected a pagination display bug in the file management table that would incorrectly show "Page 1 of 0" when no files were present.
-   **REFACTOR (UI):** Removed the asterisk indicator for locally cached filenames from the main file table and the "Attach Existing Files" modal, as this indicator was no longer providing useful information.

### **Build 20250914.2** - 2025-09-14

-   **FEAT (File Naming):** Expanded the "Purpose" dropdown in File Management to include explicit, tool-specific options for "Instructions" and "Reference" material, allowing for more granular file classification.
-   **REFACTOR (AI Tools):** Refactored the Social Post Assistant, Chat Assistant, and QuoteFinder tools to correctly filter for and use their own tool-specific context documents, preventing context leakage between tools and improving AI response accuracy.
-   **FEAT (File Management):** The file management table now displays the user-provided filename instead of the internal prefixed name. The user's original name is cached in local storage during upload to ensure a consistent and user-friendly experience.
-   **FEAT (File Management):** Added two new sortable columns, "Context" and "Scope," to the file management table, providing at-a-glance metadata about each file's purpose.
-   **REFACTOR (File Service):** Updated the `geminiFileService` to support a `cacheAs` option during file upload, enabling more explicit control over local display name caching.

### **Build 20250914.1** - 2025-09-14

-   **FIX (Corpus Service):** Refactored `geminiCorpusService.ts` to correctly handle pre-prefixed filenames, removing redundant logic that incorrectly applied the prefix a second time.
-   **FEAT (Context System):** Added support for a new `reference` context type to the file naming configuration, enabling the classification of knowledge-base style documents.
-   **REFACTOR (Context Logic):** Replaced hardcoded filename logic in `ContentContext.tsx` with a dynamic system that parses `__cc_` prefixed filenames to correctly assign documents to UI profiles.
-   **FEAT (File Metadata):** Enriched the `GeminiFile` object with `context` and `scope` properties, which are now automatically populated by parsing the internal filename on fetch, making file metadata more structured and accessible.
-   **DOCS (AIDE):** Updated `CONTEXTMAP.md` to include the new `reference` context type and added documentation for the dynamic metadata parsing system to `REFERENCE.md`.

### **Build 20250913.4** - 2025-09-13

-   **FEAT (File Naming):** Added new `corpus` context prefixes (`opens`, `delivers`, `posts`, `subscribers`) to programmatically classify files generated from the Substack export.
-   **REFACTOR (File Naming):** Refined the internal file naming convention to use a double underscore (`__`) as the final separator between the system prefix and the original filename for improved readability and parsing.
-   **FEAT (File Management):** Enforced a 256-character limit on user-provided filenames in the upload form.
-   **REFACTOR (Config):** Removed the redundant "no prefix" general file purpose to streamline user choices and rely on the more explicit "Global Document" option.
-   **FIX (QuoteFinder):** Updated the tool's logic to dynamically find the `all_posts.json` file, ensuring its functionality is compatible with the new prefixed naming convention.
-   **DOCS (AIDE):** Updated `CONTEXTMAP.md` and `REFERENCE.md` to reflect all changes to the file naming system.

### **Build 20250913.3** - 2025-09-13

-   **UX (File Management):** Refactored the file upload form into a clean, three-row grid layout to improve visual organization and user experience by aligning labels, controls, and descriptions horizontally.

### **Build 20250913.2** - 2025-09-13

-   **FEAT (File Management):** Implemented a rule-based internal file naming system (`__[app]_[context]_[scope]_[name]`) to standardize file classification for the AI. This includes a new "Purpose" dropdown on the upload form to automate the naming process.
-   **REFACTOR (Config):** Centralized all file naming rules into a new `config/file_naming_config.ts` file, making the system scalable and the single source of truth.
-   **FEAT (AIDE):** Introduced `!map` and `!backlog` commands for managing the application map and feature backlog, and created `/.aide/BACKLOG.md`.
-   **FEAT (AIDE):** Created a technical `REFERENCE.md` to document non-obvious solutions, seeded with entries for the Gemini `displayName` implementation and the local caching system.
-   **DOCS (AIDE):** Created `CONTEXTMAP.md` to document the new file naming convention and updated the internal `README.md` to include new commands and documentation workflows.
-   **FIX (Docs & Comments):** Corrected documentation and code comments to accurately reflect that a previous `displayName` issue was due to unclear SDK documentation, not an API bug.

### **Build 20250913.1** - 2025-09-13

-   **AIDE:** Confirmed session date using the `!date` command.

### **Build 20250907.3** - 2025-09-07

- **FEAT (UI/UX):** Increased the width of the AI's response bubbles in the Chat Assistant to use the full available space. This improves readability for longer messages and code blocks while maintaining the narrower width for user messages to preserve the conversational layout.

### **Build 20250907.2** - 2025-09-07

- **FEAT (Chat Assistant):** Implemented a new "Attach URL(s)" feature, allowing users to add up to five URLs to a chat session. The application fetches the content from these URLs and includes it in the prompt sent to the Gemini API, providing richer context for more accurate responses.
- **FEAT (UI/UX):** Created a new URL Picker modal for the Chat Assistant that allows users to add, view, and remove attached URLs in a centralized place.
- **REFACTOR (Prompts & Services):** Updated the Chat Assistant's system prompt and the backend Gemini service to properly handle and integrate the content fetched from user-provided URLs.

### **Build 20250907.1** - 2025-09-07

- **FIX (QuoteFinder):** Implemented a robust JSON parsing function to handle cases where the Gemini API returns JSON wrapped in markdown, preventing application errors and improving the reliability of the QuoteFinder tool.
- **FEAT (UI/UX):** Generated a new, cleaner "Refresh" icon with a circular "redo" design and applied it to the "Regenerate Callback" button in the QuoteFinder tool for better user experience.
- **REFACTOR (Prompts):** Updated all JSON-generating prompts for the QuoteFinder tool to more strongly reinforce that the AI must only return raw JSON content, improving parsing reliability.

### **Build 20250906.5** - 2025-09-06

- **FEAT (Rich Text Formatting):** Implemented a comprehensive overhaul of the Chat Assistant's response formatting. The AI is now instructed to generate rich HTML, and the UI has been styled to support headings, lists (including nested), tables, code blocks, blockquotes, links, alert boxes, and a curated palette of text colors.
- **FEAT (AI Configuration):** Added a "Content Safety Settings" section to the Global AI Settings panel, allowing users to configure the blocking threshold for Harassment, Hate Speech, Sexually Explicit, and Dangerous Content. These settings are now applied to all relevant AI calls.
- **FEAT (UI/UX):**
    - Added a "Copy Response" button to the Chat Assistant that copies the AI's output as rich text (HTML), preserving all formatting when pasted into applications like Google Docs.
    - Refactored the Global AI Settings panel to use a more spacious two-column layout, improving organization and user experience.
- **FEAT (Error Handling & Debugging):**
    - The application now gracefully handles responses blocked by the new content safety filters, displaying a clear, user-friendly error message instead of "undefined".
    - Implemented a new "DEBUG" logging level that, when enabled, outputs the full, raw response from all Gemini API calls to the console for easier troubleshooting.
- **FIX (UI/UX):** Applied numerous iterative styling fixes to the Chat Assistant's output to improve readability and visual consistency, including correcting heading sizes and spacing, fixing list indentation and margins, normalizing font sizes, and ensuring paragraph breaks are handled correctly.

### **Build 20250906.4** - 2025-09-06

- **FEAT (UI/UX):** Added the current AI model name and a shortcut to AI settings in the header of all AI-powered tool panels (`Social Post Assistant`, `Chat Assistant`, `QuoteFinder`). This provides users with immediate visibility and quick access to model configuration.
- **REFACTOR (UI):** Removed the redundant model name label from the `Chat Assistant` panel to declutter the interface, as this information is now centralized in the main panel header.

### **Build 20250906.3** - 2025-09-06

- **FEAT (AI Configuration):** Added a "Dynamic Budget" option for AI models with thinking capabilities. When enabled, the model's thinking budget is set to a default value of -1, allowing for dynamic resource allocation by the model.
- **FEAT (UI/UX):** The Global AI Settings panel now includes a "Dynamic Budget" checkbox. When active, the manual thinking budget slider is disabled to prevent conflicting settings.
- **REFACTOR (Settings):** Improved the loading of user settings from localStorage to ensure that new configuration options (like Dynamic Budget) are correctly applied even if an older settings object is stored.

### **Build 20250906.2** - 2025-09-06

- **FEAT (UI/UX):**
    - Changed the icon for the 'Debug View' tool to a more thematic ladybug icon.
    - Changed the icon for the 'Regression Tests' tool to a clipboard and pencil icon to better represent test management.
- **FEAT (Regression Testing):**
    - Added 'All On' and 'All Off' buttons to the Regression Tests panel, allowing for bulk enabling/disabling of test conditions.
    - All regression tests are now enabled by default when Test Mode is activated.

### **Build 20250906.1** - 2025-09-06

- **FEAT (Regression Testing):**
    - Implemented a new "Test Mode" framework, activated by a toggle on the main cockpit. When enabled, a "Regression Tests" tool becomes available.
    - Added the first test case, "Name Cache Test," which validates the local display name caching feature.
    - When this test is active, the app automatically uploads `cache_test.txt` with a different internal name (`__cc_test_cache_test.txt`) but displays the user-friendly name (`cache_test.txt`) in the File Management UI.
- **REFACTOR (File Management):**
    - The `GeminiFile` data structure was updated to hold both the API's `displayName` and a new `cachedDisplayName`.
    - The File Management UI now preferentially displays the `cachedDisplayName`, while the original API name remains available in the file's detailed info modal.
- **CHORE (File Structure):** Created a new `/src/reg_test/` directory to house assets for regression testing.

### **Build 20250901.4** - 2025-09-01

- **FIX (Corpus Processing):** Updated the corpus processing logic to correctly identify and discard draft posts. Drafts are defined as records in `posts.csv` with a null or empty `post_date`, and they are now filtered out to ensure that neither their metadata nor their content files are loaded into the application.

### **Build 20250901.3** - 2025-09-01

- **FEAT (QuoteFinder):** Implemented a flexible new input system for the "Callback Finder" that supports multiple content sources. Users can now provide the working article by fetching it from a URL, pasting rich text directly, or uploading a text-based file (`.html`, `.txt`, `.md`).
- **UX (QuoteFinder):** Replaced the static text input area with a clean dropdown selector to manage the different input modes, improving the tool's usability and clarity.
- **REFACTOR (QuoteFinder):** Added robust backend logic to handle the new input methods, including a CORS proxy for URL fetching and intelligent HTML parsing to isolate the main article content.

### **Build 20250901.2** - 2025-09-01

- **FEAT (QuoteFinder):** Integrated the new "QuoteFinder" tool, a powerful editorial assistant with two modes: "Quote Mode" for finding exact, standalone quotes, and "Callback Mode" for composing contextual sentences that link new drafts to existing work.
- **FEAT (Context Profiles):** Replaced the single "Include Brand Context" checkbox with a more granular "Context Profiles" system. Users can now use toggle chips (e.g., "Brand Voice," "Author Persona") in each AI tool to precisely control which context documents are included in the prompt.
- **REFACTOR (Context Logic):** The system now intelligently assigns documents to context profiles by prioritizing hints in filenames (e.g., "author," "brand"), improving accuracy and scalability.
- **UX (UI Consistency):**
    - The "Content Context" panel has been updated to group documents by their assigned profile, matching the new toggle chips for better clarity.
    - The context profile chips in the Chat Assistant now display a document count, ensuring a consistent user experience across all tools.
- **CHORE (UI):** Reordered the tools on the main cockpit screen to better match the user's workflow and adjusted the active status of several tools.

### **Build 20250901.1** - 2025-09-01

- **FIX (Files API):** Patched the file upload service to handle JSON files (`.json`, `.jsonl`) by appending a `.txt` extension and setting the MIME type to `text/plain` before upload. This works around a known Gemini API issue (GMN-ERR-5002) where JSON files can be misinterpreted as tool schemas, causing 500 errors. The original filename is preserved as the `displayName` for UI consistency.

### **Build 20250831.5** - 2025-08-31

- **FEAT (Social Post Assistant):** Implemented a comprehensive UTM tagging feature. The new collapsible panel is enabled by default and intelligently pre-populates `utm_source`, `utm_medium`, and `utm`