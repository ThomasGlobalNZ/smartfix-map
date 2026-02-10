import geopandas as gpd
import pandas as pd
from shapely.geometry import box, MultiPoint, Point
from shapely.ops import voronoi_diagram
import os
import json

# --- Configuration matching script.js ---

PORT_COLORS = {
    # North Island
    4809: '#9b59b6', # Auckland/Northland - Purple
    4807: '#e67e22', # Waikato/BoP - Orange
    4806: '#2ecc71', # Central North Island - Green (Brighter)
    4804: '#e74c3c', # Wellington - Red (New)

    # South Island
    4802: '#1abc9c', # Nelson/Marlborough - Teal (New)
    4803: '#e91e63', # Canterbury - Pink (Distinct)
    4801: '#f1c40f'  # Otago/Southland - Yellow
}

PORT_NAMES = {
    4809: 'Auckland / Northland',
    4807: 'Bay of Plenty / Waikato',
    4806: 'Central North Island',
    4804: 'Wellington / Lower North',
    4802: 'Nelson / Marlborough / West Coast',
    4803: 'Canterbury',
    4801: 'Otago / Southland'
}

# Specific port overrides
# Sources: User Request + Knowledgebase Search
import json

# Specific port overrides
# Sources: User Request + Knowledgebase Search
# NOTE: This static list is now a fallback. We load authoritative data from JSON below.
SPECIFIC_PORTS = {
    # Original list kept as fallback or for stations not in NTRIP table
    # ...
    # (Leaving empty here for brevity in diff, but I will actually just REPLACE the initialization)
}

# Load Authoritative Mapping
try:
    with open("app/data/station_port_mapping.json", "r") as f:
        MAPPED_PORTS = json.load(f)
        # Convert values to int just in case
        MAPPED_PORTS = {k: int(v) for k, v in MAPPED_PORTS.items()}
        print(f"Loaded {len(MAPPED_PORTS)} authoritative port mappings.")
except Exception as e:
    print(f"Warning: Could not load station_port_mapping.json: {e}")
    MAPPED_PORTS = {}

# Merge: MAPPED_PORTS takes precedence over hardcoded defaults if we wanted, 
# but effectively we just use get_port_for_station logic.
# Let's make SPECIFIC_PORTS the union, with JSON overwriting static.
# Re-initializing SPECIFIC_PORTS with the static data we had (I'll keep the big dict in code for safety/fallback)
# OR better: Just define empty and let JSON fill it, since user wants "without manual check".
# But to be safe, I'll keep the static list and update it.

STATIC_PORTS = {
    # 4809: Auckland / Northland
    'KTIA': 4809, 'GSKK': 4809, 'GSWR': 4809, 'WHNG': 4809, 'DARG': 4809,
    'MANG': 4809, 'WARK': 4809, 'SHEL': 4809, 'WHGP': 4809, 'MILL': 4809,
    'PENL': 4809, 'ALBA': 4809, 'HUAP': 4809, 'AUCK': 4809, 'WAIM': 4809,
    'GLEN': 4809, 'CORO': 4809, 'WATER': 4809, 'BEAC': 4809, 'AIRP': 4809,
    'PAPA': 4809, 'TAIR': 4809, 'THAM': 4809, 'PUKE': 4809, 'WAIU': 4809,
    'POKE': 4809, 'TEKA': 4809, 'GSPK': 4809,
    
    # 4807: Bay of Plenty / Waikato
    'WAIH': 4807, 
    'MORR': 4807, 'TERA': 4807, 'PYES': 4807, 'HAMI': 4807,
    'WHAT': 4807, 'MATA': 4807, 'CAMB': 4807, 'TEAW': 4807,
    'PUTA': 4807, 'ROTO': 4807, 'UTUH': 4807, 'BROA': 4807,
    'ARAT': 4807, 'PATU': 4807, 'KAIA': 4807, 'WHAR': 4807, 
    'TRNG': 4807, 'GSRO': 4807, 
    
    # 4806: Central North Island
    'OMOK': 4806, 
    'BELL': 4806, 'NPLY': 4806, 'OHAK': 4806, 'NAPI': 4806,
    'HAWE': 4806, 'HAST': 4806, 'MAXW': 4806, 'WANG': 4806, 'WAIT': 4806,
    'PALM': 4806, 'GISB': 4806,
    
    # 4804: Wellington / Lower North
    'LEVI': 4804, 'WAIK': 4804, 'PAEK': 4804, 'WAIR': 4804, 'UPPE': 4804,
    'PORI': 4804, 'AVAL': 4804, 'TERA': 4804, 'WELL': 4804, 'BATT': 4804,
    'WGTN': 4804, 'MAST': 4804,

    # 4802: Nelson / Marlborough / West Coast
    'NLSN': 4802, 'GSNE': 4802, 'GSPI': 4802, 'GSPC': 4802, 
    'MURCH': 4802, 'REEF': 4802, 'KAIK': 4802, 'GSBN': 4802, 
    'CMBL': 4802,
    
    # 4803: Canterbury
    'LY2T': 4803, 'GSCC': 4803, 'GSTI': 4803, 'ASHB': 4803, 'TIMA': 4803,
    'TWIZ': 4803, 'FAIR': 4803, 'METH': 4803, 'GSCT': 4803,
    'GSAB': 4803,
    
    # 4801: Otago / Southland
    'DUND': 4801, 'GSIN': 4801, 'GSQU': 4801, 'GSCW': 4801, 'BLUF': 4801,
    'GSOM': 4801, 'OAMA': 4801, 'ALEX': 4801, 'ROXB': 4801, 'BALC': 4801, 
    'GORE': 4801, 'LUMS': 4801, 'TEAN': 4801, 'OUSD': 4801
}

