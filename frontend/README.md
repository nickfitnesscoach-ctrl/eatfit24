# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Local Development (Telegram Mock)

To run the application locally without opening it inside Telegram, you can enable the Telegram WebApp mock.

1.  Create a `.env.local` file in the `frontend` directory:
    ```env
    VITE_SKIP_TG_AUTH=true
    ```
2.  Or run the dev server with the environment variable:
    ```bash
    # PowerShell
    $env:VITE_SKIP_TG_AUTH='true'; npm run dev
    
    # Bash
    VITE_SKIP_TG_AUTH=true npm run dev
    ```

This will enable a mock Telegram environment that allows you to navigate the app in a standard browser.
