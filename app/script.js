// Basic Leaflet Map Init
// Basic Leaflet Map Init
const map = L.map('map', {
    zoomControl: false // Move zoom control
}).setView([-41.2865, 174.7762], 6); // Centered on NZ

map.attributionControl.addAttribution('Meridional Circuits &copy; LINZ Data Service');

// Custom Panes (Must be created before layers use them)
map.createPane('regionPane');
map.getPane('regionPane').style.zIndex = 250; // Above tiles (200), below shadows (500)
map.getPane('regionPane').style.pointerEvents = 'auto';

map.createPane('labelPane');
map.getPane('labelPane').style.zIndex = 650; // Above markers (600)
map.getPane('labelPane').style.pointerEvents = 'none';

// Move Zoom Control to top-left (Default)
// Zoom Control Removed per user request
// L.control.zoom({ position: 'topleft' }).addTo(map);

// Add OpenStreetMap Layer
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Add Satellite Layer (Google Hybrid)
const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Maps'
});

// Layer Groups
const stationLayer = L.layerGroup().addTo(map);
const regionLayer = L.layerGroup();
map.addLayer(regionLayer);

const meridionalLayer = L.layerGroup();

// Layer Control
// Layer Control (Basemaps Only)
const baseMaps = {
    "Street Map": osmLayer,
    "Satellite": satelliteLayer
};

// Custom Overlay Toggle Control (Regions vs Circuits)
// REVERTED: User requested standard layer control integration
/* 
const OverlayControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function (map) {
        const div = L.DomUtil.create('div', 'control-box layer-toggle');
        div.innerHTML = `
            <div class="toggle-btn active" data-layer="regions">Regions</div>
            <div class="toggle-btn" data-layer="circuits">Circuits</div>
        `;
        L.DomEvent.disableClickPropagation(div);
        return div;
    }
});
map.addControl(new OverlayControl());
*/

// Layer Control (Standard) - Merging Base and Overlays
// Custom Toggle Control (Ports vs Circuits)
const LayerToggleControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function (map) {
        const div = L.DomUtil.create('div', 'layer-toggle-control leaflet-bar');
        div.innerHTML = `
            <div class="layer-toggle-btn active" id="toggle-ports">
                <i class="fa-solid fa-server"></i> Ports
            </div>
            <div class="layer-toggle-btn" id="toggle-circuits">
                <i class="fa-solid fa-globe"></i> Circuits
            </div>
        `;

        L.DomEvent.disableClickPropagation(div);
        return div;
    }
});
// Add Toggle FIRST to be at the top of topright (Leaflet order depends on CSS/Implementation but usually First Added = Top or Bottom depending on container float. 
// Leaflet topright is float right. First added goes right-most/top-most? No, usually they stack.
// Actually, standard is: top-left stack down. Top-right stack down? 
// Let's add Toggle THEN Layers. 
map.addControl(new LayerToggleControl());

// Layer Control (Basemaps Only)
const overlayMaps = {};
const layerControl = L.control.layers(baseMaps, overlayMaps, { position: 'topleft' }).addTo(map);

// Toggle Logic
setTimeout(() => {
    const portsBtn = document.getElementById('toggle-ports');
    const circuitsBtn = document.getElementById('toggle-circuits');

    if (portsBtn && circuitsBtn) {
        portsBtn.onclick = () => {
            if (portsBtn.classList.contains('active')) return;

            portsBtn.classList.add('active');
            circuitsBtn.classList.remove('active');

            if (!map.hasLayer(regionLayer)) map.addLayer(regionLayer);
            if (map.hasLayer(meridionalLayer)) map.removeLayer(meridionalLayer);
        };

        circuitsBtn.onclick = () => {
            if (circuitsBtn.classList.contains('active')) return;

            circuitsBtn.classList.add('active');
            portsBtn.classList.remove('active');

            if (!map.hasLayer(meridionalLayer)) map.addLayer(meridionalLayer);
            if (map.hasLayer(regionLayer)) map.removeLayer(regionLayer);
        };
    }
}, 500);

// Exclusive Layer Logic (Mutex) - "Radio Button" behavior for Overlays
// Exclusive Layer Logic handled by Toggle Control now


// Remove Toggle Event Listener (Clean up)
// document.addEventListener('click', function (e) {
//     if (e.target.classList.contains('toggle-btn')) {
//         const target = e.target;
//         const layerType = target.dataset.layer;

//         // Update UI
//         document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
//         target.classList.add('active');

//         // Update Map
//         if (layerType === 'regions') {
//             map.addLayer(regionLayer);
//             map.removeLayer(meridionalLayer);
//         } else {
//             map.addLayer(meridionalLayer);
//             map.removeLayer(regionLayer);
//         }
//     }
// });

// --- Data Containers ---
let allStations = []; // To store station data for nearest calculation
let authoritativePorts = {}; // key: station_code, value: port
let stationMetaData = {}; // Store station metadata globally
let circuitData = null; // Store circuit GeoJSON data globally

// --- Icons ---
// Dynamic color handled in process()

// --- State ---
let isMeasuring = false;
let measurePoints = [];
let measurePolyline = null;
let measureTooltip = null;

// --- Cache Buster ---
const cb = new Date().getTime();

// --- Colors ---
const portColors = {
    4809: '#9b59b6', // Auckland/Northland - Purple
    4807: '#e67e22', // Waikato/BoP - Orange
    4806: '#2ecc71', // Central North Island - Green (Brighter)
    4804: '#e74c3c', // Wellington - Red
    4802: '#3498db', // Nelson/Marlborough - Blue
    4803: '#e91e63', // Canterbury - Pink (Distinct from Teal/Blue)
    4801: '#f1c40f'  // Otago/Southland - Yellow
};

const networkPorts = {
    4801: 4811, 4802: 4812, 4803: 4813, 4804: 4814
};

