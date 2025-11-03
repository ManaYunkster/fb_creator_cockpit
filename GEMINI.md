# Internal Working Agreement & AIDE Documentation

This document outlines the standard operating procedures for our development sessions. Following these guidelines ensures efficiency, consistency, and robustness in our workflow.

## 1. Communication Style
- **Objectivity:** Gratuitous compliments are unnecessary. It is sufficient to acknowledge instructions and provide objective evaluations or relevant facts and possibilities as part of the dialogue.

## 2. Changelog Maintenance

An internal changelog is maintained at `/.idx/aide/CHANGELOG.md`. This file will be updated automatically with every build, providing a human-readable history of all requested changes and implementations.

## 3. Coding Standards

- **Multi-Level Logging:** A multi-level logging system is in place, controlled by the dropdown in the UI. All new or modified functions must use the centralized `loggingService` for console output. The correct logging method must be used based on the context:
  - `log.error()`: For caught errors and critical failures.
  - `log.info()`: For general workflow information (equivalent to the old "detailed logging").
  - `log.prompt()`: Specifically for logging the final, fully-constructed prompts sent to the AI.
- **Comment Hygiene:** Old, irrelevant comments will be removed. New comments will be added to explain the *why* behind complex or non-obvious code, not just the *what*.
- **Maintain tool_config.ts:** When adding or modifying new functions, they will be cataloged in tool_config.ts which contains a full list of each tool, metadata about the tool, what data is required, index to the React component, and wheether it's enabled.
- **Relative Paths in Docs:** All file paths referenced in documentation (e.g., `APPMAP.md`, `SERVICEMAP.md`) must be relative to the project root (e.g., `src/components/MyComponent.tsx`) and should not include a leading slash.

## 4. Known Issues (Do Not Fix)

A detailed list of known issues that should not be fixed is maintained in the `/.idx/aide/IGNORE.md` file. Refer to that document for specific instructions on what to ignore.

## 5. Special Commands

To improve workflow management, the following special commands can be used as your entire prompt. Multiple commands can be chained in a single prompt and will be executed sequentially in the order they appear (e.g., `#date 2025-01-01` followed by `#build`).

- `#help`
  - **Usage:** Use `#help` to see a list of all available commands, or `#help [command]` for detailed information on a specific command.
  - **Action:**
    - `#help`: I will list all special commands and a brief summary of their function.
    - `#help [command]`: I will provide the full documentation for the specified command.

- `#think`
  - **Usage:** Send `#think` as the prompt.
  - **Action:** This tells me to read and process your latest message for context, but to **not** take any action or generate any code. I will simply acknowledge that I've understood. This is useful for providing context or thinking out loud without triggering a development cycle.
  
- `#do`
  - **Usage:** Send `#do` as the prompt.
  - **Action:** Start or continue the action that was discussed or in process in the previous turn.

- `#date YYYY-MM-DD`
  - **Usage:** Send `#date` followed by the current date in `YYYY-MM-DD` format.
  - **Action:** I will update my internal context with the provided date. This date will be used for all subsequent build numbers within this session, following the `YYYYMMDD.build` format.

- `#version [major|minor|maintenance]`
  - **Usage:** Send `#version` followed by `major`, `minor`, or `maintenance`.
  - **Action:** I will increment the application's version number in `config/app_config.ts` according to semantic versioning rules.
    - `#version major`: Increments the major version and resets minor and maintenance to 0 (e.g., 1.4.3 -> 2.0.0).
    - `#version minor`: Increments the minor version and resets maintenance to 0 (e.g., 1.4.3 -> 1.5.0).
    - `#version maintenance`: Increments the maintenance version (e.g., 1.4.3 -> 1.4.4).

- `#ignore`
  - **Usage:** Start your prompt with `#ignore` when we are discussing a persistent problem that you want me to add to the ignore list.
  - **Action:** I will summarize the problem we're discussing and add it as a new entry to `/.idx/aide/IGNORE.md`. This formally documents it as an issue I should no longer try to fix.

- `#map <option>`
  - **Usage:** Use one of the following commands to interact with `APPMAP.md`.
  - **Actions:**
    - `#map update`: Triggers an update of `APPMAP.md` based on the current state of the application. Afterwards, I will ask if we should add any reference material from recent changes to `/.idx/aide/REFERENCE.md`.
    - `#map audit`: Triggers a full audit of `APPMAP.md` to confirm that all elements are used and current, and identifies any additions, removals, or edits required.

