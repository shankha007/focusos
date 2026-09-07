import { useOutletContext } from "react-router-dom";

/**
 * What `AppShell` hands down to whichever page is rendered inside it.
 *
 * The Deep Focus overlay is owned by `Workspace`, which sits on the far side of
 * a lazy boundary from the route elements — there is no prop to thread through,
 * so the shell passes it through the outlet instead.
 */
export interface ShellContext {
  /** Opens the full-screen focus view — what a page calls after starting a session. */
  openDeepFocus: () => void;
}

/** The shell's context, for a page that needs to open Deep Focus. */
export function useShell(): ShellContext {
  return useOutletContext<ShellContext>();
}
