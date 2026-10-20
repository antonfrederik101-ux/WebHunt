# Overture connection diagnosis — 2026-10-20

No domains were added during this investigation. The existing saved allowlist was
read, tested, saved unchanged, and read back successfully.

## Observations

- STAC catalog, S3 bucket, regional S3 bucket, Azure mirror and Overture documentation
  all fail in this running Codex instance with HTTP **403 on HTTPS CONNECT**.
- Curl identifies the rejecting server as `envoy`. The failure occurs before TLS
  with the destination; it is not an Overture API response, API-key error, parsed
  dataset problem or a certificate failure.
- A control request to the already configured Nominatim `/status.php` returns 200.
  The running proxy and trusted TLS therefore work for at least one destination.
- Python and Node both fail for STAC. Upper/lowercase proxy settings agree, and
  granting execution-layer network access did not change the CONNECT result.
- The configuration backend confirms `status: saved` and `requires_publish: true`.
  Reading it back returns the same domains and base version as before. This proves
  draft persistence; it does not prove runtime policy activation or publication.
- No publication-status/runtime-policy tool is exposed in this session. The exact
  backend reason for the browser's “Kunne ikke gemme ændringer” cannot be retrieved
  from the available tools. Repeatedly adding domains cannot fix this observation.
- A second delivery issue existed: GitHub `main` still used the old Overpass route;
  the persistent catalog/importer existed only on the feature branch. The catalog
  changes and diagnostic fixes are now prepared for delivery on `main` together.

## Repairs

The importer distinguishes STAC catalog, STAC index and S3 failures, gives urllib
explicit timeouts, and passes the existing trusted CA file to PyArrow's separate
TLS implementation. TLS verification and the configured proxy are retained. These
fixes address later TLS/timeout failures; they cannot authorize a CONNECT denied
by the platform. Unknown source licenses remain blocked; no fake records are seeded.

Reproduce the read-only test with:

```bash
python3 scripts/check-overture-network.py
```

For the user's existing Codespace, after obtaining the updated code:

```bash
bash scripts/import-pilot.sh
```

This tests its own STAC connection first, prepares the isolated import tools, fetches
only Nykøbing Falster from the official source, imports into the user's own SQLite
file, and verifies actual records there. It makes no environment-setting changes,
never contacts Overpass, never disables TLS, and never modifies `.env.local`.
A successful run on another machine is not proof this Codex instance's policy is
fixed. No real Nykøbing Falster records have been retrieved in this Codex instance.

The previous Node-only container image also did not guarantee `python3-venv`.
Future containers install it explicitly; the pilot helper can install the missing
Debian Python packages in an existing Codespace when its terminal has root or
noninteractive sudo. It does not claim successful import for a Supabase-backed
app when only the local SQLite database has been populated.
