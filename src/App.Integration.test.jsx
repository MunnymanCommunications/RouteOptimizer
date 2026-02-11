import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import App from './App';
import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock the Google Maps API loader and components
vi.mock('@react-google-maps/api', () => ({
    useJsApiLoader: () => ({ isLoaded: true, loadError: null }),
    GoogleMap: ({ children }) => <div data-testid="google-map">{children}</div>,
    Marker: () => <div data-testid="marker" />,
    DirectionsRenderer: () => <div data-testid="directions-renderer" />,
    Autocomplete: ({ children }) => <div>{children}</div>,
}));

describe('App Component Integration', () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('renders correctly and manages groups', async () => {
        // Mock API Key presence
        const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
        getItemSpy.mockReturnValue('TEST_API_KEY');

        render(<App />);

        // 1. Check Initial State
        expect(screen.getByText('RouteMaster')).toBeInTheDocument();
        expect(screen.getByText('Route 1')).toBeInTheDocument();
        expect(screen.getByText('Adding to: Route 1')).toBeInTheDocument();

        // 2. Test Adding a New Group
        const newButton = screen.getByText(/New/i);
        fireEvent.click(newButton);

        await waitFor(() => {
            expect(screen.getByText('Route 2')).toBeInTheDocument();
        });

        // 3. Test Switching Active Group
        // The previous click should have auto-selected Route 2, let's verify UI reflects that
        expect(screen.getByText('Adding to: Route 2')).toBeInTheDocument();

        // Click back to Route 1
        const route1 = screen.getByText('Route 1');
        fireEvent.click(route1);

        await waitFor(() => {
            expect(screen.getByText('Adding to: Route 1')).toBeInTheDocument();
        });
    });
});