const portNames = {
    4801: 'Otago / Southland',
    4802: 'Nelson / Marlborough / Westland',
    4803: 'Canterbury',
    4804: 'Wellington / Wairarapa / Manawatu',
    4806: 'Taranaki / Hawkes Bay',
    4807: 'Bay of Plenty / Waikato',
    4809: 'Auckland / Northland'
};

// Location Mapping
const stationLocations = {
    // North Island
    'KTIA': 'Kaitaia', 'GSKK': 'Kerikeri', 'GSWR': 'Whangarei CBD', 'WHNG': 'Whangarei',
    'GSDR': 'Dargaville', 'GSMH': 'Mangawhai Heads', 'WARK': 'Warkworth', 'GSSB': 'Shelly Beach',
    'AUCK': 'Whangaparaoa', 'GSAL': 'Albany', 'CORM': 'Coromandel', 'GSUT': 'Waterview',
    'GSBL': 'Beachlands', 'GSAA': 'Auckland Airport', 'GSTN': 'Takanini', 'GSTH': 'Thames',
    'GSWI': 'Waiuku', 'GSWH': 'Waihi', 'GSTK': 'Te Kauwhata', 'HIKB': 'Hicks Bay',
    'TRNG': 'Papamoa', 'GSHT': 'Hamilton CBD', 'HAMT': 'Whatawhata', 'GSCA': 'Cambridge',
    'WHKT': 'Whakatane', 'GSPU': 'Putaruru', 'GSRO': 'Rotorua', 'MAHO': 'Mahoenui',
    'RGAR': 'Broadlands', 'ARTA': 'Aratiatia Dam', 'GISB': 'Patutahi', 'TAUP': 'Taupo',
    'NPLY': 'New Plymouth', 'VGMT': 'Ohakune', 'HAST': 'Hastings', 'GSHW': 'Hawera',
    'WANG': 'Wanganui', 'DNVK': 'Dannevirke', 'GSPN': 'Palmerston North', 'GSWF': 'Welsford',

    // South Island
    'GLDB': 'Golden Bay', 'TKHL': 'Takaka Hill', 'NLSN': 'Cable Bay', 'GSNE': 'Stoke',
    'GSBN': 'Blenheim', 'WRAU': 'Wairau Valley', 'WEST': 'Waimangaroa', 'CMBL': 'Cape Campbell',
    'GSCR': 'Clarence', 'KAIK': 'Kaikoura', 'HANM': 'Hanmer Springs', 'MRBL': 'Marble Point',
    'HOKI': 'Hokitika', 'LKTA': 'Lake Taylor', 'GSCT': 'Cheviot', 'GSAM': 'Amberley',
    'GSOX': 'Oxford', 'GSJV': 'Mairehau', 'YALD': 'Yaldhurst', 'GSCC': 'Christchurch City',
    'METH': 'Methven', 'MQZG': 'McQueens Valley', 'GSLI': 'Little River', 'GSAB': 'Ashburton',
    'MTJO': 'Mount John', 'HAAS': 'Haast', 'GSTW': 'Twizel', 'GSTI': 'Timaru',
    'WAIM': 'Waimate', 'GSLW': 'Wanaka', 'GSQU': 'Queenstown', 'GSOM': 'Oamaru',
    'LEXA': 'Alexandra', 'MALV': 'Mavora Lakes', 'DUND': 'Dunedin', 'GSGR': 'Gore',
    'GSRA': 'Ranfurly', 'SCTB': 'Scott Base', 'CHTI': 'Chatham Islands', 'BLUF': 'Bluff'
};

