// src/ui/useBreakpoint.ts
import { useWindowDimensions } from "react-native";

// ─── Breakpoint thresholds ────────────────────────────────────────────────────
export const BP = {
  tablet:  768,   // iPad portrait and above
  desktop: 1100,  // desktop / large iPad landscape
} as const;

// ─── Sidebar widths ───────────────────────────────────────────────────────────
export const SIDEBAR_WIDTH = {
  tablet:  220,
  desktop: 256,
} as const;

// ─── Content max-width (prevents content stretching on wide monitors) ─────────
export const CONTENT_MAX_WIDTH = 900;

// ─── Types ────────────────────────────────────────────────────────────────────
export type Breakpoint = "phone" | "tablet" | "desktop";

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Returns the current breakpoint, reactive to window/orientation changes. */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  if (width >= BP.desktop) return "desktop";
  if (width >= BP.tablet)  return "tablet";
  return "phone";
}

/** True on tablet and desktop — use to show/hide the sidebar. */
export function useIsWide(): boolean {
  return useBreakpoint() !== "phone";
}

/** Current sidebar width in pixels (0 on phone). */
export function useSidebarWidth(): number {
  const bp = useBreakpoint();
  if (bp === "desktop") return SIDEBAR_WIDTH.desktop;
  if (bp === "tablet")  return SIDEBAR_WIDTH.tablet;
  return 0;
}
