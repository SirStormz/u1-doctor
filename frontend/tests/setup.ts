import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

// the first-run assistant is a modal dialog: tests start as a returning user, the onboarding tests clear this flag
beforeEach(() => { localStorage.setItem("u1d.onboarded", "1"); });

class RO { observe() {} unobserve() {} disconnect() {} }
// jsdom lacks these; components only need them to exist.
globalThis.ResizeObserver ??= RO as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } root = null; rootMargin = ""; thresholds = []; } as unknown as typeof IntersectionObserver;
