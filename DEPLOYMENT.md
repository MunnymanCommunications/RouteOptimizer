# Deploying RouteMaster on Coolify

This guide explains how to deploy the **RouteMaster** application on your Coolify instance.

## Prerequisites
- A Coolify instance running and accessible.
- A GitHub account connected to your Coolify instance.
- A Google Maps API Key with **Places API**, **Maps JavaScript API**, **Directions API**, and **Geocoding API** enabled.

## Deployment Steps

1.  **Login to Coolify**: Access your Coolify dashboard.
2.  **Create New Resource**:
    *   Click **"Add New Resource"** (or "+ New").
    *   Select **"Private Repository"** (since this repo is private) or "Public Repository" if you made it public.
    *   Select the repository: `MunnymanCommunications/RouteOptimizer`
    *   Select the branch: `main`
3.  **App Configuration**:
    *   **Build Pack**: Select **Static Site** (Recommended for React/Vite apps).
    *   **Output Directory**: Set to `dist` (default for Vite).
    *   **Build Command**: Set to `npm install && npm run build`.
    *   **Port**: 80 (default for static sites) or 3000 if using a node server.
4.  **Environment Variables**:
    *   Go to the **"Environment Variables"** tab for your new resource.
    *   Add the following key-value pair:

    | Key | Value | Description |
    | :--- | :--- | :--- |
    | `VITE_GOOGLE_MAPS_API_KEY` | `YOUR_ACTUAL_GOOGLE_MAPS_API_KEY` | Required for map rendering and places search. |

    *   **Important**: Make sure to enable "Build Variable" if Coolify requires it for build-time embedding (Vite uses env vars at build time).

5.  **Deploy**:
    *   Click **"Deploy"**.
    *   Wait for the build logs to complete.
    *   Once finished, your app will be available at the provided domain (e.g., `http://<your-coolify-domain>/`).

## Alternative: Node Application (Nixpacks)
If "Static Site" is not an option or you prefer a Node server:
1.  **Build Pack**: Select **Nixpacks**.
2.  **Build Command**: `npm install && npm run build`
3.  **Start Command**: `npx serve -s dist -l 3000`
4.  **Port**: `3000`
5.  **Environment Variables**: Same as above (`VITE_GOOGLE_MAPS_API_KEY`).

## Troubleshooting
- **Map not loading?** Check that your API key has the correct referrers restricted to your Coolify domain.
- **"Vite" command not found?** Ensure the build command includes `npm install`.
