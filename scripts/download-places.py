"""Bounded official Overture Places download; no UI request contacts this source.
Use the repository venv: .data/import-venv/bin/python scripts/download-places.py.
"""
import argparse
import json
import re
import os
from pathlib import Path
import subprocess
import sys
import urllib.request

PILOT = [11.83, 54.735, 11.93, 54.81]
parser = argparse.ArgumentParser()
parser.add_argument('--region', default='nykoebing-falster')
parser.add_argument('--name', default='Nykøbing Falster')
parser.add_argument('--bounds', default=','.join(map(str, PILOT)))
parser.add_argument('--release')
parser.add_argument('--publish-seed', action='store_true')
args = parser.parse_args()
bounds = [float(n) for n in args.bounds.split(',')]
if len(bounds) != 4 or not (7.8 <= bounds[0] < bounds[2] <= 15.3 and 54.4 <= bounds[1] < bounds[3] <= 57.9):
    raise SystemExit('Choose a bounded area in Denmark; no unbounded global downloads.')
if not re.fullmatch(r'[a-z0-9-]{1,60}',args.region):
    raise SystemExit('Invalid region identifier')
from overturemaps import core
import pyarrow.fs as fs
# Reuse the environment's supported HTTPS proxy, retaining TLS verification.
original_s3 = fs.S3FileSystem
proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
if proxy:
    def configured_s3(*a, **kw):
        kw['proxy_options'] = proxy
        return original_s3(*a, **kw)
    core.fs.S3FileSystem = configured_s3
try:
    release = args.release or core.get_latest_release()
except Exception:
    raise SystemExit('Overtures officielle STAC-katalog kan ikke nås. Kontrollér netværksadgang. Eksisterende virksomhedsdata er bevaret.')
if not re.fullmatch(r'\d{4}-\d{2}-\d{2}\.\d+',release):
    raise SystemExit('Invalid official release identifier; existing data preserved.')
folder = Path('.data/imports')
folder.mkdir(parents=True, exist_ok=True)
output = folder / f'{args.region}-{release}.geojson'
# stream GeoJSON using the official client; bounded STAC index, read-only public S3.
# Require the spatial index; do not silently scan the worldwide catalog if it fails.
files = core._get_files_from_stac('places', 'place', core._coerce_bbox(bounds), release)
if files is None:
    raise SystemExit('Overtures geografiske indeks kan ikke nås. Eksisterende data er bevaret.')
core._get_files_from_stac = lambda *a, **kw: files
reader = core.record_batch_reader('place', bbox=bounds, release=release, stac=True, connect_timeout=20, request_timeout=60)
if reader is None:
    raise SystemExit('No Overture files intersect this region. Existing database preserved.')
from shapely import from_wkb, to_geojson
features = []
for batch in reader:
    for row in batch.to_pylist():
        geometry = json.loads(to_geojson(from_wkb(row.pop('geometry'))))
        row.pop('bbox', None)
        features.append({'type': 'Feature', 'id': row.get('id'), 'geometry': geometry, 'properties': row})
if not features:
    raise SystemExit('Empty source response; existing database preserved.')
# Atomic raw snapshot; retain provenance for repeatable imports.
temporary = output.with_suffix('.tmp')
temporary.write_text(json.dumps({'type':'FeatureCollection','features':features}, default=lambda v: v.isoformat() if hasattr(v,'isoformat') else str(v)), encoding='utf-8')
temporary.replace(output)
command = ['node','--use-env-proxy','--import','tsx','scripts/import-places.ts','--input',str(output),'--release',release,'--region',args.region,'--name',args.name,'--bounds',args.bounds]
if args.publish_seed:
    command.append('--publish-seed')
subprocess.run(command, check=True)