- `#backlog <option>`
  - **Usage:** Use one of the following commands as your entire prompt to manage the feature backlog.
  - **Actions:**
    - `#backlog -add`: After discussing a feature you'd like to implement later, use this command. I will summarize the feature from our previous conversation and add it to `/.idx/aide/BACKLOG.md`.
    - `#backlog -read`: I will respond with the current contents of `/.idx/aide/BACKLOG.md`.

- `#export_context`
  - **Usage:** Send `#export_context` as the prompt.
  - **Action:** I will respond with a single, copyable code block containing a Base64-encoded JSON object. This object summarizes our recent **conversation history only**. It deliberately excludes the application's source code to keep the export small and efficient.

- `#import_context [data]`
  - **Usage:** To start a new session, provide the application's source code in the prompt as usual, and begin your instruction with `#import_context` followed by the Base64 data from `#export_context`.
  - **Action:** I will parse the data to understand our most recent conversation, allowing me to pick up exactly where we left off.

- `#build`
  - **Usage:** Send `#build` as the prompt.
  - **Pre-Action:** Before I execute the build, I will provide a recommendation on whether work needs to be documented in `/.idx/aide/REFERENCE.md`, `/.idx/aide/APPMAP.md`, `/.idx/aide/CONEXTMAP.md`. YOU MUST ASK THE USER FOR APPROVAL TO PROCEED.
  - **Action:** With every set of modifications, I should automatically increment the build number. The format is `YYYYMMDD.build`, where: `YYYYMMDD` is the current date. `build` is a number that starts at `1` each day and increments with each change. This build number is visible in the application footer. Additionally, I must add a new section in CHANGELOG.md that documents all net changes that were made since the last build command, based on what's my context, and following the format already established. Finally, I will review and update `/.idx/aide/APPMAP.md` and `/.idx/aide/CONTEXTMAP.md` to ensure they accurately reflect the current state of the application's architecture and file structure.
 
## 6. Architectural Principles

To ensure consistency and maintainability, all future development should adhere to the following architectural patterns established in the codebase.

- **Data-Driven UI from Centralized Configuration (`/config`)**
  - **Principle:** Application features, such as the list of tools on the main screen (`tool_config.ts`) or the library of AI prompts (`prompts_config.ts`), should be defined as data in configuration files rather than being hardcoded in components.
  - **Responsibility:** When adding a new tool or prompt, the corresponding configuration file must be updated. The UI should dynamically render based on this configuration.

- **Service-Oriented Architecture (`/services`)**
  - **Principle:** Logic that interacts with external APIs (e.g., Gemini API) or performs complex, reusable business logic (e.g., parsing corpus data) should be abstracted into dedicated service modules.
  - **Responsibility:** Components should not contain direct API fetch calls or complex data manipulation. They should import and call functions from the appropriate service, keeping the component focused on state management and UI rendering.
  - **Documentation:** For a detailed map of how these services interact and manage data flow, refer to `idx/aide/SERVICEMAP.md`.

- **React Context for Global State (`/contexts`)**
  - **Principle:** Application-wide state (e.g., loaded data, user settings, corpus sync status) should be managed via React's Context API to avoid prop-drilling.
  - **Responsibility:** Each major domain of global state should have its own context provider (e.g., `DataContext`, `SettingsContext`). Components that need access to this state should use the `useContext` hook.

- **Component-Based Design (`/components`)**
  - **Principle:** The UI should be composed of small, single-purpose, and reusable components. We will continue to separate presentational ("dumb") components from container ("smart") components where it makes sense.
  - **Responsibility:** When creating new UI elements, consider if they can be broken down into smaller, reusable pieces. Icons, buttons, and panels are good examples of this.

- **Custom Hooks for Reusable Logic (`/hooks`)**
  - **Principle:** Stateful, complex logic that is reused across multiple components should be extracted into custom hooks.
  - **Responsibility:** Before implementing component-level state logic, consider if it might be needed elsewhere. The `useCorpusProcessor` hook is a prime example, encapsulating all logic for file processing and state management, which is then used by multiple components.
