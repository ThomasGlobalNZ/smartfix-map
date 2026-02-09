// Global Variables
let portRegions;
let smartfixData;
let linzData;
let allStations = [];
let markers = [];
let authoritativePorts = {};

function getPortForStation(stationCode, lat) {
    // 1. Authoritative Lookup (from NTRIP)
    if (authoritativePorts[stationCode]) {
        return authoritativePorts[stationCode];
    }

    // 2. Latitude-based Fallback
    if (lat > -38.0) return 4809;
    if (lat > -39.0) return 4807;
    if (lat > -40.5) return 4806;
    if (lat > -41.5) return 4804;
    // South Island
    if (lat > -42.5) return 4802;
    if (lat > -44.5) return 4803;

    return 4801;
}

// --- Map Initialization ---

// Base Layers
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
});

const satellite = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    attribution: '© Google'
});

const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
});

const map = L.map('map', {
    center: [-41.2865, 174.7762], // Wellington
    zoom: 6,
    zoomControl: false, // User requested removal (pinch-zoom only)
    layers: [osm] // Default layer
});

// Layer Groups
const regionLayer = L.layerGroup().addTo(map);
const stationLayer = L.layerGroup().addTo(map);
const measureLayer = L.layerGroup().addTo(map);
const coverageLayer = L.layerGroup().addTo(map);

// Layer Control (Top Right)
const baseMaps = {
    "Standard": osm,
    "Satellite": satellite,
    "Topographic": topo
};

const overlayMaps = {
    "Port Regions": regionLayer,
    "Stations": stationLayer,
    "Measurement": measureLayer,
    "Coverage Rings": coverageLayer
};

L.control.layers(baseMaps, overlayMaps, { position: 'topleft' }).addTo(map);

// Custom Panes
map.createPane('regionPane');
map.getPane('regionPane').style.zIndex = 400;

map.createPane('coveragePane');
map.getPane('coveragePane').style.zIndex = 450; // Above regions (400), below stations (650)

map.createPane('stationPane');
map.getPane('stationPane').style.zIndex = 650; // Above regions/coverage

map.createPane('labelPane');
map.getPane('labelPane').style.zIndex = 700; // Above stations

// --- Legend Generation ---
function generateLegend() {
    const container = document.getElementById('legend-container');
    if (!container) return;

    const portColors = {
        4801: '#FFD700', // Yellow/Gold
        4802: '#800080', // Purple
        4803: '#FFA500', // Orange
        4804: '#008000', // Green
        4806: '#ADD8E6', // Light Blue
        4807: '#FFC0CB', // Pink
        4809: '#0000FF'  // Blue
    };

    const portNames = {
        4801: 'Otago / Southland',
        4802: 'Nelson / Marlborough / Westland',
        4803: 'Canterbury',
        4804: 'Wellington / Wairarapa / Manawatu',
        4806: 'Taranaki / Hawkes Bay',
        4807: 'BOP / Waikato',
        4809: 'Auckland / Northland'
    };

    let html = `
        <div class="legend-header" onclick="toggleLegend()" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between;">
            <h4 style="margin: 0;">Reference Station Ports</h4>
            <i id="legend-icon" class="fa-solid fa-chevron-down" style="font-size: 14px;"></i>
        </div>
        <div id="legend-content" style="display: none; margin-top: 10px;">
    `;

    for (const [port, color] of Object.entries(portColors)) {
        const name = portNames[port] || 'Unknown Region';
        html += `
            <div class="legend-item">
                <span class="legend-color" style="background: ${color};"></span>
                <span><b>${port} (Single) / 4815 (Nearest)</b>: ${name}</span>
            </div>
        `;
    }

    // Context Description
    html += `
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee; font-size: 11px; color: #555; line-height: 1.4;">
            <b>Single Site:</b> Connect to single site by using <b><u>CODE</u>singleADV4</b> on either of ports shown in regions above. See the station for individual mountpoints.<br><br>
            <b>Nearest Site:</b> Connect to <b>Port 4815</b> with mountpoint <b>NearestSiteADV4</b> to automatically route to the closest station.
        </div>
        </div>
    `;

    container.innerHTML = html;
}

