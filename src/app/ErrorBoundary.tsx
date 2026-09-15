import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /**
   * Changing this clears a caught error. The workspace passes the route, so
   * navigating away from a page that failed tries again instead of leaving
   * the recovery screen up everywhere.
   */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

/**
 * Catches a render error below it and shows a way out instead of an empty page.
 *
 * With no boundary anywhere, React unmounts the whole tree on any render
 * error — one bad row in a card blanked the entire app, mid-session, with
 * nothing on screen to explain it or reach Settings from. The data is still
 * intact in IndexedDB, so the screen points at the two things that help:
 * reloading, and Settings, where a backup can be exported or the data reset.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FocusOS hit an error it could not render past', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div role="alert" className="grid h-full min-h-[60vh] place-items-center bg-bg px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-[15px] font-semibold text-fg">Something went wrong on this page</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Your data is still saved in this browser. Reloading usually clears it. If it keeps
            happening, Settings lets you export a backup or reset.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl border border-border bg-elevated px-3 py-1.5 text-[13px] font-medium text-fg transition-colors hover:border-accent/40"
            >
              Reload
            </button>
            {/* A full navigation rather than a router link: the router may be
                what is broken, and a fresh load of Settings starts clean. */}
            <a
              href="/settings"
              className="rounded-xl border border-border px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-fg"
            >
              Open Settings
            </a>
          </div>
        </div>
      </div>
    );
  }
}
