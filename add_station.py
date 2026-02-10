import json
import os

GEOJSON_PATH = "app/data/Sites_20250725_Global.geojson"

# New Station Data
new_feature = {
    "type": "Feature",
    "properties": {
        "Site Name": "GSWF",  # Marker Name
        "Site Code": "GSWF",
        "Ref Station": 0,  # Placeholder
        "Site Server Name": "Global Sites",
        "Sat. Sys.": "G/R/E/C/J",
        "Latitude": "36° 18' 12'' S",
        "Longitude": "174° 31' 41'' E",
        "Height": 120.3,
        "Use Physical Coordinates": "Yes",
        "Physical Latitude": "36° 18' 12'' S",
        "Physical Longitude": "174° 31' 41'' E",
        "Physical Height": 120.3,
        "Reciever Type": "SEPT POLARX5",  # Defaulting as it's common for new sites
        "Antenna Type": "NONE",
        "Total Vertical Height": 0.0,
        "Cluster Name": "Auckland/Waikato", # Inferring cluster
        "Master in Cell": "GSWFfixed",
        "Aux in Cell": None,
        # Decimal Degrees (Calculated: 36 + 18/60 + 12/3600 = 36.303333...)
        "latitude_dd": -36.30333333,
        "longitude_dd": 174.52805556
    },
    "geometry": {
        "type": "Point",
        "coordinates": [
            174.52805556,
            -36.30333333
        ]
    }
}

def main():
    if not os.path.exists(GEOJSON_PATH):
        print(f"Error: {GEOJSON_PATH} not found.")
        return

    try:
        with open(GEOJSON_PATH, 'r') as f:
            data = json.load(f)
        
        # Check if exists
        for feature in data['features']:
            if feature['properties'].get('Site Code') == "GSWF":
                print("Station GSWF already exists. Skipping.")
                return

        data['features'].append(new_feature)
        print("Added GSWF to features.")

        with open(GEOJSON_PATH, 'w') as f:
            json.dump(data, f, indent=None, separators=(',', ':')) # Minimal formatting to match style if possible, or just default
            # standard json dump is fine.
        
        print("Successfully saved GeoJSON.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
