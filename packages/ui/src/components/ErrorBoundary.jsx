import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button.jsx';

/** ErrorBoundary: catches render errors; `fallback` (node or (error, reset)=>node) overrides the default screen. */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error: error || new Error('Unknown error') };
  }

  componentDidCatch(error, info) {
    if (typeof this.props.onError === 'function') this.props.onError(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const { fallback } = this.props;
    if (typeof fallback === 'function') return fallback(error, this.reset);
    if (fallback) return fallback;
    return (
      <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger"><AlertTriangle className="h-6 w-6" /></span>
        <h1 className="font-display text-display-sm">Something broke on our end</h1>
        <p className="max-w-md text-sm text-text-muted">An unexpected error stopped this page from loading. Reloading usually fixes it.</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={this.reset}>Try again</Button>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      </div>
    );
  }
}
