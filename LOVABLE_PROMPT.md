# Ai Router — Complete Build Specification for Lovable

> **IMPORTANT: Reference the uploaded screenshot of the current application for exact visual fidelity. This document describes every feature, interaction, style, API connection, and backend requirement. Build the entire application from this specification.**

---

## 1. APPLICATION OVERVIEW

**App Name:** Ai Router
**Purpose:** A multi-route delivery/logistics planning tool. Users log in, create route groups with multiple stops, visualize them on a Google Map with color-coded polylines, optimize stop order for shortest driving distance, drag-and-drop reorder stops, label stops, upload CSV files of addresses, print itineraries, share routes, and save/load named route sets to their account.

**Use Case:** A delivery company dispatcher logs in, creates "Monday AM Route" and "Monday PM Route", adds 15 addresses to each (typed or via CSV upload), clicks Optimize to reorder for shortest distance, prints the itinerary for the driver, and saves both routes to their account. Next week they load those saved routes, make tweaks, and re-optimize.

---

## 2. TECH STACK

- **Framework:** React (latest) with Vite
- **UI Components:** shadcn/ui + Tailwind CSS
- **Icons:** Lucide React
- **Maps:** Google Maps JavaScript API via `@react-google-maps/api` — using the `places`, `directions`, and `geocoding` libraries
- **Backend/Auth/Database:** Supabase (auth + PostgreSQL)
- **Font:** Inter (Google Fonts) — weights 300, 400, 500, 600, 700

---

## 3. ENVIRONMENT VARIABLES

```
VITE_GOOGLE_MAPS_API_KEY=AIzaSyB8kIoYTyiBGk9yY5fjojW0ndVNqDshFIc
VITE_SUPABASE_URL=<user will fill in>
VITE_SUPABASE_ANON_KEY=<user will fill in>
```

The Google Maps API key above is real and has Places API, Directions API, Geocoding API, and Maps JavaScript API enabled. Use it directly.

---

## 4. SUPABASE DATABASE SCHEMA

Run this SQL in the Supabase SQL editor to set up the database:

```sql
-- Saved route sets: stores entire route workspace as JSONB
CREATE TABLE saved_routes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Route',
  groups JSONB NOT NULL DEFAULT '[]',
  stops JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_saved_routes_user_id ON saved_routes(user_id);

-- Row Level Security
ALTER TABLE saved_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own routes"
  ON saved_routes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own routes"
  ON saved_routes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own routes"
  ON saved_routes FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own routes"
  ON saved_routes FOR DELETE USING (auth.uid() = user_id);
```

The `groups` column stores an array of route group objects. The `stops` column stores an array of stop objects. This JSONB approach avoids complex joins and matches the frontend data model exactly.

---

## 5. AUTHENTICATION

Use **Supabase Auth** with **email + password** sign-up/sign-in.

### Auth Screen (replaces entire app when not logged in):
- Full-screen dark background (`#0f172a`)
- Centered card (`#1e293b` background, `16px` border-radius, `1px solid #334155` border, `box-shadow: 0 8px 32px rgba(0,0,0,0.4)`, `min-width: 400px`, `padding: 3rem`)
- Truck icon at top (Lucide `Truck`, size 48, color `#3b82f6`)
- Title "Ai Router" with gradient text: `linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)` using `-webkit-background-clip: text` and `-webkit-text-fill-color: transparent`, font-size `1.8rem`, weight `700`
- Subtitle: "Sign in to manage your routes" — color `#94a3b8`, font-size `0.9rem`
- Toggle between **Sign In** and **Sign Up** modes with a text link at bottom
- **Email input** — dark background `#0f172a`, border `1px solid #334155`, white text, `8px` border-radius, `0.75rem 1rem` padding, on focus: border becomes `#3b82f6` with `box-shadow: 0 0 0 2px rgba(59,130,246,0.5)`
- **Password input** — same styling as email
- **Sign Up mode:** also show a **Confirm Password** field
- **Submit button** — full width, blue (`#3b82f6`), white text, `8px` border-radius, `600` weight, `box-shadow: 0 4px 12px rgba(59,130,246,0.5)`, hover: `translateY(-1px)` and stronger shadow
- Error messages in red (`#ef4444`)
- After login, transition to the main app

