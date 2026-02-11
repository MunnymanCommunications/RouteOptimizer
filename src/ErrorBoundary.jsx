import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
        console.error("Uncaught error:", error, errorInfo);
    }

    handleReset = () => {
        localStorage.removeItem('GOOGLE_MAPS_API_KEY');
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '2rem',
                    backgroundColor: '#0f172a',
                    color: '#ef4444',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center'
                }}>
                    <h1 style={{ marginBottom: '1rem' }}>Something went wrong.</h1>
                    <details style={{ whiteSpace: 'pre-wrap', marginBottom: '1rem', color: '#94a3b8', maxWidth: '800px', textAlign: 'left', background: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                    <button
                        onClick={this.handleReset}
                        style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Reset Application & API Key
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
