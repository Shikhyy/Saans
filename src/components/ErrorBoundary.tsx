import { Component, type ErrorInfo, type ReactNode } from 'react'

export interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Catch unexpected render-time failures in the UI tree so the page recovers gracefully
 * instead of collapsing to a blank viewport.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Deliberately avoid leaking user state to global logging channels.
  }

  private handleReset = (): void => {
    this.setState({ hasError: false })
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="method" id="main" role="alert">
        <div className="shell">
          <div className="method__head">
            <h1 className="method__title">Something interrupted the display.</h1>
            <p>Your saved household settings are safe. Reload the view to continue.</p>
            <div className="hero__actions">
              <button className="btn btn--primary" type="button" onClick={this.handleReset}>
                Reload view
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }
}
