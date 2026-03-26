import { defineConfig } from "@standard-config/oxlint";

export default defineConfig({
  react: true,
  ignorePatterns: [
    "node_modules/**",
    ".output/**",
    "dist/**",
    "**/routeTree.gen.ts",
  ],
  rules: {
    "typescript/no-restricted-types": "off",
    "eslint/no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "react",
            importNames: ["default"],
            message: "Use named imports from 'react' instead",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: [
        "apps/web/src/routes/**",
        "apps/web/src/db/**",
        "apps/web/src/lib/auth.ts",
      ],
      rules: { "import/prefer-default-export": "off" },
    },
  ],
});
