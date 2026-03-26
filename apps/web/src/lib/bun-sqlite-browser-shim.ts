// No-op shim for bun:sqlite in client bundles.
// The real module is only available on the server (SSR).

// oxlint-disable-next-line typescript-eslint/no-extraneous-class
export class Database {
  constructor() {
    throw new Error("bun:sqlite is not available in the browser");
  }
}
export default Database;
