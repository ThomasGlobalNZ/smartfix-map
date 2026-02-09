# SmartFix Web Map - Verification Test Plan

Use this checklist to verify that the map works correctly after deployment.

## 1. Initial Load
- [ ] **Map Loads**: The map should appear focused on New Zealand.
- [ ] **Stations Visible**: You should see blue/green dots representing stations.
- [ ] **Regions Visible**: Colored polygons (regions) should be visible under the stations.
- [ ] **No Errors**: Check the browser console (F12 > Console) for any red error messages.

## 2. Basemap Layers
- [ ] **Toggle**: Click the Layer Icon (Top Left).
- [ ] **Satellite**: Select "Satellite". Map background should change to aerial imagery.
- [ ] **Topographic**: Select "Topographic". Map should show terrain lines.
- [ ] **Standard**: Switch back to "Standard".

## 3. Station Logic
- [ ] **Hover**: Hover over a colored region. It should show a tooltip like "Region: Auckland... Auto-Connect Port 4815".
- [ ] **Click Station**: Click any station dot. A popup should appear with:
    - Station Name & Code (e.g., AUCK)
    - Status (Online/Offline)
    - Mountpoint (`singleADV4`)
    - Assigned Port (e.g., 4809)
    - "Nearest Station" popup with Est. Baseline Error (Hz/Vt).

## 4. Tools (Toolbar - Top Right)
- [ ] **Measure Tool** (Ruler Icon):
    - Click the button (turns green).
    - Click two points on the map.
    - Info Panel (bottom right) shows "Distance: X km".
    - Click a 3rd time to reset/start over.
    - Click button again to turn off.
- [ ] **Coverage Tool** (Target Icon):
    - Click the button.
    - Enter "20" when prompted.
    - **Lime Green** rings (20km) should appear around **ALL** stations.
    - Stations should be ABOVE the rings (rings don't hide stations).
    - Click button again to turn off (rings disappear).
- [ ] **Geolocate** (Crosshair Icon):
    - Click the button. Browser should ask for location permission.
    - Map zooms to your location (if allowed).

## 5. Search
- [ ] **Search Address**: Type "Taupo" in the search box and press Enter.
- [ ] **Result**: Map zooms to Taupo and places a marker. Popups should show the nearest station to Taupo.

## 6. Coordinate Display (Bottom Left)
- [ ] **Default**: Move mouse. Numbers change (Lat/Lon WGS84).
- [ ] **Toggle**: Click the white box.
- [ ] **NZTM**: Text changes to "N: ... E: ... (NZTM)".
- [ ] **Off**: Text changes to "Coordinates: Off".

## Deployment Information for Admin
If you need to ask your server admin for details, ask for:
1.  **The Public URL**: Where will the map be accessible? (e.g. `https://yoursite.com/map`)
2.  **HTTPS**: Confirm the server supports HTTPS (required for Geolocate and some browser security features).