### Session persistence:
- Supabase handles session via its own localStorage tokens
- On page load, check `supabase.auth.getSession()` — if valid, go straight to app
- Add a **Log Out** button in the sidebar header (small, subtle, next to the logo)

---

## 6. OVERALL LAYOUT

The app is a **full-viewport two-panel layout** (100vw x 100vh, `overflow: hidden`):

```
┌──────────────────┬─────────────────────────────────────┐
│                  │                                     │
│    SIDEBAR       │            GOOGLE MAP               │
│    (400px)       │           (flex: 1)                 │
│                  │                                     │
│                  │                                     │
│                  │                                     │
│                  │                                     │
│                  │                                     │
│                  │                                     │
└──────────────────┴─────────────────────────────────────┘
```

- **Container:** `display: flex; height: 100%; width: 100%;`
- **Sidebar:** `width: 400px`, `background: rgba(30,41,59,0.95)`, `backdrop-filter: blur(10px)`, `border-right: 1px solid #334155`, `display: flex; flex-direction: column; padding: 1.5rem`, `z-index: 10`, `box-shadow: 4px 0 24px rgba(0,0,0,0.2)`
- **Map container:** `flex: 1`, `position: relative`, `background: #0f172a`

---

## 7. DESIGN SYSTEM (CSS Variables)

```css
:root {
  --bg-dark: #0f172a;
  --bg-card: #1e293b;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --accent-primary: #3b82f6;
  --accent-glow: rgba(59, 130, 246, 0.5);
  --success: #10b981;
  --danger: #ef4444;
  --border: #334155;
}
```

**Font:** `'Inter', sans-serif` everywhere. Import: `https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap`

**Custom Scrollbar:**
```css
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
```

---

## 8. SIDEBAR — SECTION BY SECTION (top to bottom)

### 8A. Header
- Logo: Lucide `Truck` icon (size 24, color `#3b82f6`) + text "Ai Router"
- Text uses gradient: `linear-gradient(135deg, #3b82f6, #8b5cf6)` with `background-clip: text`, `font-size: 1.5rem`, `font-weight: 700`
- Small "Log Out" button at far right of header row — muted secondary style

### 8B. Saved Routes Management (NEW — not in original app)
Below the header, add a "Saved Routes" section:
- Dropdown/select that lists all saved route sets from the database for the logged-in user
- Each item shows: route name, date saved, stop count
- **"Load" action** — clicking a saved route populates the workspace (groups + stops) from the database
- **"Save" button** — saves current workspace (groups + stops) to the currently loaded route OR creates a new one. Opens a small modal/popover asking for a name if saving as new.
- **"Save As New" button** — always creates a new saved route with a name prompt
- **"Delete" button** — deletes the selected saved route from the database (with confirmation)
- Small text showing current save state: "Saved" or "Unsaved changes"
- Style: use `--bg-card` background, `--border` borders, compact layout

### 8C. Route Groups ("Your Routes")
- Header row: left side text "YOUR ROUTES" (uppercase, `0.85rem`, `600` weight, color `--text-secondary`), right side "New" button (text link style, blue, Lucide `FolderPlus` icon size 14 + "New" text)
- List of route group cards in a vertical stack with `0.5rem` gap
- Each group card:
  - Clickable row to set as active group
  - **Color dot** (12x12px circle) on the left, filled with group color
  - **Group name** — `0.9rem`, `600` weight if active, `400` if inactive. **Double-click to rename** (inline edit: input field appears with check button). Press Enter to save, Escape to cancel.
  - **Distance badge** — if route is calculated, show `XX.XXmi` in `0.7rem`, color `--text-secondary`, to the right of the name
  - **Visibility toggle** — Lucide `Eye`/`EyeOff` (size 14) button. Toggles whether this group's stops and route polyline show on the map.
  - **Delete button** — Lucide `Trash2` (size 14). Cannot delete the last remaining group.
  - **Active state:** `background: rgba(59,130,246,0.1)`, `border: 1px solid {group.color}`
  - **Inactive state:** `background: var(--bg-card)`, `border: 1px solid transparent`

**Group Colors Palette** (cycles as new groups are added):
```
Blue:   #3b82f6
Red:    #ef4444
Green:  #10b981
Purple: #a855f7
Orange: #f97316
Pink:   #ec4899
Cyan:   #06b6d4
```