# Merge: JSON overrides Static
SPECIFIC_PORTS = STATIC_PORTS.copy()
SPECIFIC_PORTS.update(MAPPED_PORTS)
SPECIFIC_PORTS['GHOST_WEST'] = 4802  # Force Ghost Station to 4802

# File Paths
DATA_DIR = "app/data"
GLOBAL_GEOJSON = os.path.join(DATA_DIR, "Sites_20250725_Global.geojson")
LINZ_GEOJSON = os.path.join(DATA_DIR, "Sites_20250725_LINZ.geojson")
MASK_GPKG = "Geopackage Files/Port mask area.gpkg"
OUTPUT_GPKG = "Geopackage Files/Port_Regions_Clipped.gpkg"
OUTPUT_WEB_GEOJSON = os.path.join(DATA_DIR, "Port_Regions.geojson")

# Bounding Box for Voronoi (matching script.js)
# [minX, minY, maxX, maxY] -> 160.0, -50.0, 185.0, -30.0
BBOX = box(160.0, -50.0, 185.0, -30.0)

def get_port_for_station(station_code, lat):
    """
    Determines the port ID based on station code or latitude.
    Matches logic in app/script.js
    """
    # 1. Check specific overrides
    if station_code in SPECIFIC_PORTS:
        return SPECIFIC_PORTS[station_code]

    # 2. Latitude-based Fallback
    if lat > -38.0: return 4809
    if lat > -39.0: return 4807
    if lat > -40.5: return 4806
    if lat > -41.5: return 4804
    # South Island
    if lat > -42.5: return 4802
    if lat > -44.5: return 4803

    return 4801

EXCLUDED_STATIONS = ["TREC", "trec", "2GRO", "2GR0", "1778", "7651", "xGRX", "xgrx", "GSMG", "gsmg", "NTGT", "JTGT"]

