"""Probe existing Overture destinations without changing proxy/network settings."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import os
import ssl
import time
from urllib.request import urlopen

from import_network import safe_network_diagnosis

TARGETS = [
    ('STAC-katalog', 'https://stac.overturemaps.org/catalog.json'),
    ('S3', 'https://overturemaps-us-west-2.s3.amazonaws.com/?list-type=2&max-keys=1&prefix=release/'),
    ('S3-regional', 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/?list-type=2&max-keys=1&prefix=release/'),
    ('Dokumentation', 'https://docs.overturemaps.org/guides/places/'),
    ('Azure', 'https://overturemapswestus2.blob.core.windows.net/release?restype=container&comp=list&maxresults=1'),
]


def check(target):
    name, url = target
    started = time.monotonic()
    result = {'target': name, 'url': url}
    try:
        bundle = os.environ.get('SSL_CERT_FILE') or os.environ.get('REQUESTS_CA_BUNDLE')
        context = ssl.create_default_context(cafile=bundle) if bundle else ssl.create_default_context()
        with urlopen(url, context=context, timeout=20) as response:
            # Bounded read: no global listings or datasets are downloaded by this probe.
            body = response.read(512 * 1024)
            result.update(ok=True, status=response.status)
            if name == 'STAC-katalog':
                catalog = json.loads(body)
                if not isinstance(catalog.get('latest'), str):
                    raise ValueError('Invalid STAC catalog')
                result['latest'] = catalog['latest']
    except Exception as error:
        result.update(ok=False, diagnostic=safe_network_diagnosis(error))
    result['seconds'] = round(time.monotonic() - started, 3)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--required', action='store_true', help='Test only the catalog needed by the importer')
    args = parser.parse_args()
    targets = TARGETS[:1] if args.required else TARGETS
    with ThreadPoolExecutor(max_workers=len(targets)) as pool:
        results = list(pool.map(check, targets))
    for result in results:
        print(json.dumps(result, ensure_ascii=False), flush=True)
    return 0 if all(result['ok'] for result in results) else 1


if __name__ == '__main__':
    raise SystemExit(main())
