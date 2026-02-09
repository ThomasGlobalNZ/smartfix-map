import geopandas as gpd
import os

# Paths
gpkg_path = r"C:/Users/Thomas/Developer/SBC Stations/Geopackage Files/statsnz-territorial-authority-2025-GPKG/territorial-authority-2025.gpkg"
output_path = r"C:/Users/Thomas/Developer/SBC Stations/app/data/mask.geojson"

print(f"Loading GPKG: {gpkg_path}")

try:
    # Load the first layer
    gdf = gpd.read_file(gpkg_path)
    print(f"Loaded {len(gdf)} features. CRS: {gdf.crs}")

    # Ensure EPSG:4326 for web usage
    if gdf.crs != "EPSG:4326":
        print("Reprojecting to EPSG:4326...")
        gdf = gdf.to_crs("EPSG:4326")

    # Dissolve all polygons into one (Union)
    print("Dissolving features into single boundary...")
    dissolved = gdf.dissolve()

    # Simplify to reduce file size and improve browser performance
    # Tolerance 0.001 deg is approx 100m, good for web visual mask
    print("Simplifying geometry...")
    simplified = dissolved.simplify(tolerance=0.001, preserve_topology=True)

    # Save to GeoJSON
    print(f"Saving to {output_path}...")
    simplified.to_file(output_path, driver="GeoJSON")

    print("Success! Mask created.")

except Exception as e:
    print(f"Error: {e}")
