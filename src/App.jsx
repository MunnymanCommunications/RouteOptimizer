import React, { useState, useCallback, useRef, useEffect, useImperativeHandle } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import { MapPin, Navigation, Plus, Trash2, Truck, Layers, Eye, EyeOff, FolderPlus, Circle, Printer, Share2, GripVertical, Edit3, Check, Lock, Upload } from 'lucide-react';
import './index.css';

// Helper: Convert 0-based index to letter (A, B, C, ... Z, AA, AB...)
const indexToLetter = (index) => {
  let result = '';
  let i = index;
  do {
    result = String.fromCharCode(65 + (i % 26)) + result;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return result;
};

const containerStyle = {
  width: '100%',
  height: '100%'
};

const center = {
  lat: 40.7128,
  lng: -74.0060
};

// Use 'places' library
const libraries = ['places'];

const GROUP_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Green', value: '#10b981' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Cyan', value: '#06b6d4' }
];

const PIN_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#a855f7', '#f97316', '#ec4899'];

// Storage keys for localStorage persistence
const STORAGE_KEYS = {
  GROUPS: 'ai_router_groups',
  STOPS: 'ai_router_stops',
  AUTH: 'ai_router_authenticated'
};

// 4-digit PIN code — change this value or set VITE_PIN_CODE in your .env file
const PIN_CODE = import.meta.env.VITE_PIN_CODE || '1234';

// Conversion Helpers
const metersToMiles = (meters) => (meters * 0.000621371).toFixed(2);
const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
};
// --- CSV Parsing Helpers ---
const parseCSV = (text) => {
  const rows = [];
  let current = '';
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(current);
        current = '';
      } else if (char === '\n' || (char === '\r' && text[i + 1] === '\n')) {
        row.push(current);
        current = '';
        rows.push(row);
        row = [];
        if (char === '\r') i++;
      } else {
        current += char;
      }
    }
  }
  if (current || row.length > 0) {
    row.push(current);
    rows.push(row);
  }
  return rows;
};

const findColumn = (headers, candidates) => {
  for (const candidate of candidates) {
    const idx = headers.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  for (const candidate of candidates) {
    const idx = headers.findIndex(h => h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
};

// --- Web Component Wrapper for Places API (New) ---
const PlaceComponent = React.forwardRef(({ onPlaceSelect, onInputChange, placeholder }, ref) => {
  const innerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    clear: () => {
      if (innerRef.current) innerRef.current.value = '';
    },
    focus: () => {
      // Try to focus the input inside or the element
      if (innerRef.current) innerRef.current.focus();
    }
  }));

  useEffect(() => {
    const el = innerRef.current;
    if (el) {
      const listener = async (event) => {
        console.log('gmp-placeselect event received:', event);
        // Payload: event.place (Place object) or event.detail.place
        const place = event.place || (event.detail && event.detail.place);

        if (place) {
          try {
            await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
            onPlaceSelect(place);
          } catch (err) {
            console.error("Error fetching place fields:", err);
          }
        }
      };

      const inputListener = (e) => {
        // Update parent state with current text to enable/disable buttons and allow fallback search
        if (onInputChange) {
          onInputChange(el.value);
        }
      };

      // Listen for both event names for compatibility/robustness
      el.addEventListener('gmp-placeselect', listener);
      el.addEventListener('gmp-select', listener);
      el.addEventListener('input', inputListener);

      return () => {
        el.removeEventListener('gmp-placeselect', listener);
        el.removeEventListener('gmp-select', listener);
        el.removeEventListener('input', inputListener);
      };
    }
  }, [onPlaceSelect, onInputChange]);

  return (
    <gmp-place-autocomplete ref={innerRef} placeholder={placeholder} style={{ flex: 1 }}>
      <input type="text" className="input-field" style={{ width: '100%' }} />
    </gmp-place-autocomplete>
  );
});

// --- PIN Gate Component ---
const PinGate = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.AUTH) === 'true';
  });
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const pinRefs = useRef([]);

  useEffect(() => {
    if (!authenticated && pinRefs.current[0]) {
      pinRefs.current[0].focus();
    }
  }, [authenticated]);

  if (authenticated) return children;

  const checkPin = (newPin) => {
    const fullPin = newPin.join('');
    if (fullPin.length === 4 && newPin.every(d => d !== '')) {
      if (fullPin === PIN_CODE) {
        localStorage.setItem(STORAGE_KEYS.AUTH, 'true');
        setAuthenticated(true);
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => {
          setPin(['', '', '', '']);
          setShake(false);
          pinRefs.current[0]?.focus();
        }, 500);
      }
    }
  };

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError(false);

    if (value && index < 3) {
      pinRefs.current[index + 1]?.focus();
    }

    checkPin(newPin);
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length === 4) {
      const newPin = pasted.split('');
      setPin(newPin);
      checkPin(newPin);
    }
  };

  return (
    <div className="pin-gate">
      <div className="pin-container">
        <div className="pin-icon">
          <Lock size={48} />
        </div>
        <h1 className="pin-title">Ai Router</h1>
        <p className="pin-subtitle">Enter your 4-digit PIN to continue</p>
        <div className={`pin-inputs ${shake ? 'pin-shake' : ''}`}>
          {pin.map((digit, i) => (
            <input
              key={i}
              ref={el => pinRefs.current[i] = el}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className={`pin-input ${error ? 'pin-input-error' : ''}`}
              autoFocus={i === 0}
            />
          ))}
        </div>
        {error && <p className="pin-error-text">Incorrect PIN. Try again.</p>}
      </div>
    </div>
  );
};

