import {Component, Fragment, type ErrorInfo, type ReactNode} from "react";

type IntelligenceErrorBoundaryProps = {
  children: ReactNode;
  resetKey: string;
};

type IntelligenceErrorBoundaryState = {
  error: Error | null;
  retryRevision: number;
};

/**
 * Contains render failures to the intelligence pane. The independently hosted
 * V2 iframe is deliberately outside this boundary in ComparisonWorkbench.
 */
export class IntelligenceErrorBoundary extends Component<
  IntelligenceErrorBoundaryProps,
  IntelligenceErrorBoundaryState
> {
  state: IntelligenceErrorBoundaryState = {error: null, retryRevision: 0};

  static getDerivedStateFromError(error: Error): Partial<IntelligenceErrorBoundaryState> {
    return {error};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("MapGap intelligence pane failed", error, info.componentStack);
  }

  componentDidUpdate(previousProps: IntelligenceErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({error: null, retryRevision: this.state.retryRevision + 1});
    }
  }

  private retry = () => {
    this.setState((state) => ({error: null, retryRevision: state.retryRevision + 1}));
  };

  render() {
    if (this.state.error) {
      return (
        <section className="surface intelligence-surface" data-testid="intelligence-surface">
          <header className="surface-header intelligence-header">
            <div><span>02 · Context workbench</span><h1>Location intelligence</h1></div>
            <p>Renderer isolated; MapGap V2 remains available.</p>
          </header>
          <div className="intelligence-body">
            <div className="map-stage">
              <div className="map-error" role="alert" data-testid="intelligence-pane-error">
                <strong>Location intelligence needs a restart</strong>
                <span>The MapGap V2 experience is still live and unchanged.</span>
                <button type="button" onClick={this.retry}>Retry intelligence workbench</button>
              </div>
            </div>
          </div>
        </section>
      );
    }

    // Retrying remounts the complete intelligence subtree while leaving the
    // sibling V2 iframe and its browsing context intact.
    return <Fragment key={this.state.retryRevision}>{this.props.children}</Fragment>;
  }
}
