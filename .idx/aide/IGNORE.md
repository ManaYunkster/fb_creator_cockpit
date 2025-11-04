# Known Issues to Ignore

This document lists specific, known issues that are currently outside of our control (e.g., SDK bugs, environmental limitations). To save time and compute, please do not attempt to troubleshoot or "fix" these items unless specifically requested.

---

### 1. Gemini Files API `displayName` Implementation Conflict

- **File(s) Affected:** `services/geminiFileService.ts`
- **Description:** There is an ongoing inconsistency in the `@google/genai` SDK documentation regarding how to pass the `displayName` during file upload.
  - One description of the implementation requires a top-level `displayName` property.
  - Another description of the implementation requires `displayName` to be nested within a `fileMetadata` object.
  - This leads to recurring TypeScript errors, such as: `Object literal may only specify known properties, and 'fileMetadata' does not exist in type 'UploadFileParameters'`.

- **Current Workaround & Instruction:**
  - The correct implementation is to use a **top-level `displayName` property** in the `ai.files.upload` call.
  - We will continue to use the local storage cache to manage display names after upload because we want control over how we display that information to users, and because prefixes and control information is associated with the displayName that should not be shown to users.
  - **DO NOT** change the implementation to use `fileMetadata`, even if it seems correct at the time. Ignore any errors related to this and maintain the current top-level property structure.