### 8D. Address Input Area
- Contained in a box: `background: rgba(15,23,42,0.5)`, `padding: 1rem`, `border-radius: 12px`, `border: 1px solid var(--border)`
- Label text: "Adding to: {active group name}" in the group's color, `0.8rem`, `600` weight
- **Input row:** Google Places Autocomplete input (using `gmp-place-autocomplete` web component OR `@react-google-maps/api` Autocomplete — use whichever Lovable supports best) + a "+" button
  - Input: dark background (`--bg-dark`), `1px solid --border`, white text, `8px` radius, `0.9rem` font, on focus: blue border + glow
  - "+" Button: `0.75rem` padding, square, when input has text: solid blue background + white icon. When empty: card background + secondary color. Lucide `Plus` (size 20).
- Helper text below: "Type an address and click '+' or press Enter to add." — `0.8rem`, `--text-secondary`
- **Behavior:**
  - When user selects from autocomplete dropdown, capture the place
  - When user presses Enter or clicks "+", add the stop
  - If user typed text without selecting from dropdown, use Google Places Text Search API as fallback
  - If the place has a recognizable name different from the address (e.g. "Starbucks"), auto-set that as the stop label
  - After adding, clear input, pan map to the new stop location, zoom to 12

### 8E. Stops List
- Container: `flex: 1; overflow-y: auto; margin-bottom: 1.5rem; padding-right: 0.5rem`
- Grouped by route group. For each visible group that has stops, show:
  - **Group header:** Lucide `Layers` (size 14) + "{Group Name} ({count})" — `0.8rem`, group color, `700` weight
  - **Stop cards** in order:
    - `display: flex; align-items: center; gap: 0.75rem; padding: 1rem`
    - `background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 0.75rem`
    - **Left color bar:** `border-left: 3px solid {group.color}`
    - **Drag handle:** Lucide `GripVertical` (size 14), color `--text-secondary`, `opacity: 0.4`, on hover: `opacity: 1, color: --accent-primary`, cursor: `grab` / `grabbing`
    - **Letter marker:** 24x24px circle, group color background, white bold letter (A, B, C... Z, AA, AB...), `0.75rem` font
    - **Stop details:**
      - **Address:** `0.9rem`, `500` weight, `--text-primary`
      - **Label area** (below address): click to edit. If label exists: show in `0.75rem`, blue (`--accent-primary`). If no label: show "+ Add label" in `0.7rem`, `--text-secondary`, `opacity: 0.6`. Clicking opens inline input with placeholder "Add label (e.g. Pickup, Delivery)" + check button. Enter saves, Escape cancels.
    - **Delete button:** Lucide `Trash2` (size 16), `--text-secondary`, on hover: red + red background tint
    - **Slide-in animation:** new stops animate in with `translateY(10px) → 0` and `opacity: 0 → 1` over `0.3s ease-out`

- **Drag and drop:** stops can be reordered within the same group only (not across groups). When dragging:
  - Dragged item opacity drops to `0.4`
  - Drop target shows `border-top: 2px solid --accent-primary` and subtle blue background tint
  - Auto-scroll the stops list when dragging near the top/bottom edges (50px scroll zone, 8px per 16ms)
  - After reorder, clear any calculated route for that group

- **Empty state** (no stops at all): centered box with dashed border, Lucide `MapPin` (size 32, `opacity: 0.5`), text "No stops yet."

### 8F. Action Buttons (pinned to bottom with `margin-top: auto`)

1. **"Calculate Route in Current Order"** — full width, blue primary button. Lucide `Navigation` (size 18). Disabled if fewer than 2 stops.
2. **"Optimize Route"** — full width, green gradient button (`linear-gradient(135deg, #10b981, #059669)`), white text, green glow shadow. Lucide `Truck` (size 18). Disabled if fewer than 2 stops.
3. **Row of two buttons:**
   - **"Print"** — secondary style, Lucide `Printer` (size 16). **After a route is calculated, this button pulses** with a blue glow animation (keyframes: `box-shadow` pulses from `0 0 0 0 rgba(59,130,246,0.4)` to `0 0 0 10px rgba(59,130,246,0)` over 2s infinite, background subtly shifts to blue tint). Disabled if no stops.
   - **"Share"** — secondary style, Lucide `Share2` (size 16). Disabled if no stops.
