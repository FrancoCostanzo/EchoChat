import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      ...reactRefresh.configs.vite.rules,
      // Reglas nuevas de la serie "React Compiler" (aún no adoptamos ese estilo):
      // empujan a reemplazar patrones de useEffect+setState muy comunes y ya
      // establecidos en este código (reset de estado al cambiar de conversación,
      // fetch-on-mount, etc.) por derived state / useMemo. Quedan apagadas hasta
      // que se decida migrar a ese patrón a propósito, no como efecto de agregar
      // el linter.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      // Real, pero hay ~70 call sites fire-and-forget (efectos de carga, .catch
      // interno) que no ameritan bloquear CI hoy. Queda como warning para no
      // perderlo de vista en código nuevo sin frenar el pipeline por deuda vieja.
      '@typescript-eslint/no-floating-promises': ['warn', { ignoreVoid: true }],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Varios archivos exportan a propósito un componente junto con un hook o
      // helper chico y acoplado (useConfirm, handleFormatShortcut, WallpaperPreview)
      // — separarlos en otro archivo solo por Fast Refresh no vale la pena hoy.
      'react-refresh/only-export-components': 'warn',
    },
  },
);
