import os
import sys

from dotenv import load_dotenv

load_dotenv()

print("[*] Running GIS Environment Smoke Test...")

try:
    import geopandas
    import networkx
    import osmnx
    import rasterio
    import requests
    import shapely
    print("[+] Core spatial libraries successfully imported.")
except ImportError as exc:
    print(f"[!] Binary/Module Import Error: {exc}")
    sys.exit(1)

api_key = os.getenv("OPENTOPO_API_KEY")
if not api_key:
    print("[WARN] OPENTOPO_API_KEY not found in .env. OpenTopography rate limits may apply.")
else:
    print("[+] OPENTOPO_API_KEY loaded from .env.")

print("[SUCCESS] GIS Environment is ready.")
