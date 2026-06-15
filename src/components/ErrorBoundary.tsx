import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { debugError } from "../lib/debug";

type Props = {
  children: ReactNode;
};

type State = {
  error?: Error;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    debugError("React render error", { error, info });
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6 text-neutral-950 dark:bg-neutral-950 dark:text-white">
          <section
            className="w-full max-w-lg rounded-lg border border-rose-200 bg-white p-6 shadow-soft dark:border-rose-900/60 dark:bg-neutral-900"
            role="alert"
            aria-live="assertive"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-lg font-semibold">MapGap could not render.</h1>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  The error has been logged to the browser console.
                </p>
              </div>
            </div>
            <pre className="max-h-40 overflow-auto rounded-md bg-neutral-950 p-3 text-xs text-white">
              {this.state.error.message}
            </pre>
            <button
              type="button"
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              onClick={() => window.location.reload()}
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Reload app
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
