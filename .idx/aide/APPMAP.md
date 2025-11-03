# Application Map (APPMAP)

This document provides a comprehensive map of the Creator Cockpit application's structure. It serves as a quick reference for understanding the purpose and location of all major components, services, and configuration files.

## Root Level

-   **`index.html`**: The main HTML entry point for the application. Loads Tailwind CSS, sets up the import map for modules, and contains the root element for the React app.
-   **`index.tsx`**: The main TypeScript entry point. Renders the root React component (`App`) and wraps it in necessary context providers.
-   **`App.tsx`**: The root React component. Manages the main application layout, tool selection, renders the active tool panel or the main cockpit view, and initializes the `promptService` on startup.
-   **`types.ts`**: Contains all shared TypeScript type definitions and interfaces used across the application.
-   **`metadata.json`**: Provides metadata for the application, including its name, description, and permissions requests (e.g., camera, microphone).

## Components (`src/components`)

This directory contains all reusable React components that form the user interface.

### UI Components

-   **`ChatAssistantPanel.tsx`**: The main UI for the chat assistant feature. It handles messages, streaming responses, attaching files and URLs, and allows for stopping generation. It includes context via "Context Profile" and "Corpus Data" pills and uses `promptService` for its system instructions.
-   **`CockpitButton.tsx`**: A standardized, reusable button component used on the main dashboard for selecting tools.
-   **`ConfirmationModal.tsx`**: A generic modal component for confirming user actions, such as deletions.
-   **`ContentContextPanel.tsx`**: A panel that displays all loaded and classified context documents, grouped by their profile.
-   **`ContentCorpusUploader.tsx`**: The UI for uploading the Substack export .zip file.
-   **`DatabaseRestorer.tsx`**: A tool that provides a UI for uploading a database backup file to perform a "wipe and replace" restoration of the application's state.
-   **`DebugPanel.tsx`**: A developer-focused panel that displays the current in-memory state of the application for debugging.
-   **`ExportPackager.tsx`**: The UI for exporting processed corpus data and the entire application database into different formats (CSV, JSON, ZIP).
-   **`FileManagementPanel.tsx`**: A comprehensive panel for users to view, upload, and delete files. It reflects the state of the local IndexedDB, which is the application's source of truth. The "Register File" action saves files locally, queuing them for the main sync process. It now explicitly categorizes files as 'Local only', 'API only (temporary)', or 'Synced' based on their presence in the local database and on the Gemini API, with a 'Sync status unknown' fallback. It also includes a "Purge Databases" button for clearing all application data from IndexedDB and the Gemini API.
-   **`FilePickerModal.tsx`**: A modal used within the Chat Assistant to select and attach existing files from the local file cache.
-   **`GlobalSettingsPanel.tsx`**: A modal panel for configuring global AI settings, such as the model, temperature, and safety settings.
-   **`LoggingLevelSelector.tsx`**: A dropdown component in the footer for setting the application's console log level.
-   **`PostInsights.tsx`**: A dashboard that displays analytics and a searchable table of all processed posts from the corpus.
-   **`PromptManagerPanel.tsx`**: An inspector panel that allows developers to view all system prompts and context documents used by the AI.
-   **`QuoteFinder.tsx`**: The UI for the "Quotes and Callbacks" tool, allowing users to find quotes or generate contextual callbacks from their content. Uses `promptService` to fetch its templates and includes integrated UTM tagging.
-   **`RegressionTestsPanel.tsx`**: A developer panel, visible only in Test Mode, for toggling specific regression test conditions.
-   **`SocialPostAssistant.tsx`**: A tool for generating social media posts from an article, with options for platform, tone, inspirations, and post regeneration. Uses `promptService` to fetch templates and includes integrated UTM tagging.
-   **`ToggleSwitch.tsx`**: A reusable toggle switch component.
-   **`ToolPanel.tsx`**: A generic wrapper component for all tool interfaces, providing a consistent header and back button.
-   **`UrlPickerModal.tsx`**: A modal used within the Chat Assistant to add and manage URLs for contextual content fetching.

### Icon Components (`src/components/icons`)

This sub-directory contains all SVG icon components used throughout the UI. Each file is a React component that renders a specific icon. (e.g., `ArchiveBoxIcon.tsx`, `DatabaseIcon.tsx`, `PencilIcon.tsx`, `RefreshIcon.tsx`, `StopIcon.tsx`, `PaperclipIcon.tsx`, etc.)

