import geopandas as gpd
import os

# Paths
INPUT_GPKG = r"c:\Users\Thomas\Developer\SBC Stations\Geopackage Files\lds-nz-meridional-circuit-boundaries-nzgd2000-GPKG\nz-meridional-circuit-boundaries-nzgd2000.gpkg"
OUTPUT_GEOJSON = r"c:\Users\Thomas\Developer\SBC Stations\app\data\Meridional_Circuits.geojson"

def main():
    print(f"Reading {INPUT_GPKG}...")
    try:
        # Read the file
        gdf = gpd.read_file(INPUT_GPKG)
        print(f"Loaded {len(gdf)} features.")
        print(f"Original CRS: {gdf.crs}")

        # Reproject to WGS84 (EPSG:4326) for Web Leaflet
        if gdf.crs.to_epsg() != 4326:
            print("Reprojecting to EPSG:4326...")
            gdf = gdf.to_crs(epsg=4326)

        # Save to GeoJSON
        print(f"Saving to {OUTPUT_GEOJSON}...")
        gdf.to_file(OUTPUT_GEOJSON, driver="GeoJSON")
        print("Success!")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