4. **"Upload CSV"** — full width, secondary style, Lucide `Upload` (size 16). Shows progress bar and "Importing... (X/Y)" text during import. Disabled while importing.
5. **Small text:** "Routes auto-save to this browser" — `0.7rem`, `--text-secondary`, centered

**Button Styles:**
- `.btn`: `display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; font-size: 0.9rem`
- `.btn-primary`: blue background, white text, blue glow shadow, hover: `translateY(-1px)` + stronger shadow
- `.btn-optimize`: green gradient, white text, green glow, hover: lift
- `.btn-secondary`: `--bg-card` background, `1px solid --border`, `--text-secondary` text, hover: darker bg + white text
- All disabled: `opacity: 0.5; cursor: not-allowed; pointer-events: none; filter: grayscale(100%)`

---

## 9. GOOGLE MAP

### Map Configuration:
- Use `@react-google-maps/api` with `useJsApiLoader`
- API key: `AIzaSyB8kIoYTyiBGk9yY5fjojW0ndVNqDshFIc`
- Libraries: `['places']`
- Version: `'weekly'`
- Default center: `{ lat: 40.7128, lng: -74.0060 }` (New York)
- Default zoom: `10`
- `disableDefaultUI: false`, `zoomControl: true`

### Dark Map Theme (apply as `styles` option):
```javascript
[
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
]
```

### Route Polylines:
- For each visible group that has a calculated route, render a `DirectionsRenderer` with `suppressMarkers: true`
- Polyline options: `strokeColor: group.color`, `strokeWeight: 6`, `strokeOpacity: 0.8`
- **Invisible interaction polylines:** For each leg of the route, render a second `Polyline` with `strokeColor: 'transparent'`, `strokeOpacity: 0`, `strokeWeight: 15`, `zIndex: 100`. This creates a wide hover target.
  - **On mouse hover:** show a floating popup at cursor position with "Leg Info" label + "{distance} mi • {duration}" value
  - Popup: `position: fixed`, dark glass background (`rgba(15,23,42,0.9)`), `backdrop-filter: blur(8px)`, `border: 1px solid --accent-primary`, `border-radius: 8px`, `padding: 10px 14px`, `pointer-events: none`, `z-index: 2000`, `transform: translate(-50%, -100%)`, blue arrow pointing down
  - Popup follows mouse via `onMouseMove`, hides on `onMouseOut`

### Map Markers:
- For each visible stop, render a `Marker` with:
  - Position: `{ lat: stop.lat, lng: stop.lng }`
  - **Custom icon:** `google.maps.SymbolPath.CIRCLE`, fillColor = stop's custom color OR group color, fillOpacity 1, strokeWeight 2, strokeColor white, scale 12
  - **Label:** white bold letter (A, B, C...) matching the stop's index within its group, `fontSize: "12px"`
  - **Selected state:** strokeWeight 4, strokeColor `#fbbf24` (gold), scale 16
  - **Click behavior:** opens a color selector popup near the marker
  - **Ctrl+Click / Cmd+Click:** multi-select mode, toggling pin in/out of selection without showing popup

### Color Selector Popup (on marker click):
- Glassmorphic floating popup: `background: rgba(255,255,255,0.2)`, `backdrop-filter: blur(12px)`, `border: 1px solid rgba(255,255,255,0.3)`, `border-radius: 12px`, `box-shadow: 0 4px 20px rgba(0,0,0,0.3)`
- Row of 6 color dots (20x20px circles, `2px solid rgba(255,255,255,0.5)` border):
  - `#3b82f6` (blue), `#ef4444` (red), `#10b981` (green), `#a855f7` (purple), `#f97316` (orange), `#ec4899` (pink)
- Hover: `scale(1.2)` + white glow
- Click applies color to all selected pins (supports multi-select via Ctrl+Click)
- "×" close button on the right
- Appears near the clicked marker's screen position, fades in with `translateY(5px) → 0` animation

---

## 10. ROUTE CALCULATION LOGIC