## Configuration (`src/config`)

-   **`app_config.ts`**: Contains core, non-user-editable application settings like the semantic version number, build number, footer text, and default model configuration.
-   **`file_naming_config.ts`**: Defines the rules and mappings for the internal file naming convention, used for classifying file uploads.
-   **`prompts_config.ts`**: A centralized library defining the metadata (ID, name, path) for all system instructions and user prompt templates. The content itself is loaded by `promptService`.
-   **`social_post_config.ts`**: Configuration for the Social Post Assistant, defining post length options and UTM tagging strategies for different social media venues.
-   **`tool_config.ts`**: The single source of truth for the tools available in the cockpit. It defines each tool's ID, name, icon, component, and dependencies.
-   **`user_config.ts`**: Contains user-specific configurations, such as the Substack base URL and brand brief, intended to be editable.

## Contexts (`src/contexts`)

-   **`ContentContext.tsx`**: Manages the state for "context documents." It follows a DB-first approach, loading and classifying documents (using prompts from `promptService`), saving them to IndexedDB, and then filtering the displayed list based on the main Gemini sync status.
-   **`DataContext.tsx`**: Manages the state of the main user-provided corpus data (posts, subscribers, etc.) after it has been processed. It uses IndexedDB as a persistent cache for fast startup.
-   **`GeminiCorpusContext.tsx`**: Orchestrates the DB-first file synchronization. On every application startup, it compares the state of the local IndexedDB (the source of truth) with the Gemini Files API, uploading missing files and deleting orphaned ones to ensure the remote API is always a mirror of the local database.
-   **`SettingsContext.tsx`**: Manages global, user-configurable settings, such as the selected AI model, temperature, and logging level.
-   **`TestModeContext.tsx`**: Manages the state of the developer "Test Mode," including which specific regression tests are active.

## Hooks (`src/hooks`)

-   **`useCorpusProcessor.tsx`**: A custom hook that encapsulates logic for processing a Substack ZIP file. It now operates DB-first, saving all processed data and generated file assets directly to IndexedDB, which queues them for the main synchronization process.

## Services (`src/services`)

-   **`corpusProcessingService.ts`**: A service module containing the business logic for parsing and structuring the raw data from the Substack export.
-   **`dbService.ts`**: A wrapper around the browser's IndexedDB API. It manages the `CreatorCockpitDB` database, all its object stores, and includes functions for exporting and atomically importing the entire database.
-   **`geminiCorpusService.ts`**: A service that orchestrates the local registration of all processed corpus and context documents into IndexedDB, preparing them for the main synchronization process.
-   **`geminiFileService.ts`**: A low-level service acting as a wrapper around the `@google/genai` SDK. It has been refactored to support the DB-first model, with functions to register files locally before API interaction and to manage deletions from both the local DB and the remote API.
-   **`loggingService.ts`**: A centralized service that provides a multi-level logging system (`error`, `info`, `prompt`, `debug`) used throughout the application.
-   **`promptService.ts`**: A centralized service that loads, caches, and provides access to all external AI prompt templates from the `src/prompts` directory.

## Prompts (`src/prompts`)

This directory contains all the raw markdown files for the AI prompts. They are loaded at runtime by the `promptService`.

-   **`chat_assistant_system.md`**: Base.
-   **`context_classification.md`**: System instructions for classifying context documents.
-   **`ocr.md`**: System instructions for performing OCR on images.
-   **`quote_finder_callback_mode_system.md`**: System instructions for QuoteFinder in callback mode.
-   **`quote_finder_callback_regen_system.md`**: System instructions for regenerating a callback.
-   **`quote_finder_quote_mode_system.md`**: System instructions for QuoteFinder in quote mode.
-   **`social_post_system_bluesky.md`**: System instructions for generating BlueSky posts.
-   **`social_post_system_linkedin_page.md`**: System instructions for generating LinkedIn Page posts.
-   **`social_post_system_linkedin_personal.md`**: System instructions for generating LinkedIn Personal posts.
-   **`social_post_system_substack.md`**: System instructions for generating Substack Notes.

## Static Assets (`src`)

-   **`src/content_corpus/`**: Contains the default, pre-loaded Substack export data for development and initial app state.
-   **`src/context_documents/`**: Contains markdown files that serve as foundational brand and author context for the AI.
-   **`src/reg_test/`**: Contains assets specifically for use in regression tests.