def main():
    print("Loading station data...")
    try:
        gdf_global = gpd.read_file(GLOBAL_GEOJSON)
        gdf_linz = gpd.read_file(LINZ_GEOJSON)
    except Exception as e:
        print(f"Error loading GeoJSON files: {e}")
        print("Please check that the files exist in 'app/data/'.")
        return

    # Combine datasets
    print(" combining datasets...")
    stations = pd.concat([gdf_global, gdf_linz], ignore_index=True)
    
    # Filter Excluded Stations
    print(f"Filtering excluded stations: {EXCLUDED_STATIONS}")
    # Ensure Site Code column exists and is normalized
    if 'Site Code' in stations.columns:
        stations = stations[~stations['Site Code'].str.upper().isin(EXCLUDED_STATIONS)]
    
    # --- Ghost Stations (User requested to define borders) ---
    # These force the Voronoi polygons to extend into empty areas.
    print("Adding Ghost Stations for boundary definition...")
    GHOST_STATIONS = [
        # "Between Haas and Hoki" - approx Westland/Main Divide
        {'Site Code': 'GHOST_WEST', 'geometry': Point(170.0, -43.3), 'port': 4802} 
    ]
    
    ghosts_gdf = gpd.GeoDataFrame(GHOST_STATIONS, crs="EPSG:4326")
    
    # We append them to the STATIONS used for generation, 
    # BUT they won't appear in the final web map JSON because 
    # we regenerate 'stations_gdf' (which we don't save? Wait, we save regions).
    # Correct: This script saves REGIONS. The DOTS come from the original GeoJSONs in script.js.
    # So adding them here affects the POLYGONS but not the displayed DOTS. Perfect.
    
    stations = pd.concat([stations, ghosts_gdf], ignore_index=True)

    if stations.crs is None:
        stations.set_crs(epsg=4326, inplace=True)
    elif stations.crs.to_epsg() != 4326:
        stations = stations.to_crs(epsg=4326)

    print(f"Total stations (including ghosts): {len(stations)}")

    # Prepare points for Voronoi
    points = MultiPoint(stations.geometry.tolist())
    
    print("Generating Voronoi diagram...")
    regions = voronoi_diagram(points, envelope=BBOX)
    
    # regions is a GeometryCollection of Polygons.
    print("Mapping regions to stations...")
    regions_gdf = gpd.GeoDataFrame(geometry=list(regions.geoms), crs=stations.crs)
    
    # Spatial join: Assign station attributes to the region containing it
    joined = gpd.sjoin(regions_gdf, stations, how="inner", predicate="contains")
    
    # Calculate Port for each region
    print("Assigning ports...")
    joined['port'] = joined.apply(
        lambda row: get_port_for_station(row['Site Code'], row.geometry.centroid.y), 
        axis=1
    )
    
    # Add metadata
    joined['port_name'] = joined['port'].map(PORT_NAMES)
    joined['color'] = joined['port'].map(PORT_COLORS)
    
    # Dissolve by Port (Unclipped first)
    print("Dissolving by Port (Unclipped)...")
    dissolved = joined.dissolve(by='port', aggfunc='first') 
    dissolved = dissolved.reset_index()
    
    # --- Masking / Clipping ---
    if os.path.exists(MASK_GPKG):
        print(f"Loading Mask from {MASK_GPKG}...")
        try:
            mask_gdf = gpd.read_file(MASK_GPKG)
            if mask_gdf.crs.to_epsg() != 4326:
                print("Reprojecting mask to EPSG:4326...")
                mask_gdf = mask_gdf.to_crs(epsg=4326)
            
            print("Dissolving mask...")
            mask_geom = mask_gdf.dissolve().geometry.iloc[0]
            
            print("Clipping regions to mask...")
            # Ideally use gpd.clip, but fallback to intersection if needed for complex geoms
            clipped = gpd.clip(dissolved, mask_geom)
            
            # Clean up empty geometries if any
            clipped = clipped[~clipped.is_empty]
            
            final_gdf = clipped[['port', 'port_name', 'color', 'geometry']]
            print("Clipping complete.")
        except Exception as e:
            print(f"Error during masking: {e}. Using unclipped regions.")
            final_gdf = dissolved[['port', 'port_name', 'color', 'geometry']]
    else:
        print(f"Mask file not found at {MASK_GPKG}. Using unclipped regions.")
        final_gdf = dissolved[['port', 'port_name', 'color', 'geometry']]
    
    # Simplify geometry to reduce file size (10MB -> ~500KB)
    print("Simplifying geometries...")
    final_gdf['geometry'] = final_gdf['geometry'].simplify(tolerance=0.001, preserve_topology=True)
    
    # --- Saving ---
    
    # Save to GPKG
    print(f"Saving to {OUTPUT_GPKG}...")
    if os.path.exists(OUTPUT_GPKG):
        try:
            os.remove(OUTPUT_GPKG)
        except PermissionError:
            print(f"Warning: Could not delete existing file {OUTPUT_GPKG}. Attempting overwrite.")
            
    final_gdf.to_file(OUTPUT_GPKG, driver="GPKG", layer="Port_Regions")
    
    # Save to GeoJSON for Web App
    print(f"Saving to {OUTPUT_WEB_GEOJSON}...")
    if os.path.exists(OUTPUT_WEB_GEOJSON):
        os.remove(OUTPUT_WEB_GEOJSON)
        
    final_gdf.to_file(OUTPUT_WEB_GEOJSON, driver="GeoJSON")
    
    print("Success.")

if __name__ == "__main__":
    main()
