import "@testing-library/jest-dom/vitest";

class RO { observe() {} unobserve() {} disconnect() {} }
// jsdom lacks these; components only need them to exist.
globalThis.ResizeObserver ??= RO as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } root = null; rootMargin = ""; thresholds = []; } as unknown as typeof IntersectionObserver;
