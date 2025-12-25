# Changelog

## Build 20251225.1 (v1.10.1)
- **Sync Safety**: Sync operations now target only app-managed (`__cc_`) files, preserving other remote content.
- **Context Management**: Context documents are now added/removed in the local store with classification and API availability checks.
- **Corpus Reset**: Reset now clears corpus-only metadata/content without wiping non-corpus context files.
- **AI Stability**: Cleaned up temp article uploads and fixed client-side API key usage in Social Post Assistant OCR.
- **Tooling**: Improved chat error rollback and reduced duplicate sync triggers; removed unused Gemini corpus service.

## Build 20251112.1 (v1.10.0)
- **Version Bump**: Application version has been updated to `1.10.0`.
