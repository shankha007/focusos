import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";

/**
 * The rules worth having on a codebase with no backend and no runtime error
 * reporting: a mistake here is only ever found by a user noticing their data is
 * wrong. Type-aware linting is switched on for that reason — `no-floating-promises`
 * alone justifies the slower run, since this code drives async store writes
 * through `void` in dozens of places and a dropped rejection is invisible.
 */
export default tseslint.config(
  {
    ignores: ["dist/**", "dev-dist/**", "coverage/**", "*.tsbuildinfo"],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser },
    },
  },

  /* ── React ─────────────────────────────────────────────────── */
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // Every autofocus in the app is the first field of a dialog the user
      // deliberately opened, which is where the attribute is correct. The rule
      // is aimed at focus stolen on page load, and there is none of that here.
      "jsx-a11y/no-autofocus": "off",

      // The React Compiler rules that ship with eslint-plugin-react-hooks 7
      // flag real patterns worth changing — state written from an effect,
      // `Date.now()` read during render — but each fix is a component refactor
      // rather than a lint cleanup. Left as warnings so they stay visible and
      // CI does not turn red on a backlog nobody has scheduled yet.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },

  /* ── Project rules ─────────────────────────────────────────── */
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // The reason for type-aware linting. `void somePromise()` stays legal —
      // it is how this codebase says "deliberately not awaited" — but a promise
      // dropped by accident is now an error.
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }],

      // react-router 7's `navigate` returns `void | Promise<void>`, so every
      // `onClick={() => navigate(...)}` in the app trips the void-return checks.
      // Those two checks are switched off rather than papered over at nine call
      // sites; the rest of the rule — promises used as conditions, assigned to
      // void-typed variables — still applies.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false, arguments: false } },
      ],

      // An underscore prefix is the existing convention for a binding that only
      // exists to be destructured away, e.g. `({ score: _score, ...rest })`.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      // Dexie, Recharts and jsPDF all hand back loosely-typed values, and the
      // call sites narrow them deliberately. Flagging every one of those as
      // unsafe buries the findings that matter in noise.
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",

      // `?? ''` on a value typed as string is usually defensive, not dead.
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },

  /* ── Tests ─────────────────────────────────────────────────── */
  {
    files: ["src/**/*.test.{ts,tsx}", "src/test/**/*.ts"],
    rules: {
      // A test asserts the value exists; that is the point of the test.
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  /* ── Config files ──────────────────────────────────────────── */
  {
    files: ["*.config.{js,ts}", "postcss.config.js", "tailwind.config.js"],
    languageOptions: {
      globals: { ...globals.node },
    },
    ...tseslint.configs.disableTypeChecked,
  },
);