// Global Toggle Function
window.toggleLegend = function () {
    const content = document.getElementById('legend-content');
    const icon = document.getElementById('legend-icon');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.className = 'fa-solid fa-chevron-up';
    } else {
        content.style.display = 'none';
        icon.className = 'fa-solid fa-chevron-down';
    }
};

generateLegend();


// --- Data Loading & Processing ---

const portColors = {
    4801: '#FFD700', 4802: '#800080', 4803: '#FFA500', 4804: '#008000',
    4806: '#ADD8E6', 4807: '#FFC0CB', 4809: '#0000FF'
};

const portNames = {
    4801: 'Otago / Southland',
    4802: 'Nelson / Marlborough / Westland',
    4803: 'Canterbury',
    4804: 'Wellington / Wairarapa / Manawatu',
    4806: 'Taranaki / Hawkes Bay',
    4807: 'BOP / Waikato',
    4809: 'Auckland / Northland'
};

// Cache buster
const cb = new Date().getTime();

Promise.all([
    fetch(`./data/Port_Regions.geojson?v=${cb}`).then(res => res.json()),
    fetch(`./data/Sites_20250725_Global.geojson?v=${cb}`).then(res => res.json()), // SmartFix
    fetch(`./data/Sites_20250725_LINZ.geojson?v=${cb}`).then(res => res.json()), // LINZ
    fetch(`./data/station_port_mapping.json?v=${cb}`).then(res => res.json()).catch(e => null), // Authoritative Ports
    fetch(`./data/station_meta.json?v=${cb}`).then(res => res.json()).catch(e => null) // Status Metadata
])
    .then(([portRegions, smartfixData, linzData, portMapping, stationMeta]) => {
        // Init authoritative ports
        authoritativePorts = portMapping || {};
        const metaData = stationMeta || {};
        const EXCLUDED = ["TREC", "trec", "2GRO", "2GR0", "1778", "7651", "xGRX", "xgrx"];

        // Display Port Regions
        L.geoJSON(portRegions, {
            style: function (feature) {
                return {
                    color: 'white',
                    weight: 1,
                    fillColor: feature.properties.color || '#999',
                    fillOpacity: 0.3,
                    pane: 'regionPane'
                };
            },
            onEachFeature: function (feature, layer) {
                const port = feature.properties.port;
                const name = feature.properties.port_name || `Port ${port}`;

                // Tooltip
                layer.bindTooltip(`<b>Region: ${name}</b><br>Single Port: ${port}<br>Auto-Connect: Port 4815 (Nearest)`, {
                    sticky: true,
                    className: 'region-label',
                    pane: 'labelPane', // Custom pane above stations
                    direction: 'center'
                });

                layer.on('mouseover', function () {
                    if (nearestMode) return;
                    this.setStyle({ fillOpacity: 0.5 });
                });
                layer.on('mouseout', function () {
                    if (nearestMode) return;
                    this.setStyle({ fillOpacity: 0.3 });
                });
            }
        }).addTo(regionLayer);

        // Helper to process data
        const process = (geoJson, type) => {
            const isSmartFix = type === 'SmartFix';

            L.geoJSON(geoJson, {
                onEachFeature: function (feature, layer) {
                    const props = feature.properties;
                    let rawCode = props['Site Code'];

                    // ALIAS: GSMG -> GSM2 (User Update)
                    if (rawCode && rawCode.toUpperCase() === 'GSMG') {
                        rawCode = 'GSM2';
                        props['Site Code'] = 'GSM2';
                        props['Site Name'] = (props['Site Name'] || '').replace('GSMG', 'GSM2');
                    }

                    const code = rawCode ? rawCode.toString().trim().toUpperCase() : '';

                    // Normalize exclusions
                    const EXCLUDED_NORM = EXCLUDED.map(c => c.toUpperCase());
                    if (EXCLUDED_NORM.includes(code)) return; // Exclude stations

                    const lat = feature.geometry.coordinates[1];
                    const lon = feature.geometry.coordinates[0];

                    // Determine Status
                    const status = metaData[code] ? metaData[code].status : (isSmartFix ? 'Offline' : 'Unknown');
                    const isOffline = status === 'Offline';

                    // Spatial Filter: Hide Offline Stations outside NZ (unless SCTB)
                    if (isOffline && code !== 'SCTB') {
                        // NZ BBox Approx: Lat -33 to -48, Lon 165 to 180
                        // If outside this box, hide it.
                        if (lat > -33 || lat < -48 || lon < 165 || lon > 180) {
                            return;
                        }
                    }

                    const port = getPortForStation(code, lat);
                    feature.properties.assignedPort = port;
                    feature.properties.type = type;

                    // (Status already determined above)

                    // Color Logic
                    let color = isSmartFix ? '#28a745' : '#007bff';
                    if (isOffline) color = 'red'; // Red for offline

                    const marker = L.circleMarker([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], {
                        radius: 6,
                        fillColor: color,
                        color: "#fff",
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 1.0,
                        pane: 'stationPane',
                        title: `Mountpoint: ${code} (${status})`
                    });

                    // Popup
                    const popupContent = `
                        <b>${props['Site Name']} (${code})</b><br>
                        Status: <b style="color: ${isOffline ? 'red' : 'green'}">${status}</b><br>
                        Type: ${type}<br>
                        Mountpoint: <b>${code}singleADV4</b><br>
                        Port: <b>${port}</b> (Single)<br>
                        Region: ${portNames[port] || 'Unknown'}
                    `;
                    marker.bindPopup(popupContent);

                    // Persistent Label
                    marker.bindTooltip(code, {
                        permanent: true,
                        direction: 'auto',
                        className: isOffline ? 'station-label offline' : 'station-label'
                    });

                    stationLayer.addLayer(marker);
                    allStations.push(feature);
                }
            });
        };

        process(smartfixData, 'SmartFix');
        process(linzData, 'LINZ');
    })
    .catch(err => console.error('Error loading data:', err));

