# Current Task: Firebase Core Integration & User Authentication

**Objective:** Lay the foundational Firebase integration and implement a robust authentication layer to secure the application.

### Work in Progress:

-   [x] **Install Firebase SDK:** The `firebase` package is already a dependency.
-   [x] **Create Firebase Configuration:** The file `src/firebase.ts` already handles configuration and initialization.
-   [x] **Develop Authentication Context:** Create a new React context at `src/contexts/AuthContext.tsx` to manage user state, loading status, and provide `login`/`logout` functions.
-   [x] **Create Login Page:** Build the `LoginPage.tsx` component with a basic UI for user sign-in.
-   [x] **Implement Protected Routing:** Modify the main application router to check the authentication state from `AuthContext`. If the user is not logged in, redirect them to the `/login` route.
