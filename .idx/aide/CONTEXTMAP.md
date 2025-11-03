# Context Map (CONTEXTMAP)

This document provides a map for the application's internal file naming and context management system. It serves as a reference for understanding how files are classified, named, and used by different parts of the application.

## Internal File Naming Convention

To provide clear, machine-readable context for files uploaded to the Gemini Files API, we use a standardized naming convention. This allows the application to programmatically understand the purpose and scope of a file without relying on brittle string matching or separate metadata stores.

The convention follows this structure:

`__cc_[context]_[scope]__[original_filename]`

### Component Breakdown

-   **`__cc`**: A prefix indicating the file is managed by the Creator Cockpit (`cc`) application.
-   **`[context]`**: A short code indicating the file's general purpose or content type.
    -   `content`: The file contains brand, author, or other foundational context.
    -   `general`: The file contains general-purpose content, like notes or research.
    -   `instrux`: The file contains direct instructions for how an AI tool should behave.
    -   `reference`: The file contains reference material or a knowledge base for a specific tool.
    -   `corpus`: The file is a structured data asset (JSON or CSV) generated from the Substack export.
    -   `reg-test`: The file is used exclusively for a regression test.
-   **`[scope]`**: Defines where the context or instruction applies.
    -   `global`: The file applies to all tools and contexts.
    -   `spa`: The file is specific to the Social Post Assistant.
    -   `chat`: The file is specific to the Chat Assistant.
    -   `qf`: The file is specific to the Quotes & Callbacks tool.
    -   `posts`, `delivers`, `opens`, `subscribers`: The file contains a specific type of data from the corpus.
    -   `internal`: The file is for internal application use, like testing.
-   **`__` (Separator):** Two underscores separate the system prefix from the original filename.
-   **`[original_filename]`**: The original, user-friendly filename.

### Examples

-   A global brand brief named `brand-brief.md` becomes:
    `__cc_content_global__brand-brief.md`
-   Instructions for the Chat Assistant named `chat-rules.txt` becomes:
    `__cc_instrux_chat__chat-rules.txt`
-   The generated file of all posts from a corpus upload becomes:
    `__cc_corpus_posts__all_posts.json`

## Defined Prefix Combinations

The following table lists all currently configured prefix combinations, derived from the `FILE_PURPOSES` array in the configuration file.

| Prefix                          | Context       | Scope         | Purpose / Description                                                        |
| ------------------------------- | ------------- | ------------- | ---------------------------------------------------------------------------- |
| `__cc_general_global__`         | `general`     | `global`      | A general-purpose document available to all tools.                           |
| `__cc_content_global__`         | `content`     | `global`      | Foundational brand or author information.                                    |
| `__cc_instrux_spa__`            | `instrux`     | `spa`         | Instructions specific to the Social Post Assistant.                          |
| `__cc_instrux_chat__`           | `instrux`     | `chat`        | Instructions specific to the Chat Assistant.                                 |
| `__cc_instrux_qf__`             | `instrux`     | `qf`          | Instructions specific to the Quotes & Callbacks tool.                        |
| `__cc_reference_spa__`          | `reference`   | `spa`         | Reference material for the Social Post Assistant (e.g., writing guides).     |
| `__cc_reference_chat__`         | `reference`   | `chat`        | Reference material for the Chat Assistant.                                   |
| `__cc_reference_qf__`           | `reference`   | `qf`          | Reference material for the Quotes & Callbacks tool.                          |
| `__cc_corpus_posts__`           | `corpus`      | `posts`       | A file containing post data, generated from the Substack corpus upload.      |
| `__cc_corpus_delivers__`        | `corpus`      | `delivers`    | A file containing delivery data, generated from the Substack corpus upload.  |
| `__cc_corpus_opens__`           | `corpus`      | `opens`       | A file containing open data, generated from the Substack corpus upload.      |
| `__cc_corpus_subscribers__`     | `corpus`      | `subscribers` | A file containing subscriber data, generated from the Substack corpus upload.|
| `__cc_reg-test_internal__`      | `reg-test`    | `internal`    | A file used for an automated regression test.                                |

## Single Source of Truth

The mapping between a user's intent ("Purpose") and the resulting `[context]` and `[scope]` prefixes is defined and managed in a single configuration file:

-   **Location:** `src/config/file_naming_config.ts`
-   **Exported Constant:** `FILE_PURPOSES`

This file is the single source of truth for this system. To add a new file type or context, you must add a new entry to the `FILE_PURPOSES` array in that file. The application's UI (e.g., the "Purpose" dropdown in the File Management panel) and logic are built dynamically from this configuration.