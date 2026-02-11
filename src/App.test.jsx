import { render, screen, cleanup } from '@testing-library/react';
import App from './App';
import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock the Google Maps API loader and components
vi.mock('@react-google-maps/api', () => ({
    useJsApiLoader: () => ({ isLoaded: true, loadError: null }),
    GoogleMap: ({ children }) => <div data-testid="google-map">{children}</div>,
    Marker: () => <div data-testid="marker" />,
    DirectionsRenderer: () => <div data-testid="directions-renderer" />,
}));

// Mock the Web Component since JSDOM doesn't support custom elements fully in tests without setup
vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        // We can't easily mock the intrinsic element <gmp-place-autocomplete> but we can
        // ensure the component rendering it doesn't crash.
        // For unit tests, we mainly care that the logic around it works.
    };
});

describe('App Component', () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('renders map dashboard correctly', () => {
        render(<App />);
        expect(screen.getByText('RouteMaster')).toBeInTheDocument();
        expect(screen.getByText('Your Routes')).toBeInTheDocument();
        expect(screen.getByText('Adding to: Route 1')).toBeInTheDocument();

        // The web component won't be in the document index in the same way, but the container should be there
        expect(screen.getByText(/Search and select location/i)).toBeInTheDocument();
    });
});
