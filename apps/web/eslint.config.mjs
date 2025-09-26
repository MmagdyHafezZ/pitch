import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import pitchPlugin from "../../packages/eslint-plugin-pitch/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "dist/**",
      "build/**",
      "node_modules/**",
      "coverage/**",
      "*.config.js",
      "*.config.ts",
      "*.config.mjs",
      "next-env.d.ts",
      "**/*.tsbuildinfo",
    ],
  },
  ...compat.extends("next/core-web-vitals"),
  {
    plugins: {
      pitch: pitchPlugin,
    },
    rules: {
      "pitch/require-tests": [
        "error",
        {
          ignore: [
            "src/app/**",
            "src/lib/providers.tsx",
            "src/lib/client.ts",
            "src/styles/**",
            "src/middleware.ts",
            "src/env.d.ts",
          ],
        },
      ],
    },
  },
];

export default config;