function getColorForPort(port) {
    return portColors[port] || '#999999';
}

// --- Layout Helpers ---
// (Layout handled by CSS)

// --- Tools & Interactions ---

// 1. Geolocation
document.getElementById('locate-btn').addEventListener('click', () => {
    map.locate({ setView: true, maxZoom: 10 });
});

map.on('locationerror', function (e) {
    alert("Geolocation Failed.\n\nNote: Browsers often (incorrectly) block location on 'http' connections. Please try using 'https' if possible, or check your browser permissions.");
});

map.on('locationfound', function (e) {
    const radius = e.accuracy / 2;
    L.circle(e.latlng, radius).addTo(map);
    L.marker(e.latlng).addTo(map).bindPopup("You are here").openPopup();
    findNearestStation(e.latlng.lat, e.latlng.lng);
});

// 2. Search & Autocomplete
let debounceTimer;
const resultsList = document.getElementById('results-list');
const addressInput = document.getElementById('address-input');

addressInput.addEventListener('input', (e) => {
    const query = e.target.value;
    clearTimeout(debounceTimer);
    if (query.length < 3) {
        resultsList.classList.add('hidden');
        return;
    }

    debounceTimer = setTimeout(() => {
        fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=nz&q=${encodeURIComponent(query)}`)
            .then(res => res.json())
            .then(data => {
                resultsList.innerHTML = '';
                if (data.length > 0) {
                    data.forEach(item => {
                        const div = document.createElement('div');
                        div.className = 'result-item';
                        div.innerText = item.display_name;
                        div.onclick = () => {
                            addressInput.value = item.display_name;
                            resultsList.classList.add('hidden');
                            const lat = parseFloat(item.lat);
                            const lon = parseFloat(item.lon);
                            map.setView([lat, lon], 12);
                            L.marker([lat, lon]).addTo(map).bindPopup(item.display_name).openPopup();

                            // Explicit Action: Find Nearest Station
                            findNearestStation(lat, lon);

                            // Ensure clean state
                            if (isNearestToolActive) toggleNearestTool();
                        };
                        resultsList.appendChild(div);
                    });
                    resultsList.classList.remove('hidden');
                } else {
                    resultsList.classList.add('hidden');
                }
            })
            .catch(err => console.error(err));
    }, 400); // Debounce
});

// Hide results when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
        resultsList.classList.add('hidden');
    }
});

document.getElementById('search-btn').addEventListener('click', handleSearch);
addressInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
});

function handleSearch() {
    const query = addressInput.value;
    if (!query) return;
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=nz&q=${encodeURIComponent(query)}`;
    fetch(url).then(res => res.json()).then(results => {
        if (results && results.length > 0) {
            const r = results[0];
            const lat = parseFloat(r.lat);
            const lon = parseFloat(r.lon);
            map.setView([lat, lon], 12);
            L.marker([lat, lon]).addTo(map).bindPopup(`Search Result: ${r.display_name}`).openPopup();

            // Explicitly run Nearest Station logic for searches
            findNearestStation(lat, lon);

            resultsList.classList.add('hidden');
        } else {
            alert("Address not found in New Zealand");
        }
    });
}

// Global Interactivity Manager
function updateInteractivity() {
    const anyToolActive = measureMode || nearestMode || coverageMode;

    if (anyToolActive) {
        // Disable Region Tool (Aggressively)
        regionLayer.eachLayer(l => {
            l.unbindTooltip();
            l.setStyle({ interactive: false });
        });
    } else {
        // Re-enable Region Tool (Default State)
        regionLayer.eachLayer(l => {
            const props = l.feature.properties;
            const port = props.port;
            const name = props.port_name || `Port ${port}`;
            // Rebind if not already bound (checking isn't easy, so we bind overwrite)
            l.bindTooltip(`<b>Region: ${name}</b><br>Single Port: ${port}<br>Auto-Connect: Port 4815 (Nearest)`, {
                sticky: true,
                className: 'region-label',
                pane: 'labelPane',
                direction: 'center'
            });
            l.setStyle({ interactive: true });
        });
    }
}

// 5. Measure Tool
let measureMode = false;
let measurePoints = [];
let measureMarkers = [];
let measureLine = null;

const measureBtn = document.getElementById('measure-btn');
measureBtn.addEventListener('click', () => {
    measureMode = !measureMode;
    measureBtn.classList.toggle('active');

    // Disable Coverage Mode if active
    if (coverageMode) toggleCoverageMode();
    // Disable Nearest Mode if active
    if (nearestMode) toggleNearestTool();

    if (!measureMode) {
        clearMeasure();
        map.getContainer().style.cursor = '';
    } else {
        map.getContainer().style.cursor = 'crosshair';
        alert("Click to measure distance (2 points). Click again to reset.");
    }
    updateInteractivity();
});

// 6. Nearest Station Tool (New)
let nearestMode = false;
const nearestBtn = document.getElementById('nearest-btn');
nearestBtn.addEventListener('click', toggleNearestTool);

function toggleNearestTool() {
    nearestMode = !nearestMode;
    nearestBtn.classList.toggle('active');

    // Disable other modes
    if (measureMode) measureBtn.click();
    if (coverageMode) coverageBtn.click();

    if (nearestMode) {
        map.getContainer().style.cursor = 'crosshair';
        map.closePopup();
    } else {
        map.getContainer().style.cursor = '';
    }
    updateInteractivity();
}

// 7. Coverage Rings Tool (Renumbered)
let coverageMode = false;
const coverageBtn = document.getElementById('coverage-btn');
coverageBtn.addEventListener('click', toggleCoverageMode);

function toggleCoverageMode() {
    coverageMode = !coverageMode;
    coverageBtn.classList.toggle('active');

    // Disable Measure Mode if active
    if (measureMode) measureBtn.click(); // toggle off
    // Disable Nearest Mode if active
    if (nearestMode) nearestBtn.click();

    if (coverageMode) {
        map.getContainer().style.cursor = 'help';

        // Ask for custom radius
        setTimeout(() => {
            const input = prompt("Enter a radius in km to show for ALL stations (e.g. 20):");
            if (input && !isNaN(parseFloat(input))) {
                const radiusMeters = parseFloat(input) * 1000;
                drawCoverageAll(radiusMeters);
                alert(`Showing ${input}km coverage rings for all stations.`);
            } else {
                // Cancelled or invalid
                // Toggle back off
                coverageMode = false;
                coverageBtn.classList.remove('active');
                map.getContainer().style.cursor = '';
                updateInteractivity(); // Explicitly update if cancelled
            }
        }, 100);

    } else {
        map.getContainer().style.cursor = '';
        coverageLayer.clearLayers();
    }
    updateInteractivity();
}

function drawCoverageAll(radius) {
    coverageLayer.clearLayers();

    // Draw rings for all visible stations
    allStations.forEach(feature => {
        const lat = feature.geometry.coordinates[1];
        const lon = feature.geometry.coordinates[0];

        L.circle([lat, lon], {
            radius: radius,
            color: '#0000FF', // Blue
            weight: 2,
            fill: false,
            opacity: 0.8,
            pane: 'coveragePane'
        }).addTo(coverageLayer);
    });
}

// Update Map Click
map.on('click', (e) => {
    if (measureMode) {
        addMeasurePoint(e.latlng);
    } else if (nearestMode) {
        findNearestStation(e.latlng.lat, e.latlng.lng);
    } else {
        // Default: Region Tooltip/Popup handles itself.
        // If we clicked empty space, nothing happens.
    }
});


// 4. Find Nearest & Calc Error
function findNearestStation(lat, lon) {
    let nearest = null;
    let minDistance = Infinity;

    stationLayer.eachLayer(layer => {
        const dist = layer.getLatLng().distanceTo([lat, lon]);
        if (dist < minDistance) {
            minDistance = dist;
            nearest = layer;
        }
    });

    if (nearest) {
        const line = L.polyline([[lat, lon], nearest.getLatLng()], {
            color: 'red',
            weight: 3,
            dashArray: '5, 10'
        }).addTo(map);
        setTimeout(() => map.removeLayer(line), 5000);

        const portMatch = nearest.getPopup().getContent().match(/Port: <b>(\d+)<\/b>/);
        const port = portMatch ? portMatch[1] : 'Unknown';

        // Baseline Error Calculation (Standard RTK: Hz 8mm+1ppm, Vt 15mm+1ppm)
        const totalDist = minDistance; // meters
        const ppm = 1;
        const errHz = (8 + (totalDist / 1000000 * 1000) * ppm).toFixed(1);
        const errVt = (15 + (totalDist / 1000000 * 1000) * ppm).toFixed(1);

        // Updated Popup Text per request
        L.popup()
            .setLatLng([lat, lon])
            .setContent(`
                <span style="color: blue; font-weight: bold;">Nearest Station</span><br>
                Name: ${nearest.getTooltip().getContent()}<br>
                Port: <b>${port}</b> (Single)<br>
                Distance: ${(minDistance / 1000).toFixed(2)} km<br>
                <hr style="margin: 5px 0;">
                <span style="font-size:11px">Est. Baseline Error:</span><br>
                <b>Hz:</b> ${errHz} mm <br>
                <b>Vt:</b> ${errVt} mm
            `)
            .openOn(map);
    }
}

function addMeasurePoint(latlng) {
    // If we already have 2 points (a full line), start over
    if (measurePoints.length >= 2) {
        clearMeasure();
    }

    measurePoints.push(latlng);
    const m = L.circleMarker(latlng, { radius: 4, color: 'black' }).addTo(measureLayer);
    measureMarkers.push(m);

    if (measurePoints.length === 2) {
        measureLine = L.polyline(measurePoints, { color: 'black' }).addTo(measureLayer);

        // Calculate Distance
        const dist = measurePoints[0].distanceTo(measurePoints[1]);
        const distKm = (dist / 1000).toFixed(1);

        // Calculate Midpoint for Label
        const lat1 = measurePoints[0].lat;
        const lng1 = measurePoints[0].lng;
        const lat2 = measurePoints[1].lat;
        const lng2 = measurePoints[1].lng;
        const midLat = (lat1 + lat2) / 2;
        const midLng = (lng1 + lng2) / 2;

        // Calculate Angle for Rotation (in screen pixels to ensure readability)
        const p1 = map.latLngToContainerPoint(measurePoints[0]);
        const p2 = map.latLngToContainerPoint(measurePoints[1]);
        const dy = p2.y - p1.y;
        const dx = p2.x - p1.x;
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // Keep text upright
        if (angle > 90) angle -= 180;
        else if (angle < -90) angle += 180;

        // Show Label on Map
        L.marker([midLat, midLng], {
            icon: L.divIcon({
                className: 'measure-label',
                html: `<div style="transform: rotate(${angle}deg); text-align: center; color: black; text-shadow: -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 2px 2px 0 #fff; font-weight: bold; font-size: 14px; white-space: nowrap;">${distKm} km</div>`,
                iconSize: [100, 20],
                iconAnchor: [50, 10]
            })
        }).addTo(measureLayer);

        hideInfoPanel();
    }
}

function clearMeasure() {
    measureLayer.clearLayers();
    measurePoints = [];
    measureMarkers = [];
    measureLine = null;
    hideInfoPanel();
}

function showInfoPanel(html) {
    const p = document.getElementById('info-panel');
    if (p) {
        document.getElementById('info-content').innerHTML = html;
        p.classList.remove('hidden');
    }
}
function hideInfoPanel() {
    const p = document.getElementById('info-panel');
    if (p) p.classList.add('hidden');
}

// --- Global Styles ---
const style = document.createElement('style');
style.innerHTML = `
    path.leaflet-interactive:focus {
        outline: none;
    }
`;
document.head.appendChild(style);

// --- Coordinate Display Logic ---

// Define NZTM2000 (EPSG:2193)
if (typeof proj4 !== 'undefined') {
    proj4.defs("EPSG:2193", "+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
}

const coordsDiv = document.getElementById('coords-display');
let coordMode = 1; // Start with WGS84
// Modes: 0=Off, 1=WGS84, 2=NZTM

// Toggle Mode on Click
if (coordsDiv) {
    coordsDiv.addEventListener('click', (e) => {
        L.DomEvent.stopPropagation(e); // Prevent map click

        coordMode = (coordMode + 1) % 3;

        if (coordMode === 0) {
            coordsDiv.innerText = "Coordinates: Off (Click to Toggle)";
            coordsDiv.style.opacity = "0.7";
        } else {
            coordsDiv.style.opacity = "1.0";
            coordsDiv.innerText = "Tap map or move mouse to update...";
        }
    });

    // Initial State
    coordsDiv.style.display = 'block';

    map.on('mousemove', (e) => {
        if (coordMode === 0) return;

        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        if (coordMode === 1) {
            // WGS84
            coordsDiv.innerText = `Lat: ${lat.toFixed(6)}, Lon: ${lng.toFixed(6)} (WGS84)`;
        } else if (coordMode === 2) {
            // NZTM
            if (typeof proj4 !== 'undefined') {
                const nztm = proj4('EPSG:4326', 'EPSG:2193', [lng, lat]);
                coordsDiv.innerText = `N: ${nztm[1].toFixed(1)}, E: ${nztm[0].toFixed(1)} (NZTM)`;
            } else {
                coordsDiv.innerText = "Proj4 Error";
            }
        }
    });
}
