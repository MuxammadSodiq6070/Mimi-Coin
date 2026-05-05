import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-3xl border border-[#D4AF37]/30 bg-[#0A0A0A] p-6 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
            <AlertTriangle className="text-red-300" size={26} />
          </div>
          <h1 className="mb-2 text-xl font-bold">Something went wrong</h1>
          <p className="mb-5 text-sm leading-6 text-neutral-400">
            The app hit an unexpected state. Your balances are stored on the server, so retrying will safely reload your account.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-bold text-black transition-transform active:scale-95"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }
}
