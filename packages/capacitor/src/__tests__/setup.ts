// Test setup — shims browser globals not present in Node's `testEnvironment`.
// Adding `jest-environment-jsdom` would be heavier; the SDK code only needs
// `localStorage`, `fetch`, `crypto.randomUUID`, and `navigator.onLine`.

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Always attach a fresh MemoryStorage so test isolation is per-process
// and individual tests can call `clear()` themselves when needed.
(globalThis as any).localStorage = new MemoryStorage();

// `crypto.randomUUID` is available natively from Node 14.17+; nothing to do.

// Stub `navigator.onLine` if missing.
if (typeof (globalThis as any).navigator === 'undefined') {
  (globalThis as any).navigator = { onLine: true };
}

// `fetch` is intentionally NOT stubbed here — tests should provide their own
// `jest.fn()` mock so each suite can assert on the request shape.
