/**
 * Globals firebase v12 references at module-load time that the device's
 * (old) Expo Go Hermes runtime doesn't provide. Must be imported before
 * anything that imports firebase — it is the first import of app/_layout.tsx.
 *
 * Sibling of the #private-fields babel transpile (see babel.config.js):
 * same root cause, an Expo Go client older than the libraries assume.
 */

const g = globalThis as Record<string, unknown>;

if (typeof g.DOMException === 'undefined') {
  class DOMExceptionPolyfill extends Error {
    readonly code: number;

    constructor(message?: string, name = 'Error') {
      super(message);
      this.name = name;
      this.code = 0;
    }
  }
  g.DOMException = DOMExceptionPolyfill;
}
