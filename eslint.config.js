// Configuration ESLint (flat config). Adaptée au modèle « maides » dynamique :
// `any` est volontaire (enregistrements/valeurs non typés), les assertions `!`
// sont fréquentes ; on garde les règles utiles (erreurs de logique) sans bruit.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/public/vendor/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-undef': 'off', // TypeScript gère déjà les identifiants non définis
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
      // l'espace insécable (U+00A0) est volontaire dans certains gabarits (devise…)
      'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true }],
    },
  },
);
