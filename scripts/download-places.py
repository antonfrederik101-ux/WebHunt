"""Bounded official Overture Places download; no UI request contacts this source.
Use the repository venv: .data/import-venv/bin/python scripts/download-places.py.
"""
import argparse
import contextlib
import io
import json
import re
from pathlib import Path
import subprocess
import ssl
from urllib.request import urlopen

from import_network import ImportNetworkError, fail_stage, s3_connection_options

PILOT = [11.83, 54.735, 11.93, 54.81]


def main():
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
    if not re.fullmatch(r'[a-z0-9-]{1,60}', args.region):
        raise SystemExit('Invalid region identifier')

    from overturemaps import core
    import pyarrow.fs as fs
    # urllib uses the existing SSL_CERT_FILE. Give AWS/PyArrow the same trust file
    # explicitly; its separate TLS implementation does not reliably inherit it.
    original_s3 = fs.S3FileSystem
    connection_options = s3_connection_options()

    def configured_s3(*a, **kw):
        kw.update(connection_options)
        return original_s3(*a, **kw)

    core.fs.S3FileSystem = configured_s3
    trust_file = connection_options.get("tls_ca_file_path")
    ssl_context = ssl.create_default_context(cafile=trust_file) if trust_file else ssl.create_default_context()
    last_http_error = None

    def timed_urlopen(*a, **kw):
        nonlocal last_http_error
        kw.setdefault('timeout', 20)
        kw.setdefault('context', ssl_context)
        try:
            return urlopen(*a, **kw)
        except Exception as error:
            last_http_error = error
            raise

    core.urlopen = timed_urlopen
    print('Importtrin: STAC-katalog', flush=True)
    try:
        release = args.release or core.get_latest_release()
    except Exception as error:
        raise fail_stage('STAC-katalog', error) from None
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}\.\d+', release):
        raise SystemExit('Invalid official release identifier; existing data preserved.')
    print(f'Overture-udgivelse: {release}', flush=True)

    folder = Path('.data/imports')
    folder.mkdir(parents=True, exist_ok=True)
    output = folder / f'{args.region}-{release}.geojson'
    print('Importtrin: STAC-indeks', flush=True)
    last_http_error = None
    # The official helper catches errors and prints arbitrary exception text.
    # Capture it and return only our safe diagnosis; never log proxy credentials.
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        files = core._get_files_from_stac('places', 'place', core._coerce_bbox(bounds), release)
    if files is None:
        raise fail_stage('STAC-indeks', last_http_error or ValueError('Invalid STAC index')) from None
    if not files:
        raise SystemExit('Ingen Overture-filer dækker området. Eksisterende virksomhedsdata er bevaret.')
    # Retain the validated bounded index. No fallback to a worldwide file scan.
    core._get_files_from_stac = lambda *a, **kw: files
    print(f'Geografisk indeks: {len(files)} fil(er)', flush=True)

    from shapely import from_wkb, to_geojson
    print('Importtrin: S3/læsning', flush=True)
    try:
        reader_stdout, reader_stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(reader_stdout), contextlib.redirect_stderr(reader_stderr):
            reader = core.record_batch_reader('place', bbox=bounds, release=release, stac=True, connect_timeout=20, request_timeout=60)
        if reader is None:
            # The helper may swallow an AWS error. Inspect its captured text only
            # for safe categories; never echo it or any embedded proxy identity.
            raise OSError(reader_stdout.getvalue() + reader_stderr.getvalue())
        features = []
        for batch in reader:
            for row in batch.to_pylist():
                geometry = json.loads(to_geojson(from_wkb(row.pop('geometry'))))
                row.pop('bbox', None)
                features.append({'type': 'Feature', 'id': row.get('id'), 'geometry': geometry, 'properties': row})
    except Exception as error:
        raise fail_stage('S3/læsning', error) from None
    if not features:
        raise SystemExit('Tomt kildesvar. Eksisterende virksomhedsdata er bevaret.')
    print(f'Hentede stedposter: {len(features)}', flush=True)
    # Atomic raw snapshot; database changes happen only after the complete read.
    temporary = output.with_suffix('.tmp')
    temporary.write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, default=lambda v: v.isoformat() if hasattr(v, 'isoformat') else str(v)), encoding='utf-8')
    temporary.replace(output)
    command = ['node', '--use-env-proxy', '--import', 'tsx', 'scripts/import-places.ts', '--input', str(output), '--release', release, '--region', args.region, '--name', args.name, '--bounds', args.bounds]
    if args.publish_seed:
        command.append('--publish-seed')
    subprocess.run(command, check=True)


if __name__ == '__main__':
    try:
        main()
    except ImportNetworkError as error:
        raise SystemExit(str(error)) from None
    except subprocess.CalledProcessError as error:
        print('Kildeudtrækket er bevaret i .data/imports. Det kan genimporteres med node scripts/reimport-pilot.mjs efter en rettelse.', flush=True)
        raise SystemExit(error.returncode or 1) from None
