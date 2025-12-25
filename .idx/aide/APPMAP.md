## Environment Variables

The project uses `.env` and `.env.local` files in the root directory to store environment variables. These files are not checked into version control and should be used for all sensitive information, such as API keys and database credentials.

Key variables:
- `VITE_GEMINI_API_KEY`: Gemini API key used by the client for model calls and file operations.

## App-Managed Sync Scope

Remote synchronization is limited to application-managed Gemini files, identified by the `__cc_` displayName prefix. Non-app files are not deduplicated or removed by the sync process.