Promise.all([
    fetch(`./data/Port_Regions.geojson?v=${cb}`).then(res => res.json()),
    fetch(`./data/Sites_20250725_Global.geojson?v=${cb}`).then(res => res.json()), // SmartFix
    fetch(`./data/Sites_20250725_LINZ.geojson?v=${cb}`).then(res => res.json()), // LINZ
    fetch(`./data/station_port_mapping.json?v=${cb}`).then(res => res.json()).catch(e => null), // Authoritative Ports
    fetch(`./data/station_meta.json?v=${cb}`).then(res => res.json()).catch(e => ({})), // Station Meta (Status + Ports)
])
    .then(([portRegions, smartfixData, linzData, portMapping, stationMeta]) => {
        // Init authoritative ports and metadata
        authoritativePorts = portMapping || {};
        stationMetaData = stationMeta || {}; // Store globally
        const metaData = stationMetaData;
        const EXCLUDED = ["TREC", "trec", "2GRO", "2GR0", "1778", "7651", "xGRX", "xgrx"];

        // Display Port Regions
        L.geoJSON(portRegions, {
            style: function (feature) {
                return {
                    stroke: false, // No border lines
                    fillColor: feature.properties.color || '#999',
                    fillOpacity: 0.3,
                    pane: 'regionPane'
                };
            },
            onEachFeature: function (feature, layer) {
                const port = feature.properties.port;
                const name = feature.properties.port_name || `Port ${port}`;

                // Tooltip removed from here to disable hover. Created dynamically on click.
                const netPort = networkPorts[port] ? `Network Port: ${networkPorts[port]}<br>` : '';

                layer.on('click', function (e) {
                    if (isToolActive()) return; // User requested info box disabled during tools


                    // 1. Update Coordinates
                    lastLatLng = e.latlng;
                    updateCoordText(e.latlng);

                    // 2. Prevent Double Tooltips (Close the hover one)
                    layer.closeTooltip();

                    // 3. Place Target Marker (Icon where you clicked)
                    clearMeasure();
                    if (window.currentTargetMarker) map.removeLayer(window.currentTargetMarker);

                    window.currentTargetMarker = L.marker(e.latlng, {
                        icon: L.divIcon({
                            className: 'target-marker',
                            html: '<div style="width: 12px; height: 12px; background: white; border: 2px solid black; border-radius: 50%;"></div>',
                            iconSize: [12, 12],
                            iconAnchor: [6, 6]
                        })
                    }).addTo(map);

                    // 4. Calculate Info
                    const nearestInfo = findNearestStation(e.latlng.lat, e.latlng.lng, true);
                    let content = `<b>Region: ${name}</b><br>Single Port: ${port}<br>${netPort}Auto-Connect: Port 4815 (Nearest)`;

                    if (nearestInfo) {
                        // Check if this specific station has a network port
                        const stationNetPort = stationMetaData[nearestInfo.code] ? stationMetaData[nearestInfo.code].network_port : null;
                        const netPortText = stationNetPort ? `<br>Network Port: <b>${stationNetPort}</b>` : '';

                        content += `<hr style="margin: 5px 0; border: 0; border-top: 1px solid #ccc;">
                       <span style="color: blue; font-weight: bold;">Nearest Station</span><br>
                        <b>${nearestInfo.code}</b><br>
                        Port: <b>${nearestInfo.port}</b> (Single)${netPortText}<br>
                        Distance: ${nearestInfo.distance} km`;
                    }

                    // 5. Smart Bind Tooltip (Dynamic Direction)
                    smartBindTooltip(window.currentTargetMarker, content);

                    L.DomEvent.stopPropagation(e);
                });

                // Hover/Move Listeners Removed per User Request (Click Only)
                // Hover/Move Listeners Removed per User Request (Click Only)
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
                    let lon = feature.geometry.coordinates[0];

                    // CHTI Fix: Wrap Longitude < -170 to show East of NZ
                    if (lon < -170) lon += 360;

                    // Determine Status
                    // FIX: Default to 'Online' if metaData is missing (API failure) to avoid false offline alerts
                    const status = metaData[code] ? metaData[code].status : (isSmartFix ? 'Online' : 'Unknown');
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
                    let color = '#28a745'; // Green for Online (both SmartFix and LINZ)
                    if (isOffline) color = '#dc3545'; // Red for Offline

                    const marker = L.circleMarker([lat, lon], {
                        radius: 8, // Slightly smaller for cleaner look
                        fillColor: color,
                        color: "#fff",
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 1.0,
                        pane: 'stationPane',
                        title: `Mountpoint: ${code} (${status})`
                    });

                    const locationName = stationLocations[code] || props['Site Name'] || 'Unknown';

                    // Restore missing definitions
                    const networkPort = (metaData[code] && metaData[code].network_port) ? metaData[code].network_port : 'No';
                    const regionName = portNames[port] || 'Unknown';

                    const popupContent = `
                        <div style="font-family: Roboto, sans-serif; font-size: 13px;">
                            <b style="font-size: 14px;">${code}</b><br>
                            Status: <b style="color: ${isOffline ? 'red' : 'green'}">${status}</b><br>
                            Location: <b>${locationName}</b><br>
                            Single Site Port: <b>${port}</b><br>
                            Network Port: <b>${networkPort}</b><br>
                            Region: ${regionName}
                        </div>
                    `;
                    marker.bindPopup(popupContent);

                    // Persistent Label - zoom responsive
                    marker.bindTooltip(code, {
                        permanent: true,
                        direction: 'auto',
                        className: isOffline ? 'station-label offline' : 'station-label'
                    });

                    // Update label size based on zoom
                    map.on('zoomend', function () {
                        const zoom = map.getZoom();
                        let fontSize = '11px'; // Default
                        if (zoom >= 8) fontSize = '13px';
                        if (zoom >= 10) fontSize = '15px';

                        const tooltip = marker.getTooltip();
                        if (tooltip) {
                            const tooltipEl = tooltip.getElement();
                            if (tooltipEl) tooltipEl.style.fontSize = fontSize;
                        }
                    });

                    // FIX: Close Region/Circuit Pin when clicking a station
                    // FIX: Close Region/Circuit Pin when clicking a station
                    marker.on('click', (e) => {
                        // Coverage Tool Logic for Stations
                        if (isCoverageMode) {
                            L.DomEvent.stopPropagation(e); // Prevent map click (double rings)
                            drawCoverageRings(e.latlng);
                            return;
                        }

                        // Measure Tool Logic for Stations (Snap to station?)
                        if (isMeasuring) {
                            // Let it propagate to map to add point? 
                            // Or handle snap here. User didn't ask for snap, just "distance toggled off".
                            // "Distance toggled off" was caused by Region Click calling clearMeasure().
                            // If we propagate, Map Click handles it. 
                            // But Markers catch clicks. 
                            // Hand it off manually:
                            L.DomEvent.stopPropagation(e);
                            map.fire('click', { latlng: e.latlng });
                            return;
                        }

                        if (window.currentTargetMarker) {
                            map.removeLayer(window.currentTargetMarker);
                            window.currentTargetMarker = null;
                        }
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

// Load Meridional Circuits
fetch('./data/Meridional_Circuits.geojson')
    .then(res => res.json())
    .then(data => {
        circuitData = data; // Store globally for Find My Location
        L.geoJSON(data, {
            style: function (feature) {
                return {
                    color: 'white',
                    weight: 1,
                    fillColor: getCircuitColor(feature.properties.name),
                    fillOpacity: 0.2,
                    pane: 'regionPane' // Reuse region pane
                };
            },
            onEachFeature: function (feature, layer) {
                const name = feature.properties.name;
                // Tooltip removed from here to disable hover. dynamically created on click.

                layer.on('click', function (e) {
                    if (isToolActive()) return;


                    // 1. Update Coordinates (Fix for Mobile/StopPropagation)
                    lastLatLng = e.latlng;
                    updateCoordText(e.latlng);

                    // 2. Prevent Double Tooltips
                    layer.closeTooltip();

                    // 3. Place Target Marker (Icon where you clicked)
                    clearMeasure();
                    if (window.currentTargetMarker) map.removeLayer(window.currentTargetMarker);

                    window.currentTargetMarker = L.marker(e.latlng, {
                        icon: L.divIcon({
                            className: 'target-marker',
                            html: '<div style="width: 12px; height: 12px; background: white; border: 2px solid black; border-radius: 50%;"></div>',
                            iconSize: [12, 12],
                            iconAnchor: [6, 6] // Center it
                        })
                    }).addTo(map);

                    // 4. Calculate Info
                    const nearestInfo = findNearestStation(e.latlng.lat, e.latlng.lng, true);
                    let content = `<b>Circuit: ${name}</b>`;

                    if (nearestInfo) {
                        // Check if this specific station has a network port
                        const stationNetPort = stationMetaData[nearestInfo.code] ? stationMetaData[nearestInfo.code].network_port : null;
                        const netPortText = stationNetPort ? `<br>Network Port: <b>${stationNetPort}</b>` : '';

                        content += `<hr style="margin: 5px 0; border: 0; border-top: 1px solid #ccc;">
                       <span style="color: blue; font-weight: bold;">Nearest Station</span><br>
                        <b>${nearestInfo.code}</b><br>
                        Port: <b>${nearestInfo.port}</b> (Single)${netPortText}<br>
                        Distance: ${nearestInfo.distance} km`;
                    }

                    // 5. Smart Bind Tooltip (Dynamic Direction)
                    smartBindTooltip(window.currentTargetMarker, content);

                    L.DomEvent.stopPropagation(e);
                });

                // Hover/Move Listeners Removed per User Request (Click Only)
            }
        }).addTo(meridionalLayer);

    })
    .catch(e => console.log("Meridional Circuits not found or loaded:", e));

// --- Legend ---
function createLegend() {
    const container = document.getElementById('legend-container');
    if (!container) return;

    // "Reference Station Ports" Style
    let html = `
    <details open style="background: white; padding: 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.4);">
        <summary style="cursor: pointer; font-weight: bold; margin-bottom: 8px; font-size: 13px;">Reference Station Ports</summary>
        
        <div style="font-size: 12px; margin-bottom: 12px; font-weight: bold;">
        </div>

        <!-- Single Site Ports Section -->
        <div style="font-size: 13px; font-weight: bold; margin-bottom: 6px; color: #2196F3;">Single Site Ports</div>
        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; margin-bottom: 12px;">
    `;

    for (const [port, color] of Object.entries(portColors)) {
        const regionName = portNames[port] || `Region ${port}`;

        html += `
            <div style="display: flex; align-items: start; gap: 8px;">
                <div style="width: 16px; height: 16px; background: ${color}; border: 1px solid #999; flex-shrink: 0; margin-top: 2px;"></div>
                <div style="line-height: 1.3;">
                    <b>${port}:</b> ${regionName}
                </div>
            </div>
        `;
    }

    html += `
        </div>

        <!-- Network Ports Section -->
        <div style="font-size: 13px; font-weight: bold; margin-bottom: 6px; color: #2196F3;">Network Ports</div>
        <div style="font-size: 12px; margin-bottom: 12px; line-height: 1.4;">
    `;

    // Collect unique network ports and map to regions
    const uniqueNetPorts = [...new Set(Object.values(networkPorts))];
    uniqueNetPorts.sort().forEach(netPort => {
        // Find regions (single ports) that map to this network port
        const regions = [];
        for (const [single, net] of Object.entries(networkPorts)) {
            if (net === netPort) {
                regions.push(portNames[single] || `Region ${single}`);
            }
        }

        html += `<p style="margin: 0 0 4px 0;">• Port <b>${netPort}</b>: ${regions.join(', ')}</p>`;
    });

    html += `
        </div>

        <!-- Nearest Port Section -->
        <div style="font-size: 13px; font-weight: bold; margin-bottom: 6px; color: #2196F3;">Nearest Port</div>
        <div style="font-size: 12px; margin-bottom: 12px;">
            <p style="margin: 0;"><b>Port 4815:</b> Auto-routes to closest station</p>
        </div>
    </details>`;

    container.innerHTML = html;

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
}
createLegend();

// --- Tools: PPM Calculator ---
// Inject Button if missing
if (!document.getElementById('ppm-btn')) {
    const btnContainer = document.querySelector('.action-buttons .display-flex') || document.querySelector('.action-buttons > div[style*="display: flex"]');
    if (btnContainer) {
        const btn = document.createElement('button');
        btn.id = 'ppm-btn';
        btn.title = 'Est. Baseline Error';
        btn.innerHTML = '<i class="fa-solid fa-calculator"></i>';
        btnContainer.appendChild(btn);

        btn.addEventListener('click', showPPMCalculator);
    }
}

function showPPMCalculator() {
    let dist = prompt("Enter Baseline Distance (km):", "10");
    if (dist === null) return;
    dist = parseFloat(dist);
    if (isNaN(dist)) {
        alert("Invalid distance.");
        return;
    }

    // Assumptions: H = 8mm + 1ppm, V = 15mm + 1ppm
    const hErr = 8 + (dist * 1); // 1ppm = 1mm/km
    const vErr = 15 + (dist * 1);

    alert(`Estimated Error for ${dist} km:\n\nHorizontal: ±${hErr.toFixed(1)} mm\nVertical: ±${vErr.toFixed(1)} mm\n\n(Based on 8mm+1ppm H, 15mm+1ppm V)`);
}

// --- Tools: Mobile Info Tool (Moved to End) ---
if (!document.getElementById('info-btn')) {
    const btnContainer = document.querySelector('.action-buttons .display-flex') || document.querySelector('.action-buttons > div[style*="display: flex"]');
    if (btnContainer) {
        const btn = document.createElement('button');
        btn.id = 'info-btn'; // CSS handles mobile-only visibility
        btn.title = 'Information';
        btn.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
        // Append last
        btnContainer.appendChild(btn);

        btn.addEventListener('click', showMobileInfo);
    }
}

function showMobileInfo() {
    // Create Modal if missing
    let modal = document.getElementById('mobile-info-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'mobile-info-modal';
        modal.className = 'info-modal-backdrop';
        modal.innerHTML = `
            <div class="info-modal-content">
                <span class="close-modal">&times;</span>
                <h4 style="margin-top: 0;">Information</h4>
                
                <div style="font-size: 13px; text-align: left; line-height: 1.6;">
                    <p style="margin-bottom: 15px;">
                        This map provides a visual reference for the SmartFix Real-time Network stations and coverage areas. 
                        Please note that this tool is not always updated regularly and should not be relied upon for critical 
                        decision-making. For the most accurate and up-to-date information, always verify details with 
                        <b>Global Survey</b>.
                    </p>
                    
                    <h4 style="margin: 15px 0 10px 0; color: #2196F3; font-size: 16px;">Connection Details</h4>
                    <p><b>Host:</b> <span style="color: blue">www.smartfix.co.nz</span></p>
                    <p><b>Single Site:</b> Connect to single site by using <b><u>CODE</u>singleADV4</b> on either of ports shown in regions. See station popup for mountpoint.</p>
                    <p><b>Network Site:</b> Connect to network solution by <b><u>CODE</u>fixedADV4</b> on either of ports shown in regions above. See the station for individual mountpoints.</p>
                    <p><b>Nearest Site:</b> Connect to <b>Port 4815</b> with mountpoint <b>NearestSiteADV4</b>.</p>
                    
                    <h4 style="margin: 15px 0 10px 0; color: #2196F3; font-size: 16px;">Copyright & Attribution</h4>
                    <p style="font-size: 12px; margin-bottom: 5px;">
                        <b>Map Data:</b> © <a href="https://www.openstreetmap.org/copyright" target="_blank" style="color: blue;">OpenStreetMap</a> contributors
                    </p>
                    <p style="font-size: 12px; margin-bottom: 5px;">
                        <b>Basemap Tiles:</b> © <a href="https://www.openstreetmap.org/copyright" target="_blank" style="color: blue;">OpenStreetMap</a> contributors
                    </p>
                    <p style="font-size: 12px; margin-bottom: 5px;">
                        <b>Regional Boundaries:</b> Sourced from <a href="https://data.linz.govt.nz/" target="_blank" style="color: blue;">LINZ Data Service</a> and licensed for reuse under the 
                        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" style="color: blue;">CC BY 4.0</a> license
                    </p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.close-modal').onclick = () => modal.style.display = 'none';
        modal.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
        };
    }
    modal.style.display = 'flex';
}

function getCircuitColor(name) {
    if (!name) return '#999';
    // Simple hash for color
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
        let value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}

function getColorForPort(port) {
    return portColors[port] || '#999999';
}

// --- Layout Helpers ---
// (Layout handled by CSS)

// --- Tools & Interactions ---

// 1. Geolocation
let locationLayer = L.layerGroup().addTo(map);
let currentTool = null; // 'measure', 'coverage', 'locate'

function resetTools(except) {
    // Helper to cleanup UI artifacts
    map.closePopup();
    if (window.currentTargetMarker) {
        map.removeLayer(window.currentTargetMarker);
        window.currentTargetMarker = null;
    }

    if (except !== 'measure' && isMeasuring) clearMeasure();
    if (except !== 'coverage' && isCoverageMode) clearCoverage();
    if (except !== 'locate') {
        locationLayer.clearLayers();
        document.getElementById('locate-btn').classList.remove('active');
    }
    currentTool = except;
}

document.getElementById('locate-btn').addEventListener('click', () => {
    if (currentTool === 'locate') {
        resetTools(null);
    } else {
        resetTools('locate');
        document.getElementById('locate-btn').classList.add('active');
        map.locate({ setView: true, maxZoom: 16 });
    }
});

map.on('locationerror', function (e) {
    showToast("Geolocation Failed. Check HTTPS or Permissions.", "error");
});

// Toast Notification Helper
function showToast(message, type = 'info') {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.style.cssText = `
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: #333; color: white; padding: 12px 24px; border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3); z-index: 2000; font-family: Roboto, sans-serif;
            font-size: 14px; opacity: 0; transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toast);
    }

    if (type === 'error') toast.style.background = '#d32f2f'; // Red

    toast.textContent = message;
    toast.style.opacity = '1';

    setTimeout(() => {
        toast.style.opacity = '0';
    }, 4000);
}

map.on('locationfound', function (e) {
    // Check if we are still in locate mode? 
    // If user clicked away fast, maybe ignore? 
    // But usually we accept the update.
    if (currentTool !== 'locate') return;

    locationLayer.clearLayers();

    const radius = e.accuracy / 2;
    // Accuracy Circle
    L.circle(e.latlng, { radius: radius }).addTo(locationLayer);

    // User Dot
    const userMarker = L.marker(e.latlng, {
        icon: L.divIcon({
            className: 'user-location-dot',
            html: '',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        })
    }).addTo(locationLayer);

    // Info Box Logic
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    let foundFeature = null;

    if (map.hasLayer(regionLayer)) {
        regionLayer.eachLayer(layer => {
            if (layer.feature && layer.getBounds().contains(e.latlng)) {
                if (window.turf) {
                    const pt = turf.point([lng, lat]);
                    if (turf.booleanPointInPolygon(pt, layer.feature)) foundFeature = layer.feature;
                } else {
                    foundFeature = layer.feature;
                }
            }
        });
    }

    // Find nearest CORS station
    const nearestInfo = findNearestStation(lat, lng, true);

    // Check for circuit from stored GeoJSON data (not layer)
    let foundCircuit = null;

    if (circuitData && circuitData.features && window.turf) {
        const pt = turf.point([lng, lat]);

        circuitData.features.forEach(feature => {
            if (!foundCircuit && feature.geometry) {
                try {
                    // Try polygon check first
                    if (turf.booleanPointInPolygon(pt, feature)) {
                        foundCircuit = feature;
                    }
                } catch (e) {
                    // Not a polygon, ignore
                }
            }
        });
    }

    let content = '';

    // Show region info if in a region
    if (foundFeature) {
        const props = foundFeature.properties;
        const name = props.port_name || `Port ${props.port}`;
        const port = props.port;
        const netPort = networkPorts[port] ? `Network Port: ${networkPorts[port]}<br>` : '';
        content = `<b>Region: ${name}</b><br>Single Port: ${port}<br>${netPort}Auto-Connect: Port 4815 (Nearest)`;
    } else {
        content = `<div style="text-align: center;"><b style="color: #2196F3;">📍 My Location</b></div>`;
    }



    if (nearestInfo) {
        // Check if this specific station has a network port
        const stationNetPort = stationMetaData[nearestInfo.code] ? stationMetaData[nearestInfo.code].network_port : null;
        const netPortText = stationNetPort ? `<br>Network Port: <b>${stationNetPort}</b>` : '';

        // Check for circuit info
        let circuitText = '';
        if (foundCircuit) {
            const circuitName = foundCircuit.properties.name || foundCircuit.properties.Name || 'Unknown';
            circuitText = `<br>Circuit: <b>${circuitName}</b>`;
        }

        content += `<hr style="margin: 5px 0; border: 0; border-top: 1px solid #ccc;">
       <span style="color: blue; font-weight: bold;">Nearest Station</span><br>
        <b>${nearestInfo.code}</b><br>
        Location: <b>${nearestInfo.location}</b><br>
        Port: <b>${nearestInfo.port}</b> (Single)${netPortText}${circuitText}<br>
        Distance: ${nearestInfo.distance} km`;
    }

    smartBindTooltip(userMarker, content);
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
        // LINZ Data Service or similar (Mocking or using OSM Nominatim)
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=nz`)
            .then(res => res.json())
            .then(data => {
                resultsList.innerHTML = '';
                if (data.length > 0) {
                    resultsList.classList.remove('hidden');
                    data.forEach(item => {
                        const li = document.createElement('li');
                        li.textContent = item.display_name;
                        li.addEventListener('click', () => {
                            const lat = parseFloat(item.lat);
                            const lon = parseFloat(item.lon);
                            map.setView([lat, lon], 12);
                            resultsList.classList.add('hidden');
                            addressInput.value = item.display_name;

                            // Find nearest station automatically
                            findNearestStation(lat, lon);
                        });
                        resultsList.appendChild(li);
                    });
                } else {
                    resultsList.classList.add('hidden');
                }
            });
    }, 500);
});

// Hide results when clicking map
map.on('click', () => {
    resultsList.classList.add('hidden');
});


// 3. Ruler (Measurement)
let rulerLayer = L.layerGroup().addTo(map);
const rulerBtn = document.getElementById('measure-btn');

// 3.5 Coverage Analysis Tool (Added)
let coverageLayer = L.layerGroup().addTo(map);
const coverageBtn = document.getElementById('coverage-btn');
let isCoverageMode = false;
let coverageRadius = []; // Store radii

function isToolActive() {
    return currentTool !== null;
}

function clearMeasure() {
    isMeasuring = false;
    measurePoints = [];
    if (measurePolyline) rulerLayer.removeLayer(measurePolyline);
    if (measureTooltip) rulerLayer.removeLayer(measureTooltip);
    rulerLayer.clearLayers();
    measurePolyline = null;
    measureTooltip = null;
    if (rulerBtn) rulerBtn.classList.remove('active');

    if (currentTool === 'measure') currentTool = null;

    hideInstruction();
    map.getContainer().style.cursor = '';
}

function clearCoverage() {
    isCoverageMode = false;
    coverageRadius = [];
    coverageLayer.clearLayers();
    if (coverageBtn) coverageBtn.classList.remove('active');

    if (currentTool === 'coverage') currentTool = null;

    hideInstruction();
    map.getContainer().style.cursor = '';
}

if (rulerBtn) {
    rulerBtn.addEventListener('click', () => {
        if (isMeasuring) {
            resetTools(null);
        } else {
            resetTools('measure');
            isMeasuring = true;
            rulerBtn.classList.add('active');
            map.getContainer().style.cursor = 'crosshair';
            showInstruction("Measure: Click start point...");
        }
    });
}

if (coverageBtn) {
    coverageBtn.onclick = () => {
        if (isCoverageMode) {
            resetTools(null);
        } else {
            resetTools('coverage'); // Clear others

            let input = prompt("Enter coverage radius in km (comma separated for multiple):", "10");
            if (input === null) {
                resetTools(null); // Cancel
                return;
            }

            let radii = input.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0);
            if (radii.length === 0) {
                alert("Invalid inputs");
                resetTools(null);
                return;
            }

            coverageRadius = radii;
            isCoverageMode = true;
            // Class active added by resetTools('coverage')? No, resetTools clears others.
            coverageBtn.classList.add('active');
            map.getContainer().style.cursor = 'crosshair';

            // Draw coverage rings around all stations
            allStations.forEach(station => {
                const lat = station.geometry.coordinates[1];
                let lon = station.geometry.coordinates[0];
                if (lon < -170) lon += 360; // CHTI fix

                const latlng = L.latLng(lat, lon);
                drawCoverageRings(latlng);
            });

            showInstruction("Coverage: Click a station (or map point) to add more rings.");
        }
    };
}

map.on('click', (e) => {
    // 0. Toggle off locate mode if active
    if (currentTool === 'locate') {
        resetTools(null);
        return;
    }

    // 1. Coverage Tool Logic
    if (isCoverageMode) {
        // Do NOT clear layers, allow multiple
        drawCoverageRings(e.latlng);
        // Remove return to allow click propagation (showing info box)
    }

    if (!isMeasuring) return;

    // Hide instruction on first click interaction
    hideInstruction();

    // 2-Point Logic: If we already have 2 points (completed segment), separate old and start new
    if (measurePoints.length >= 2) {
        measurePoints = [];
        rulerLayer.clearLayers();
    }

    measurePoints.push(e.latlng);

    // Draw Line
    if (measurePoints.length > 1) {
        L.polyline(measurePoints, { color: 'black', weight: 4 }).addTo(rulerLayer);

        const p1 = measurePoints[0];
        const p2 = measurePoints[1];
        const dist = p1.distanceTo(p2);

        // Midpoint for label
        const midLat = (p1.lat + p2.lat) / 2;
        const midLng = (p1.lng + p2.lng) / 2;

        // Angle calculation for Parallel Label
        // Convert to Container Points to get screen angle
        const cp1 = map.latLngToContainerPoint(p1);
        const cp2 = map.latLngToContainerPoint(p2);

        let angle = Math.atan2(cp2.y - cp1.y, cp2.x - cp1.x) * (180 / Math.PI);

        // Keep text right-side up
        if (angle > 90 || angle < -90) {
            angle += 180;
        }

        // Offset calculation (perpendicular)
        // Normal vector (-dy, dx)
        const dx = cp2.x - cp1.x;
        const dy = cp2.y - cp1.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        // Perpendicular offset (e.g. 15px)
        const offsetPx = 15;
        let offX = 0;
        let offY = 0;

        if (len > 0) {
            // Normalized normal (-dy, dx) or (dy, -dx)
            // Logic handled by CSS transform currently
        }
        // We want "above". If angle is adjusted to be upright, we need to consistent "up".
        // Since we rotate the text, we can just position the marker at midpoint and use margin/transform in CSS?
        // Or adjust the Anchor.
        // Let's adjust the LatLng based on pixel offset? Hard because of projection.
        // Easier: Adjust the Anchor point of the icon.
        // Standard Anchor is [width/2, height/2]. 
        // Our iconSize is null (auto).
        // We are rotating the DIV inside.
        // Let's rely on CSS transformY in the labelHtml?


        let labelHtml = '';
        if (isMeasuring) {
            const text = (dist > 1000) ? (dist / 1000).toFixed(2) + ' km' : dist.toFixed(1) + ' m';
            // Position text with small space above line for readability, strong white shadow
            labelHtml = `<div style="transform: rotate(${angle}deg) translateY(-8px); font-weight: bold; font-size: 14px; text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 0 4px #fff;">${text}</div>`;
        }

        L.marker([midLat, midLng], {
            icon: L.divIcon({
                className: 'distance-label-halo',
                html: labelHtml,
                iconSize: null,
                iconAnchor: [20, 10] // Keep pivot roughly center
            })
        }).addTo(rulerLayer);

        // End Dot
        if (measurePoints.length > 0) {
            L.circleMarker(measurePoints[measurePoints.length - 1], { radius: 4, color: 'black', fillColor: 'black', fillOpacity: 1 }).addTo(rulerLayer);
        }

    } else {
        // First point
        L.circleMarker(e.latlng, { radius: 4, color: 'black', fillColor: 'black', fillOpacity: 1 }).addTo(rulerLayer);
    }
});

function drawCoverageRings(latlng) {
    // Shared Logic ensuring multiple rings possible
    // Radius 3 dot
    L.circleMarker(latlng, { radius: 3, color: 'black' }).addTo(coverageLayer);

    coverageRadius.forEach(r => {
        L.circle(latlng, { radius: r * 1000, color: '#3388ff', fill: false, weight: 1 }).addTo(coverageLayer);
        // Label removed per user request
    });
}

// Nearest Station Logic
function findNearestStation(lat, lon, returnInfo = false) {
    let nearest = null;
    let minDist = Infinity;

    allStations.forEach(station => {
        const sLat = station.geometry.coordinates[1];
        const sLon = station.geometry.coordinates[0];
        const dist = map.distance([lat, lon], [sLat, sLon]);

        if (dist < minDist) {
            minDist = dist;
            nearest = station;
        }
    });

    if (nearest) {
        const props = nearest.properties;
        const distKm = (minDist / 1000).toFixed(1);

        // Highlight logic (Optional: Draw line?)
        // users usually just want the info

        if (returnInfo) {
            const code = props['Site Code'] ? props['Site Code'].toString().trim().toUpperCase() : '';
            const locName = (typeof stationLocations !== 'undefined' && stationLocations[code])
                ? stationLocations[code]
                : (props['Site Name'] || 'Unknown');
            return {
                name: props['Site Name'],
                location: locName,
                code: code,
                port: props.assignedPort,
                distance: distKm
            };
        }
    }
    return null;
}

// Helper: Determine Authoritative Port for Station
function getPortForStation(code, lat) {
    // 0. Specific Overrides (User Request)
    if (code === 'METH' || code === 'GSCT') return 4803;

    // 1. Check Authoritative List
    if (authoritativePorts[code]) {
        return authoritativePorts[code];
    }
    // 2. Fallback: Spatial (rough latitudes) if needed, or default
    // Using simple lat bands as fallback if not in list
    if (lat < -45.0) return 4801; // Southland
    if (lat < -42.5) return 4803; // Canterbury
    if (lat < -41.0) return 4802; // Nelson
    if (lat < -40.0) return 4804; // Wellington
    if (lat < -39.0) return 4806; // Taranaki
    if (lat < -37.5) return 4807; // Bay of Plenty
    return 4809; // Auckland/Northland
}

// Custom Pane for Labels
map.createPane('labelPane');
map.getPane('labelPane').style.zIndex = 650;
map.createPane('regionPane'); // Below stations
map.getPane('regionPane').style.zIndex = 400;
map.createPane('stationPane');
map.getPane('stationPane').style.zIndex = 600;

// Coordinate Display Logic
const coordsDiv = document.getElementById('coords-display'); // FIXED matched ID
let lastLatLng = null;
let coordMode = 0; // 0 = Lat/Lon, 1 = NZTM

// Proj4 Definition for NZTM (EPSG:2193)
if (window.proj4) {
    proj4.defs("EPSG:2193", "+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
}

function updateCoordText(latlng) {
    if (!coordsDiv) return;
    if (!latlng) {
        coordsDiv.innerText = "Tap on the map to update";
        return;
    }

    if (coordMode === 0) {
        // Lat / Lon
        coordsDiv.innerText = `Lat: ${latlng.lat.toFixed(5)}  Lon: ${latlng.lng.toFixed(5)}`;
    } else {
        // NZTM
        try {
            if (window.proj4) {
                const result = proj4(proj4.defs('EPSG:4326'), proj4.defs('EPSG:2193'), [latlng.lng, latlng.lat]);
                coordsDiv.innerText = `NZTM East: ${result[0].toFixed(1)}m  North: ${result[1].toFixed(1)}m`;
            } else {
                coordsDiv.innerText = "Proj4 Missing";
            }
        } catch (e) {
            coordsDiv.innerText = "Proj4 Error";
        }
    }
}

// Toggle Mode on Click Bar
if (coordsDiv) {
    coordsDiv.addEventListener('click', (e) => {
        L.DomEvent.stopPropagation(e); // Prevent map click
        coordMode = (coordMode + 1) % 2; // Toggle 0 <-> 1
        updateCoordText(lastLatLng);
    });

    // Initial State
    coordsDiv.style.display = 'block';
    updateCoordText(null);

    // Desktop Hover
    map.on('mousemove', (e) => {
        const isMobile = window.matchMedia("(max-width: 600px)").matches;
        if (!isMobile) {
            lastLatLng = e.latlng;
            updateCoordText(e.latlng);
        }
    });

    // Mobile Tap (and Desktop Click)
    map.on('click', (e) => {
        lastLatLng = e.latlng;
        // Always update bar on click (useful for Mobile "Tap to update")
        updateCoordText(e.latlng);
    });

    // Reset when off map (Desktop only)
    map.on('mouseout', () => {
        const isMobile = window.matchMedia("(max-width: 600px)").matches;
        if (!isMobile) {
            // lastLatLng = null;
        }
    });
}

// --- Smart Tooltip Helper ---
function smartBindTooltip(marker, content) {
    if (!marker) return;

    let direction = 'right'; // Default
    try {
        // Use global map if marker._map is missing
        const m = marker._map || map;
        const point = m.latLngToContainerPoint(marker.getLatLng());
        const width = m.getSize().x;
        direction = (point.x > width / 2) ? 'left' : 'right';
    } catch (e) {
        console.warn("Smart Tooltip Error:", e);
    }

    marker.bindTooltip(content, {
        permanent: true,
        direction: direction,
        className: 'region-label pinned-tooltip',
        offset: (direction === 'left') ? [-5, 0] : [5, 0],
        opacity: 0.9
    }).openTooltip();
}

// --- Tool Instruction Helpers ---
let instructionBox = null;

function showInstruction(text) {
    if (!instructionBox) {
        instructionBox = document.createElement('div');
        instructionBox.className = 'tool-instruction';
        document.body.appendChild(instructionBox);
    }
    instructionBox.innerHTML = text; // Allow HTML?
    instructionBox.style.display = 'block';

    // Add mousemove listener
    document.addEventListener('mousemove', updateInstructionPos);
}

function hideInstruction() {
    if (instructionBox) {
        instructionBox.style.display = 'none';
    }
    document.removeEventListener('mousemove', updateInstructionPos);
}

function updateInstructionPos(e) {
    if (!instructionBox || instructionBox.style.display === 'none') return;

    // User Requirement: "if the user select a point close to far left or right or top or bottom the the information box will appear where it can be seen on the corner of the cursor."
    // Quadrant Logic.

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 15; // Gap from cursor

    const x = e.clientX;
    const y = e.clientY;

    let left, top;

    // Determine Quadrant
    const isRight = x > viewportWidth / 2;
    const isBottom = y > viewportHeight / 2;

    // Default Offset logic based on Quadrant
    if (!isRight && !isBottom) {
        // Top-Left -> Box to Bottom-Right
        left = x + padding;
        top = y + padding;
    } else if (isRight && !isBottom) {
        // Top-Right -> Box to Bottom-Left
        left = x - instructionBox.offsetWidth - padding;
        top = y + padding;
    } else if (!isRight && isBottom) {
        // Bottom-Left -> Box to Top-Right
        left = x + padding;
        top = y - instructionBox.offsetHeight - padding;
    } else {
        // Bottom-Right -> Box to Top-Left
        left = x - instructionBox.offsetWidth - padding;
        top = y - instructionBox.offsetHeight - padding;
    }

    // Final Clamp to ensure it doesn't leave screen (Fallback)
    if (left < 10) left = 10;
    if (top < 10) top = 10;
    if (left + instructionBox.offsetWidth > viewportWidth) left = viewportWidth - instructionBox.offsetWidth - 10;
    if (top + instructionBox.offsetHeight > viewportHeight) top = viewportHeight - instructionBox.offsetHeight - 10;

    instructionBox.style.left = left + 'px';
    instructionBox.style.top = top + 'px';
}
