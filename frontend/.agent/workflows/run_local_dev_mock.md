---
description: How to run the application locally with Telegram WebApp mock
---

# Local Development with Telegram Mock

To test Telegram WebApp specific features (like navigation, user data, etc.) locally without opening the app inside Telegram, you can enable the mock mode.

## Steps

1.  **Enable Mock Mode**:
    Set the `VITE_SKIP_TG_AUTH` environment variable to `true`.

    **Option A: Using .env.local (Recommended)**
    Create a `.env.local` file in the `frontend` directory:
    ```env
    VITE_SKIP_TG_AUTH=true
    ```

    **Option B: Command Line**
    ```bash
    # PowerShell
    $env:VITE_SKIP_TG_AUTH='true'; npm run dev

    # Bash
    VITE_SKIP_TG_AUTH=true npm run dev
    ```

2.  **Run the Server**:
    Start the development server as usual:
    ```bash
    npm run dev
    ```

3.  **Verify**:
    Open the local URL (e.g., `http://localhost:5173/app`). You should see the application load with mock user data instead of the "Open via Telegram" placeholder.

## Mock Data
The mock implementation uses hardcoded data found in `src/lib/telegram.ts`.
- User ID: `123456789`
- Username: `devuser`

## Important
Do not commit `.env.local` to the repository. It is already ignored by `.gitignore`.
