
import geopandas as gpd
import os

# Paths (Relative to C:\Users\Thomas\Developer\SBC Stations)
INPUT_GPKG = "Geopackage Files/statsnz-territorial-authority-2025-GPKG/territorial-authority-2025.gpkg"
OUTPUT_MASK = "app/data/mask.geojson"

def process_mask():
    if not os.path.exists(INPUT_GPKG):
        print(f"Error: GPKG not found at {INPUT_GPKG}. Checking other locations...")
        # fallback check?
        return

    print("Loading GPKG...")
    gdf = gpd.read_file(INPUT_GPKG)
    
    # Ensure CRS is 4326
    if gdf.crs.to_epsg() != 4326:
        print("Reprojecting to EPSG:4326...")
        gdf = gdf.to_crs(epsg=4326)

    print("Dissolving to single geometry...")
    # Dissolve all features into one (New Zealand)
    mask = gdf.dissolve()

    print("Fixing topology (buffer(0))...")
    # Buffer(0) helps fix self-intersections
    mask['geometry'] = mask['geometry'].buffer(0)

    # Convert to single MultiPolygon/Polygon (flatten)
    # Just selecting the first row as dissolve creates one row
    
    print(f"Saving to {OUTPUT_MASK}...")
    if os.path.exists(OUTPUT_MASK):
        os.remove(OUTPUT_MASK)
        
    mask.to_file(OUTPUT_MASK, driver='GeoJSON')
    print("Done.")

if __name__ == "__main__":
    process_mask()