### "Calculate Route in Current Order":
- Uses Google Directions API (`DirectionsService`)
- For each visible group with 2+ stops:
  - Origin = first stop address, Destination = last stop address
  - Intermediate stops = waypoints with `stopover: true`
  - `optimizeWaypoints: false` (keeps user's order)
  - `travelMode: DRIVING`
- Store the full `DirectionsResult` per group for rendering polylines
- Calculate totals: sum all `leg.distance.value` (meters → miles: `× 0.000621371`, `.toFixed(2)`) and `leg.duration.value` (seconds → `Xh Ym` or `X min`)
- Display stats as badge on group card

### "Optimize Route":
- Same as above but `optimizeWaypoints: true`
- After result, read `result.routes[0].waypoint_order` to reorder the intermediate stops in the stops list
- First and last stops stay fixed (origin/destination), only intermediates are reordered
- Update the stops array with the optimized order

---

## 11. CSV UPLOAD

**"Upload CSV" button** triggers a hidden file input (`accept=".csv"`).

### CSV Parsing:
- Full RFC-compliant CSV parser handling: quoted fields, commas inside quotes, escaped quotes (`""`), CRLF and LF line endings
- First row = headers

### Smart Column Detection:
Scan headers (case-insensitive) for address columns:
- **Single address column:** headers matching: `address`, `full_address`, `full address`, `location`, `destination`
- **Split address columns:** `street`/`street_address` + `city`/`town` + `state`/`province` + `zip`/`zipcode`/`postal_code` — joined with ", "
- **Label column:** `label`, `name`, `stop_name`, `description`, `notes`, `customer`
- **Fallback:** if no matching headers found, use first non-empty cell of each row as the address
- All other columns are ignored

### Geocoding Process:
- Use `google.maps.Geocoder` to convert each address string to lat/lng
- Process sequentially with **200ms delay** between requests (avoid rate limits)
- Show **progress bar** (4px tall, blue fill, smooth transition) and counter text "Importing... (X/Y)"
- Stops are added to the **currently active route group**
- After import: pan map to first new stop, zoom to 10
- If some addresses fail: show alert "Added X of Y addresses. Some could not be geocoded."
- If all fail: show alert "No addresses could be found in the CSV file."

---

## 12. PRINT ITINERARY

Opens a new browser window with a printable HTML page:

- White background, Arial font
- Title: "🚚 Ai Router Itinerary"
- **Static map image** (if stops exist): Google Static Maps API URL with markers (red, labeled A/B/C...) and encoded polyline path. Falls back gracefully if image fails to load.
- **Table** with columns: Stop (letter in blue circle) | Location | Label | Distance to Next | Est. Drive Time
- Each row shows the leg distance/duration from that stop to the next
- Last stop shows "—" for distance/time
- **Totals row** at bottom: bold, light blue background (`#e0e7ff`), blue top border, summing all distances and durations
- Footer: "Generated by Ai Router"
- Auto-triggers `window.print()` after content loads

---

## 13. SHARE

- If browser supports Web Share API (`navigator.share`): trigger native share with title "My Route", text "Check out my route with {X} stops!", URL = current page URL
- Fallback: copy URL to clipboard and show alert "Link copied to clipboard!"

---

## 14. SAVED ROUTES — DATABASE INTEGRATION (NEW)

This is the major new feature vs the original app.

### Data Model:
```typescript
// Frontend types
interface RouteGroup {
  id: string;            // timestamp-based unique ID
  name: string;          // e.g. "Route 1"
  color: string;         // hex color from palette
  visible: boolean;      // toggle visibility on map
}

interface Stop {
  id: number;            // timestamp-based unique ID
  lat: number;
  lng: number;
  address: string;       // formatted address
  label: string;         // custom label (optional)
  groupId: string;       // reference to parent RouteGroup
  customColor?: string;  // optional marker color override
}

interface SavedRoute {
  id: string;            // UUID from Supabase
  user_id: string;       // from auth
  name: string;          // user-given name
  groups: RouteGroup[];  // JSONB
  stops: Stop[];         // JSONB
  created_at: string;
  updated_at: string;
}
```

### Supabase Operations:
```typescript
// List user's saved routes
const { data } = await supabase
  .from('saved_routes')
  .select('id, name, created_at, updated_at, stops')
  .order('updated_at', { ascending: false });

// Load a saved route
const { data } = await supabase
  .from('saved_routes')
  .select('*')
  .eq('id', routeId)
  .single();

// Save new route
const { data } = await supabase
  .from('saved_routes')
  .insert({ user_id: user.id, name, groups, stops })
  .select()
  .single();

// Update existing route
const { data } = await supabase
  .from('saved_routes')
  .update({ name, groups, stops, updated_at: new Date().toISOString() })
  .eq('id', routeId)
  .select()
  .single();

// Delete route
await supabase
  .from('saved_routes')
  .delete()
  .eq('id', routeId);
```

### UX Flow:
1. On login, fetch the user's saved routes list
2. Show them in the "Saved Routes" section of the sidebar
3. User can click to load a saved route (replaces current workspace)
4. User can save current workspace (with name prompt)
5. User can rename saved routes inline
6. User can delete saved routes (with confirmation dialog)
7. Track "dirty" state — if workspace has unsaved changes, show indicator
8. Also keep localStorage auto-save as a fallback/draft mechanism

---

## 15. ANIMATIONS

1. **slideIn** (new stops appearing): `translateY(10px) → 0`, `opacity: 0 → 1`, `0.3s ease-out`
2. **fadeIn** (popups): `translateY(5px) → 0`, `opacity: 0 → 1`, `0.2s ease-out`
3. **pulse-glow** (Print button after route calculation): infinite 2s cycle — box-shadow pulses from blue glow to transparent, background subtly tints blue
4. **shake** (error state, if you add any): `translateX(0 → -8px → 8px → -4px → 0)`, `0.4s ease-in-out`

---

## 16. ERROR HANDLING

- **Google Maps auth failure:** catch via `window.gm_authFailure` callback. Show error screen with message + "Retry" button that reloads the page.
- **Google Maps load error:** show error code + retry button
- **React Error Boundary:** wrap entire app. On error, show error details + "Reset Application" button that clears localStorage and reloads.
- **Supabase errors:** show toast notifications for save/load/delete failures

---

## 17. HELPER FUNCTIONS

### Index to Letter (for stop markers):
```javascript
// 0→A, 1→B, ..., 25→Z, 26→AA, 27→AB, etc.
const indexToLetter = (index) => {
  let result = '';
  let i = index;
  do {
    result = String.fromCharCode(65 + (i % 26)) + result;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return result;
};
```

### Meters to Miles:
```javascript
const metersToMiles = (meters) => (meters * 0.000621371).toFixed(2);
```

### Format Duration:
```javascript
const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
};
```

---

## 18. KEY INTERACTIONS SUMMARY

| Action | Behavior |
|--------|----------|
| Click group | Set as active group (for adding stops) |
| Double-click group name | Inline rename |
| Click Eye icon | Toggle group visibility on map + stops list |
| Click Trash on group | Delete group + its stops + its route (min 1 group) |
| Click "New" | Add new route group with next color |
| Type + Enter or click "+" | Add stop via Places API |
| Drag stop via grip handle | Reorder within same group, clears calculated route |
| Click stop label area | Inline label editor |
| Click stop Trash | Remove stop |
| Click marker on map | Show color picker popup |
| Ctrl+Click markers | Multi-select markers |
| Pick color in popup | Apply to all selected markers |
| Hover route line on map | Show distance/duration popup following cursor |
| "Calculate Route" button | Directions API, keep order |
| "Optimize Route" button | Directions API, reorder for shortest path |
| "Print" button | Open print window with full itinerary table |
| "Share" button | Web Share API or clipboard fallback |
| "Upload CSV" button | Parse CSV, geocode addresses, add to active group |
| "Save" button | Save workspace to Supabase |
| "Load" saved route | Replace workspace with saved data |
| "Log Out" | Sign out via Supabase, return to auth screen |

---

## 19. IMPORTANT NOTES

- **Do NOT use a .env file for the Google Maps API key** — hardcode it or use Vite env vars. The key is: `AIzaSyB8kIoYTyiBGk9yY5fjojW0ndVNqDshFIc`
- The app title in the browser tab should be "Ai Router"
- Supabase URL and anon key should come from environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- Make sure the Google Maps `<script>` only loads once (use `useJsApiLoader` with a consistent ID)
- All distances display in **miles**, all durations in **hours and minutes**
- The sidebar should be scrollable only in the stops list area — header, input, and action buttons stay fixed
- Route polyline colors must match their group color
- When a stop is added/removed/reordered, clear the calculated route for that group (user must re-calculate)

---

**Build this complete application. Reference the uploaded screenshot for exact visual appearance. The screenshot shows the dark theme sidebar with route groups, address input, stops list with drag handles and labels, and the Google Map with dark styling, colored route polylines, and labeled circular markers.**
