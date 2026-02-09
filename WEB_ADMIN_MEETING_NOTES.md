# Meeting Notes for Website Manager / Admin

**Goal:** effectively host the SBC Stations Web Map (~10MB total payload reduced to ~500KB) while ensuring security, performance, and analytics visibility.

---

## 1. Technical Overview for the Admin
*   **Application Type:** Static Website (HTML, CSS, JS, JSON).
*   **Hosting Requirement:** Basic static file hosting (Apache, Nginx, IIS, Netlify, or AWS S3).
*   **No Backend Required:** The Python scripts run *offline* on my local machine to generate the data files (`.geojson`). The server only hosts these files.
*   **Map Engine:** Leaflet JS (Client-side rendering).

## 2. Traffic & Bandwidth Optimization
*   **Original Challenge:** The map data (`Port_Regions.geojson`) was ~10.5 MB.
*   **Solution Applied:** I have optimized the geometry using topology simplification.
    *   **New Size:** ~35 KB (Compressed). 
    *   **Result:** The entire site is now extremely lightweight and suitable for mobile.
*   **Request for Admin:**
    *   "Can we ensure **GZIP or Brotli compression** is enabled for `.json` and `.geojson` files on the server?"
    *   "Can we set **Cache-Control headers** (e.g., `max-age=86400`) for the `/data/` directory so users don't re-download the map every time they refresh?"

## 3. Security
*   **Risk Profile:** Low (Static files).
*   **Questions for Admin:**
    *   **HTTPS:** "The site requires HTTPS for the 'Locate Me' (Geolocation) feature to work on mobile. Can we ensure an SSL certificate is active?"
    *   **Protection:** "Do we use a WAF (Web Application Firewall) or CDN like **Cloudflare**? I'd recommend it to prevent bot traffic or hotlinking of our data files."

## 4. Analytics (Seeing the Traffic)
*   **Requirement:** We want to know how many people use the map and where they come from.
*   **Questions for Admin:**
    *   "Does the server provide access logs or a dashboard (like AWStats or GoAccess)?"
    *   "Are we allowed to embed **Google Analytics** or **Cloudflare Web Analytics**? If so, please provide the tracking ID snippet, and I will add it to `index.html`."

## 5. Deployment Package
*   I will provide a zip file `SBC_WebMap_v17.zip`.
*   **Structure:**
    *   `index.html` (Entry point)
    *   `style.css`, `script.js`
    *   `data/` (Folder containing GeoJSON files)
    *   `images/` (Icons)
*   **Installation:** Simply extract to the web root or a subdirectory (e.g., `example.com/map/`).

---
**Summary Checklist for Meeting:**
- [ ] Confirm HTTPS (Mandatory for Mobile).
- [ ] Ask about Compression (Gzip) for performance.
- [ ] Ask for an Analytics ID (if desired).
- [ ] confirm folder path for deployment (e.g. `/sbc-map`).
