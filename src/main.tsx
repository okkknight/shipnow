import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="sn-page">
          <div className="sn-page-backdrop" />
          <div className="sn-page-shell">
            <div className="sn-empty-state">
              <div className="sn-empty-title">页面渲染出错</div>
              <p className="sn-empty-description">{this.state.error.message}</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
