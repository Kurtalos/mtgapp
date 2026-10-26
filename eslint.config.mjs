import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /**
       * This app stores identity and cached card art in localStorage, which the
       * server cannot see. Reading it in a mount effect is the standard way to
       * avoid a hydration mismatch, and the rule cannot tell that apart from
       * derived state being pushed into an effect. The alternative —
       * useSyncExternalStore — buys nothing here, so the rule is off on purpose.
       */
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
