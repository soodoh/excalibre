/**
 * lint-staged config as a JS module so we can use the function form for
 * prettier. This avoids shell-glob interpretation of `$` in filenames (e.g.
 * TanStack Router dynamic segment directories like `$token`).
 */
export default {
  "*.{js,jsx,ts,tsx}": ["oxlint --fix --config oxlint.config.ts"],
  "*.{js,jsx,ts,tsx,css,html,json,md,mdx,yaml,yml}": (filenames) => {
    const quoted = filenames
      .map((f) => `"${f.replaceAll('"', String.raw`\"`)}"`)
      .join(" ");
    return `prettier --write ${quoted}`;
  },
};