// Inner component logic
const MapContent = ({ apiKey }) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries,
    version: 'weekly'
  });

  const [map, setMap] = React.useState(null);
  const [groups, setGroups] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GROUPS);
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore parse errors */ }
    return [{ id: 'default', name: 'Route 1', color: GROUP_COLORS[0].value, visible: true }];
  });
  const [activeGroupId, setActiveGroupId] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GROUPS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) return parsed[0].id;
      }
    } catch (e) { /* ignore */ }
    return 'default';
  });
  const [stops, setStops] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STOPS);
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore parse errors */ }
    return [];
  });
  const [routeResults, setRouteResults] = useState({});
  const [routeStats, setRouteStats] = useState({});

  // Simple address input state
  const [addressInput, setAddressInput] = useState('');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef(null);

  // Pin selection and color popup state
  const [selectedPins, setSelectedPins] = useState([]);
  const [colorPopup, setColorPopup] = useState({ visible: false, x: 0, y: 0 });

  // Path info popup state (hover/click on route)
  const [pathInfo, setPathInfo] = useState({ visible: false, x: 0, y: 0, distance: '', duration: '' });

  // Drag-and-drop state
  const [dragItem, setDragItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);

  // Editing state for route names
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState('');

  // Editing state for stop labels
  const [editingStopId, setEditingStopId] = useState(null);
  const [editingStopLabel, setEditingStopLabel] = useState('');

  // Auto-save groups and stops to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STOPS, JSON.stringify(stops));
  }, [stops]);

  const onLoad = useCallback(function callback(map) {
    if (window.google) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(center);
      map.fitBounds(bounds);
      setMap(map);
    }
  }, []);

  const onUnmount = useCallback(function callback(map) {
    setMap(null);
  }, []);

  // --- Group Logic ---
  const addGroup = () => {
    const nextColorIndex = groups.length % GROUP_COLORS.length;
    const newGroup = {
      id: Date.now().toString(),
      name: `Route ${groups.length + 1}`,
      color: GROUP_COLORS[nextColorIndex].value,
      visible: true
    };
    setGroups([...groups, newGroup]);
    setActiveGroupId(newGroup.id);
  };

  const toggleGroupVisibility = (e, groupId) => {
    e.stopPropagation();
    setGroups(groups.map(g => g.id === groupId ? { ...g, visible: !g.visible } : g));
  };

  const deleteGroup = (e, groupId) => {
    e.stopPropagation();
    if (groups.length === 1) return;
    setGroups(groups.filter(g => g.id !== groupId));
    setStops(stops.filter(s => s.groupId !== groupId));

    // Cleanup results
    const newResults = { ...routeResults };
    delete newResults[groupId];
    setRouteResults(newResults);

    const newStats = { ...routeStats };
    delete newStats[groupId];
    setRouteStats(newStats);

    if (activeGroupId === groupId) {
      setActiveGroupId(groups[0].id);
    }
  };

  // --- Stop Logic (Using Places API New) ---
  const handlePlaceSelect = (place) => {
    console.log("Place Selected:", place);
    setSelectedPlace(place);
    setAddressInput(place.displayName || place.formattedAddress);
  };

  const addStop = async () => {
    if ((!addressInput.trim() && !selectedPlace) || !window.google || isAdding) return;

    setIsAdding(true);

    try {
      let location = null;

      if (selectedPlace) {
        // Use displayName as label if it's a recognizable place name (not same as address)
        const placeName = selectedPlace.displayName || '';
        const address = selectedPlace.formattedAddress || selectedPlace.displayName;
        const autoLabel = (placeName && placeName !== address) ? placeName : '';
        location = {
          lat: selectedPlace.location.lat(),
          lng: selectedPlace.location.lng(),
          address: address,
          label: autoLabel,
          id: Date.now(),
          groupId: activeGroupId
        };
      } else {
        // Fallback: Text Search if user typed but didn't select
        const { Place } = await window.google.maps.importLibrary("places");

        const request = {
          textQuery: addressInput,
          fields: ['displayName', 'formattedAddress', 'location'],
          maxResultCount: 1
        };

        const { places } = await Place.searchByText(request);

        if (places && places.length > 0) {
          const place = places[0];
          const placeName = place.displayName || '';
          const address = place.formattedAddress || place.displayName;
          const autoLabel = (placeName && placeName !== address) ? placeName : '';
          location = {
            lat: place.location.lat(),
            lng: place.location.lng(),
            address: address,
            label: autoLabel,
            id: Date.now(),
            groupId: activeGroupId
          };
        }
      }

      if (location) {
        const newStops = [...stops, location];
        setStops(newStops);

        // Clear route for recalculation
        clearRoute(activeGroupId);

        // Pan Map
        if (map) {
          map.panTo({ lat: location.lat, lng: location.lng });
          map.setZoom(12);
        }

        // Clear input
        setAddressInput('');
        setSelectedPlace(null);
        if (inputRef.current && inputRef.current.clear) {
          inputRef.current.clear();
        }
      } else {
        alert('Could not find that address. Please try again.');
      }
    } catch (error) {
      console.error('Places API error:', error);
      alert('Error finding address. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };


  // Handle Enter key in input
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && addressInput.trim()) {
      addStop();
    }
  };

  const removeStop = (id, groupId) => {
    const updatedStops = stops.filter(stop => stop.id !== id);
    setStops(updatedStops);
    clearRoute(groupId);
    setSelectedPins(prev => prev.filter(pinId => pinId !== id));
  };

  // --- Drag and Drop Logic ---
  const stopsListRef = useRef(null);
  const dragScrollInterval = useRef(null);

  const handleDragStart = (e, stopId, groupId) => {
    setDragItem({ stopId, groupId });
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.4';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDragItem(null);
    setDragOverItem(null);
    if (dragScrollInterval.current) {
      clearInterval(dragScrollInterval.current);
      dragScrollInterval.current = null;
    }
  };

  const handleDragOver = (e, stopId, groupId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragItem && dragItem.groupId === groupId) {
      setDragOverItem({ stopId, groupId });
    }

    // Auto-scroll the stops list when dragging near edges
    const listEl = stopsListRef.current;
    if (!listEl) return;
    const rect = listEl.getBoundingClientRect();
    const scrollZone = 50;
    const y = e.clientY;

    if (dragScrollInterval.current) {
      clearInterval(dragScrollInterval.current);
      dragScrollInterval.current = null;
    }

    if (y < rect.top + scrollZone && listEl.scrollTop > 0) {
      dragScrollInterval.current = setInterval(() => {
        listEl.scrollTop -= 8;
      }, 16);
    } else if (y > rect.bottom - scrollZone && listEl.scrollTop < listEl.scrollHeight - listEl.clientHeight) {
      dragScrollInterval.current = setInterval(() => {
        listEl.scrollTop += 8;
      }, 16);
    }
  };

  const handleDrop = (e, targetStopId, groupId) => {
    e.preventDefault();
    if (!dragItem || dragItem.groupId !== groupId) return;

    const groupStops = stops.filter(s => s.groupId === groupId);
    const otherStops = stops.filter(s => s.groupId !== groupId);

    const fromIndex = groupStops.findIndex(s => s.id === dragItem.stopId);
    const toIndex = groupStops.findIndex(s => s.id === targetStopId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const reordered = [...groupStops];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    setStops([...otherStops, ...reordered]);
    clearRoute(groupId);
    setDragItem(null);
    setDragOverItem(null);
  };

  // --- Rename Route Logic ---
  const startEditingGroup = (e, groupId, currentName) => {
    e.stopPropagation();
    setEditingGroupId(groupId);
    setEditingGroupName(currentName);
  };

  const saveGroupName = (groupId) => {
    if (editingGroupName.trim()) {
      setGroups(groups.map(g => g.id === groupId ? { ...g, name: editingGroupName.trim() } : g));
    }
    setEditingGroupId(null);
    setEditingGroupName('');
  };

  // --- Stop Label Logic ---
  const startEditingStop = (e, stopId, currentLabel) => {
    e.stopPropagation();
    setEditingStopId(stopId);
    setEditingStopLabel(currentLabel || '');
  };

  const saveStopLabel = (stopId) => {
    setStops(stops.map(s => s.id === stopId ? { ...s, label: editingStopLabel.trim() } : s));
    setEditingStopId(null);
    setEditingStopLabel('');
  };

  // --- Pin Selection & Color Logic ---
  const handleMarkerClick = (stop, event) => {
    const isCtrlPressed = event.domEvent?.ctrlKey || event.domEvent?.metaKey;

    if (isCtrlPressed) {
      // Multi-select mode: toggle pin in selection
      setSelectedPins(prev => {
        if (prev.includes(stop.id)) {
          return prev.filter(id => id !== stop.id);
        } else {
          return [...prev, stop.id];
        }
      });
    } else {
      // Single select: show color popup
      setSelectedPins([stop.id]);

      // Get screen position for popup (approximate based on marker position)
      if (map) {
        const projection = map.getProjection();
        if (projection) {
          const point = projection.fromLatLngToPoint(new window.google.maps.LatLng(stop.lat, stop.lng));
          const scale = Math.pow(2, map.getZoom());
          const bounds = map.getBounds();
          const ne = projection.fromLatLngToPoint(bounds.getNorthEast());
          const sw = projection.fromLatLngToPoint(bounds.getSouthWest());

          const mapDiv = document.querySelector('.map-container');
          if (mapDiv) {
            const mapRect = mapDiv.getBoundingClientRect();
            const x = ((point.x - sw.x) * scale) / ((ne.x - sw.x) * scale) * mapRect.width;
            const y = ((point.y - ne.y) * scale) / ((sw.y - ne.y) * scale) * mapRect.height;

            setColorPopup({ visible: true, x: x + mapRect.left, y: y + mapRect.top - 60 });
          }
        }
      }
    }
  };

  const applyColorToSelected = (color) => {
    setStops(prevStops =>
      prevStops.map(stop =>
        selectedPins.includes(stop.id) ? { ...stop, customColor: color } : stop
      )
    );
    setColorPopup({ visible: false, x: 0, y: 0 });
    setSelectedPins([]);
  };

  const closeColorPopup = () => {
    setColorPopup({ visible: false, x: 0, y: 0 });
    setSelectedPins([]);
  };

  // --- Print & Share Logic ---
  const printItinerary = () => {
    // Calculate distances between consecutive stops
    const visibleStops = stops.filter(s => {
      const g = groups.find(gr => gr.id === s.groupId);
      return g && g.visible;
    });

    // Build print content
    let printContent = `
      <html>
      <head>
        <title>Route Itinerary</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #3b82f6; }
          .map-placeholder { background: #f0f0f0; padding: 20px; text-align: center; margin-bottom: 20px; border-radius: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background: #3b82f6; color: white; }
          tr:nth-child(even) { background: #f9f9f9; }
          .stop-number { display: inline-block; width: 24px; height: 24px; background: #3b82f6; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>🚚 Ai Router Itinerary</h1>
    `;

    // Add static map if we have stops
    if (visibleStops.length > 0) {
      const markers = visibleStops.map((stop, i) =>
        `markers=color:red%7Clabel:${indexToLetter(i)}%7C${stop.lat},${stop.lng}`
      ).join('&');

      // Add route path from directions results if available
      let pathParam = '';
      for (const group of groups) {
        if (!group.visible) continue;
        const result = routeResults[group.id];
        if (result && result.routes && result.routes[0] && result.routes[0].overview_polyline) {
          const encodedPath = result.routes[0].overview_polyline;
          pathParam += `&path=weight:4%7Ccolor:0x3b82f6ff%7Cenc:${encodedPath}`;
        }
      }

      const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=800x400&maptype=roadmap${pathParam}&${markers}&key=${VERIFIED_API_KEY}`;
      printContent += `<img src="${staticMapUrl}" style="width: 100%; max-height: 400px; object-fit: contain; border-radius: 8px; margin-bottom: 20px;" onerror="this.style.display='none'" />`;
    }

    // Add stops table
    printContent += `
      <table>
        <tr><th>Stop</th><th>Location</th><th>Label</th><th>Distance to Next</th><th>Est. Drive Time</th></tr>
    `;

    let grandTotalDist = 0;
    let grandTotalDur = 0;

    visibleStops.forEach((stop, i) => {
      const isLast = i === visibleStops.length - 1;
      const groupResult = routeResults[stop.groupId];

      const groupStops = visibleStops.filter(s => s.groupId === stop.groupId);
      const indexInGroup = groupStops.findIndex(s => s.id === stop.id);
      const leg = groupResult?.routes[0]?.legs[indexInGroup];

      let distVal = 0;
      let durVal = 0;
      if (!isLast && leg) {
        distVal = leg.distance.value;
        durVal = leg.duration.value;
      }
      grandTotalDist += distVal;
      grandTotalDur += durVal;

      const distanceText = isLast ? '—' : (leg ? `${metersToMiles(distVal)} mi` : '—');
      const timeText = isLast ? '—' : (leg ? formatDuration(durVal) : '—');
      const labelText = stop.label || '';

      printContent += `
        <tr>
          <td><span class="stop-number">${indexToLetter(i)}</span></td>
          <td>${stop.address}</td>
          <td>${labelText}</td>
          <td>${distanceText}</td>
          <td>${timeText}</td>
        </tr>
      `;
    });

    // Add totals row
    printContent += `
      <tr style="background: #e0e7ff; font-weight: bold; border-top: 3px solid #3b82f6;">
        <td colspan="3" style="text-align: right;">TOTALS</td>
        <td>${metersToMiles(grandTotalDist)} mi</td>
        <td>${formatDuration(grandTotalDur)}</td>
      </tr>
    `;

    printContent += `
      </table>
      <p style="margin-top: 20px; color: #666; font-size: 12px;">Generated by Ai Router</p>
      </body></html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const shareRoute = async () => {
    const shareData = {
      title: 'My Route',
      text: `Check out my route with ${stops.length} stops!`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  // --- CSV Import ---
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvProgress, setCsvProgress] = useState({ current: 0, total: 0 });

  const importCSV = () => {
    if (csvImporting) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setCsvImporting(true);
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length < 2) {
        alert('CSV file is empty or has no data rows.');
        setCsvImporting(false);
        return;
      }

      const headers = rows[0].map(h => h.toLowerCase().trim());
      const dataRows = rows.slice(1).filter(row => row.some(cell => cell.trim()));

      // Find address-related columns
      const addressCol = findColumn(headers, ['address', 'full_address', 'full address', 'location', 'destination']);
      const streetCol = findColumn(headers, ['street', 'street_address', 'street address', 'address1', 'address_1', 'address 1']);
      const cityCol = findColumn(headers, ['city', 'town']);
      const stateCol = findColumn(headers, ['state', 'province', 'st']);
      const zipCol = findColumn(headers, ['zip', 'zipcode', 'zip_code', 'zip code', 'postal', 'postal_code']);
      const labelCol = findColumn(headers, ['label', 'name', 'stop_name', 'stop name', 'description', 'notes', 'customer']);

      setCsvProgress({ current: 0, total: dataRows.length });

      const geocoder = new window.google.maps.Geocoder();
      const newStops = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        let address = '';

        if (addressCol !== -1) {
          address = row[addressCol]?.trim() || '';
        } else if (streetCol !== -1) {
          const parts = [];
          if (row[streetCol]?.trim()) parts.push(row[streetCol].trim());
          if (cityCol !== -1 && row[cityCol]?.trim()) parts.push(row[cityCol].trim());
          if (stateCol !== -1 && row[stateCol]?.trim()) parts.push(row[stateCol].trim());
          if (zipCol !== -1 && row[zipCol]?.trim()) parts.push(row[zipCol].trim());
          address = parts.join(', ');
        } else {
          // Fallback: use the first non-empty cell
          address = row.find(cell => cell.trim())?.trim() || '';
        }

        if (!address) continue;

        const label = labelCol !== -1 ? (row[labelCol]?.trim() || '') : '';

        try {
          const result = await new Promise((resolve, reject) => {
            geocoder.geocode({ address }, (results, status) => {
              if (status === 'OK' && results[0]) resolve(results[0]);
              else reject(new Error(status));
            });
          });

          newStops.push({
            id: Date.now() + i,
            lat: result.geometry.location.lat(),
            lng: result.geometry.location.lng(),
            address: result.formatted_address,
            label,
            groupId: activeGroupId
          });
        } catch (err) {
          console.warn(`Could not geocode: "${address}"`, err.message);
        }

        setCsvProgress({ current: i + 1, total: dataRows.length });

        // Small delay to avoid geocoding rate limits
        if (i < dataRows.length - 1) {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      if (newStops.length > 0) {
        setStops(prev => [...prev, ...newStops]);
        clearRoute(activeGroupId);

        if (map && newStops[0]) {
          map.panTo({ lat: newStops[0].lat, lng: newStops[0].lng });
          map.setZoom(10);
        }
      }

      setCsvImporting(false);
      setCsvProgress({ current: 0, total: 0 });

      if (newStops.length === 0) {
        alert('No addresses could be found in the CSV file.');
      } else if (newStops.length < dataRows.length) {
        alert(`Added ${newStops.length} of ${dataRows.length} addresses. Some could not be geocoded.`);
      }
    };
    input.click();
  };

  const clearRoute = (groupId) => {
    const newResults = { ...routeResults };
    delete newResults[groupId];
    setRouteResults(newResults);


    const newStats = { ...routeStats };
    delete newStats[groupId];
    setRouteStats(newStats);
  };

  // --- Routing Logic ---
  const calculateRoutesInOrder = async () => {
    const directionsService = new window.google.maps.DirectionsService();
    const newResults = { ...routeResults };
    const newStats = { ...routeStats };
    let hasUpdates = false;

    for (const group of groups) {
      if (!group.visible) continue;

      const groupStops = stops.filter(s => s.groupId === group.id);
      if (groupStops.length < 2) continue;

      const origin = groupStops[0];
      const destination = groupStops[groupStops.length - 1];
      const intermediateStops = groupStops.slice(1, groupStops.length - 1);

      const waypoints = intermediateStops.map(stop => ({
        location: stop.address,
        stopover: true
      }));

      try {
        const result = await directionsService.route({
          origin: origin.address,
          destination: destination.address,
          waypoints: waypoints,
          optimizeWaypoints: false,
          travelMode: window.google.maps.TravelMode.DRIVING
        });

        newResults[group.id] = result;

        let totalDist = 0;
        let totalDur = 0;
        result.routes[0].legs.forEach(leg => {
          totalDist += leg.distance.value;
          totalDur += leg.duration.value;
        });

        newStats[group.id] = {
          distance: metersToMiles(totalDist),
          duration: formatDuration(totalDur)
        };
        hasUpdates = true;
      } catch (error) {
        console.error(`Error calculating route for ${group.name}:`, error);
      }
    }

    if (hasUpdates) {
      setRouteResults(newResults);
      setRouteStats(newStats);
    }
  };

  const optimizeRoutes = async () => {
    const directionsService = new window.google.maps.DirectionsService();
    const newResults = { ...routeResults };
    const newStats = { ...routeStats };
    let hasUpdates = false;
    let finalStopsList = [...stops];

    for (const group of groups) {
      if (!group.visible) continue;

      const currentGroupStops = finalStopsList.filter(s => s.groupId === group.id);
      if (currentGroupStops.length < 2) continue;

      const origin = currentGroupStops[0];
      const destination = currentGroupStops[currentGroupStops.length - 1];
      const intermediateStops = currentGroupStops.slice(1, currentGroupStops.length - 1);

      const waypoints = intermediateStops.map(stop => ({
        location: stop.address,
        stopover: true
      }));

      try {
        const result = await directionsService.route({
          origin: origin.address,
          destination: destination.address,
          waypoints: waypoints,
          optimizeWaypoints: true,
          travelMode: window.google.maps.TravelMode.DRIVING
        });

        newResults[group.id] = result;

        if (result.routes[0].waypoint_order && result.routes[0].waypoint_order.length > 0) {
          const order = result.routes[0].waypoint_order;
          const orderedIntermediates = order.map(index => intermediateStops[index]);
          const optimizedGroupStops = [origin, ...orderedIntermediates, destination];

          finalStopsList = finalStopsList.filter(s => s.groupId !== group.id);
          finalStopsList = [...finalStopsList, ...optimizedGroupStops];
        }

        let totalDist = 0;
        let totalDur = 0;
        result.routes[0].legs.forEach(leg => {
          totalDist += leg.distance.value;
          totalDur += leg.duration.value;
        });

        newStats[group.id] = {
          distance: metersToMiles(totalDist),
          duration: formatDuration(totalDur)
        };
        hasUpdates = true;
      } catch (error) {
        console.error(`Error calculating route for ${group.name}:`, error);
      }
    }

    if (hasUpdates) {
      setStops(finalStopsList);
      setRouteResults(newResults);
      setRouteStats(newStats);
    }
  };

  const getMarkerIcon = (color, isSelected = false) => {
    if (!window.google) return null;
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 1,
      strokeWeight: isSelected ? 4 : 2,
      strokeColor: isSelected ? '#fbbf24' : '#ffffff',
      scale: isSelected ? 16 : 12,
    };
  };

  // Auth Error State
  const [authError, setAuthError] = useState(false);
  useEffect(() => {
    window.gm_authFailure = () => {
      setAuthError(true);
    };
    return () => { window.gm_authFailure = null; }
  }, []);

  if (loadError || authError) {
    const errorMsg = loadError ? (loadError.message || JSON.stringify(loadError)) : "Authentication Failure";
    return (
      <div className="map-loading" style={{ flexDirection: 'column', padding: '2rem', textAlign: 'center' }}>
        <h3 style={{ color: '#ef4444', marginBottom: '1rem' }}>Map Error</h3>
        <code style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', display: 'block' }}>{errorMsg}</code>
        <button onClick={() => { localStorage.removeItem('GOOGLE_MAPS_API_KEY'); window.location.reload(); }} className="btn btn-primary">Retry</button>
      </div>
    )
  }

  const activeGroup = groups.find(g => g.id === activeGroupId);

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <Truck size={24} color="#3b82f6" />
            <span>Ai Router</span>
          </div>
        </div>

        {/* Groups */}
        <div className="mb-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Your Routes</h3>
            <button onClick={addGroup} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}><FolderPlus size={14} /> New</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {groups.map(group => (
              <div key={group.id} onClick={() => setActiveGroupId(group.id)} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem', borderRadius: '8px', background: activeGroupId === group.id ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-card)', border: `1px solid ${activeGroupId === group.id ? group.color : 'transparent'}`, cursor: 'pointer' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: group.color, marginRight: '10px' }}></div>
                {editingGroupId === group.id ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editingGroupName}
                      onChange={(e) => setEditingGroupName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveGroupName(group.id); if (e.key === 'Escape') setEditingGroupId(null); }}
                      autoFocus
                      style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--accent-primary)', color: 'var(--text-primary)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.9rem', outline: 'none' }}
                    />
                    <button onClick={() => saveGroupName(group.id)} style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', padding: '2px' }}><Check size={14} /></button>
                  </div>
                ) : (
                  <span
                    style={{ fontSize: '0.9rem', flex: 1, fontWeight: activeGroupId === group.id ? '600' : '400', cursor: 'text' }}
                    onDoubleClick={(e) => startEditingGroup(e, group.id, group.name)}
                    title="Double-click to rename"
                  >{group.name}</span>
                )}
                {routeStats[group.id] && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginRight: '10px' }}>{routeStats[group.id].distance}mi</span>}
                <button onClick={(e) => toggleGroupVisibility(e, group.id)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>{group.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                <button onClick={(e) => deleteGroup(e, group.id)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', marginLeft: '4px' }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Address Input Area */}
        <div className="input-group">
          <div style={{ fontSize: '0.8rem', color: activeGroup?.color, marginBottom: '0.5rem', fontWeight: '600' }}>Adding to: {activeGroup?.name}</div>
          <div className="input-row">
            {isLoaded ? (
              <PlaceComponent
                ref={inputRef}
                placeholder="Enter address or location..."
                onPlaceSelect={handlePlaceSelect}
                onInputChange={setAddressInput}
              />
            ) : (
              <div className="input-field">Loading...</div>
            )}
            <button
              className="btn btn-icon"
              onClick={addStop}
              disabled={!addressInput.trim() || isAdding}
              style={{
                background: addressInput.trim() ? 'var(--accent-primary)' : '',
                color: addressInput.trim() ? 'white' : '',
                opacity: isAdding ? 0.7 : 1
              }}
            >
              {isAdding ? '...' : <Plus size={20} />}
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Type an address and click "+" or press Enter to add.
          </p>
        </div>


        {/* Stops List */}
        <div className="stops-list" ref={stopsListRef}>
          {groups.map(group => {
            if (!group.visible) return null;
            const groupStops = stops.filter(s => s.groupId === group.id);
            if (groupStops.length === 0) return null;
            return (
              <div key={group.id} style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.8rem', color: group.color, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}><Layers size={14} /> {group.name} ({groupStops.length})</h4>
                {groupStops.map((stop, index) => (
                  <div
                    key={stop.id}
                    className={`stop-item ${dragOverItem?.stopId === stop.id ? 'stop-item-drag-over' : ''}`}
                    style={{ borderLeft: `3px solid ${group.color}` }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, stop.id, group.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, stop.id, group.id)}
                    onDrop={(e) => handleDrop(e, stop.id, group.id)}
                  >
                    <div className="drag-handle" title="Drag to reorder"><GripVertical size={14} /></div>
                    <div className="stop-marker" style={{ background: group.color }}>{indexToLetter(index)}</div>
                    <div className="stop-details">
                      <div className="stop-address">{stop.address}</div>
                      {editingStopId === stop.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                          <input
                            type="text"
                            value={editingStopLabel}
                            onChange={(e) => setEditingStopLabel(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveStopLabel(stop.id); if (e.key === 'Escape') setEditingStopId(null); }}
                            autoFocus
                            placeholder="Add label (e.g. Pickup, Delivery)"
                            style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--accent-primary)', color: 'var(--text-primary)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', outline: 'none' }}
                          />
                          <button onClick={() => saveStopLabel(stop.id)} style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', padding: '2px' }}><Check size={12} /></button>
                        </div>
                      ) : (
                        <div
                          className="stop-label"
                          onClick={(e) => startEditingStop(e, stop.id, stop.label)}
                          title="Click to add/edit label"
                        >
                          {stop.label ? <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>{stop.label}</span> : <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.6 }}>+ Add label</span>}
                        </div>
                      )}
                    </div>
                    <button className="remove-btn" onClick={() => removeStop(stop.id, group.id)}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            );
          })}
          {stops.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: '8px' }}><MapPin size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} /><p>No stops yet.</p></div>}
        </div>

        <div className="route-actions" style={{ marginTop: 'auto' }}>
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: '0.5rem' }} onClick={calculateRoutesInOrder} disabled={stops.length < 2}><Navigation size={18} /> Calculate Route in Current Order</button>
          <button className="btn btn-optimize" style={{ width: '100%', marginBottom: '0.5rem' }} onClick={optimizeRoutes} disabled={stops.length < 2}><Truck size={18} /> Optimize Route</button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`btn btn-secondary ${Object.keys(routeResults).length > 0 ? 'btn-pulsing' : ''}`}
              style={{ flex: 1 }}
              onClick={printItinerary}
              disabled={stops.length === 0}
            >
              <Printer size={16} /> Print
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={shareRoute} disabled={stops.length === 0}><Share2 size={16} /> Share</button>
          </div>
          <button className="btn btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={importCSV} disabled={csvImporting}>
            <Upload size={16} /> {csvImporting ? `Importing... (${csvProgress.current}/${csvProgress.total})` : 'Upload CSV'}
          </button>
          {csvImporting && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ width: '100%', height: '4px', background: 'var(--bg-dark)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${csvProgress.total > 0 ? (csvProgress.current / csvProgress.total) * 100 : 0}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '2px', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          )}
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.5rem', textAlign: 'center' }}>Routes auto-save to this browser</p>
        </div>

      </div>

      {/* Map */}
      <div className="map-container">
        {!isLoaded ? <div className="map-loading">Loading Map...</div> : (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={10}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={{
              disableDefaultUI: false,
              zoomControl: true,
              styles: [
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
            }}
          >
            {/* Routes */}
            {groups.map(group => {
              if (!group.visible) return null;
              const result = routeResults[group.id];
              if (!result) return null;
              return (
                <React.Fragment key={group.id}>
                  <DirectionsRenderer
                    directions={result}
                    options={{
                      suppressMarkers: true,
                      polylineOptions: { strokeColor: group.color, strokeWeight: 6, strokeOpacity: 0.8 }
                    }}
                  />
                  {/* Invisible thick polylines for interaction */}
                  {result.routes[0].legs.map((leg, legIndex) => (
                    <Polyline
                      key={`${group.id}-leg-${legIndex}`}
                      path={leg.steps.reduce((acc, step) => [...acc, ...step.path], [])}
                      options={{
                        strokeColor: 'transparent',
                        strokeOpacity: 0,
                        strokeWeight: 15,
                        zIndex: 100
                      }}
                      onMouseOver={(e) => {
                        setPathInfo({
                          visible: true,
                          x: e.domEvent.clientX,
                          y: e.domEvent.clientY,
                          distance: `${metersToMiles(leg.distance.value)} mi`,
                          duration: formatDuration(leg.duration.value)
                        });
                      }}
                      onMouseMove={(e) => {
                        setPathInfo(prev => ({
                          ...prev,
                          x: e.domEvent.clientX,
                          y: e.domEvent.clientY
                        }));
                      }}
                      onMouseOut={() => setPathInfo(prev => ({ ...prev, visible: false }))}
                    />
                  ))}
                </React.Fragment>
              );
            })}
            {/* Markers */}
            {stops.map((stop, index) => {
              const group = groups.find(g => g.id === stop.groupId);
              if (!group || !group.visible) return null;
              const groupStops = stops.filter(s => s.groupId === group.id);
              const groupIndex = groupStops.findIndex(s => s.id === stop.id);
              const pinColor = stop.customColor || group.color;
              const isSelected = selectedPins.includes(stop.id);
              return (
                <Marker
                  key={stop.id}
                  position={{ lat: stop.lat, lng: stop.lng }}
                  icon={getMarkerIcon(pinColor, isSelected)}
                  label={{ text: indexToLetter(groupIndex), color: "white", fontWeight: "bold", fontSize: "12px" }}
                  onClick={(e) => handleMarkerClick(stop, e)}
                />
              );
            })}
          </GoogleMap>
        )}

        {/* Color Selector Popup */}
        {colorPopup.visible && (
          <div
            className="color-popup"
            style={{
              position: 'fixed',
              left: colorPopup.x,
              top: colorPopup.y,
              zIndex: 1000
            }}
          >
            <div className="color-popup-inner">
              {PIN_COLORS.map(color => (
                <div
                  key={color}
                  className="color-dot"
                  style={{ backgroundColor: color }}
                  onClick={() => applyColorToSelected(color)}
                />
              ))}
            </div>
            <button className="color-popup-close" onClick={closeColorPopup}>×</button>
          </div>
        )}

        {/* Path Info Hover Popup */}
        {pathInfo.visible && (
          <div
            className="path-info-popup"
            style={{
              left: pathInfo.x,
              top: pathInfo.y
            }}
          >
            <span className="path-info-label">Leg Info</span>
            <span className="path-info-value">{pathInfo.distance} • {pathInfo.duration}</span>
          </div>
        )}
      </div>
    </div >
  );
};

const VERIFIED_API_KEY = 'AIzaSyB8kIoYTyiBGk9yY5fjojW0ndVNqDshFIc';

function App() {
  return (
    <PinGate>
      <MapContent apiKey={VERIFIED_API_KEY} />
    </PinGate>
  );
}

export default App;
