npm run server
npm run dev

npm run test          # Run tests in watch mode
npm run test:run      # Run tests eenmalig
npm run test:coverage # Coverage rapport
npm run test:e2e      # E2E tests met Playwright
npm run test:collab   # Alleen collaboration E2E tests
npm run test:network  # Alleen network E2E tests

- Y.Map.set() vervangt het HELE object - Wanneer twee users verschillende properties updaten, gaat één update verloren omdat de huidige implementatie hele objecten vervangt. Dit is een onderzoekspunt voor scene-aware conflict resolution.

- Belangrijke bevindingen voor je onderzoek
Last-Write-Wins: Bij Y.Map wint altijd de laatste schrijver (gebaseerd op client ID ordering)
Hele object vervanging: yobjects.set(id, {...}) vervangt het hele object, waardoor parallelle property-edits verloren gaan
Delete vs Update: Als user A verwijdert en user B updatet, wordt de update soms toch toegepast (object blijft bestaan)

- Mogelijke oplossingsrichtingen om te onderzoeken
Nested Y.Map per property - Elke property apart syncen
Operational Transformation - Transformeer conflicterende operaties
Scene-aware merging - Domein-specifieke merge logica (bijv. positie interpoleren)
Locking/reservations - Object claimen tijdens bewerking
3-way merge - Vergelijk met gemeenschappelijke ancesto

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is currently not compatible with SWC. See [this issue](https://github.com/vitejs/vite-plugin-react/issues/428) for tracking the progress.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
