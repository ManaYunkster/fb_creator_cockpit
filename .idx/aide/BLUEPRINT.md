# Project Blueprint: Transition to a Hosted Firebase Environment

This document outlines the long-range plan for migrating the application from a local-first architecture to a fully hosted, multi-user platform leveraging Firebase and Google Cloud services.

---

## Phase 1: Firebase Core Integration & User Authentication

**Objective:** Lay the foundational Firebase integration and implement a robust authentication layer to secure the application.

-   **Tasks:**
    -   [ ] Initialize the Firebase SDK within the application.
    -   [ ] Create a dedicated Firebase configuration file (`src/config/firebase_config.ts`).
    -   [ ] Develop a new `AuthContext` to manage application-wide authentication state (user, loading, error).
    -   [ ] Create a `LoginPage` component with UI for sign-in options.
    -   [ ] Implement routing logic to protect the main application, redirecting unauthenticated users to the `LoginPage`.
    -   [ ] Set up basic Firestore security rules to deny all access by default, pending authenticated access rules.

---

## Phase 2: Firestore-Backed Content Management

**Objective:** Replace the local `ContentContext` and preloaded assets with a dynamic system where documents are managed in Firestore.

-   **Tasks:**
    -   [ ] Design and implement Firestore data models for user profiles and documents.
    -   [ ] Create a `users` collection in Firestore to store user-specific data.
    -   [ ] Create a `documents` collection, with rules allowing users to only access/modify their own documents.
    -   [ ] Refactor `ContentContext` to fetch documents from Firestore based on the authenticated user.
    -   [ ] Build a new UI within the `FileManagementPanel` (or a new component) for uploading, viewing, editing, and deleting Firestore-backed documents.
    -   [ ] Update services (`geminiFileService`, etc.) to perform CRUD operations on the `documents` collection in Firestore.

---

## Phase 3: Migrating Prompts to Vertex AI Prompt Manager

**Objective:** Centralize prompt management by migrating from the local `prompts_config.ts` to Vertex AI Prompt Manager, allowing for easier updates and versioning.

-   **Tasks:**
    -   [ ] Set up a Google Cloud Project with Vertex AI enabled.
    -   [ ] Manually or programmatically migrate all prompts from `prompts_config.ts` into the Vertex AI Prompt Manager.
    -   [ ] Create a new `promptService` module responsible for fetching prompts from the Vertex AI API at runtime.
    -   [ ] Implement caching for fetched prompts to reduce API calls and improve performance.
    -   [ ] Refactor all components and services that currently import from `prompts_config.ts` to use the new `promptService`.

---

## Phase 4: Deployment with Firebase App Hosting

**Objective:** Deploy the application using Firebase App Hosting for a scalable, production-ready environment.

-   **Tasks:**
    -   [ ] Configure the project for deployment using the Firebase CLI.
    -   [ ] Create a `firebase.json` file to define hosting rules, rewrites (for SPA routing), and headers.
    -   [ ] Set up a deployment script in `package.json` (e.g., `npm run deploy`).
    -   [ ] (Optional but Recommended) Configure a CI/CD pipeline (e.g., using GitHub Actions) to automatically build and deploy the application upon pushes to the `production` branch.

---

## Phase 5: Codebase Refactoring & Cleanup

**Objective:** Remove obsolete local-first code and ensure the application is fully aligned with the new cloud-native architecture.

-   **Tasks:**
    -   [ ] Remove the `PRELOADED_ASSETS` array and associated loading logic from `app_config.ts` and `DataContext`/`ContentContext`.
    -   [ ] Delete obsolete context document files from `/src/context_documents/`.
    -   [ ] Remove `prompts_config.ts`.
    -   [ ] Audit and remove any other code related to the previous local-first architecture that is no longer in use.
