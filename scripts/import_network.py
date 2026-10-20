"""Safe import networking diagnostics. Never print exception text or proxy URLs."""
from __future__ import annotations

import os
import re
import socket
import ssl
from pathlib import Path
from typing import Mapping
from urllib.error import HTTPError, URLError


class ImportNetworkError(Exception):
    """Contains only a safe, user-facing diagnostic, never raw network errors."""


def _causes(error: BaseException):
    """Walk wrapped urllib/AWS errors without exposing their arbitrary strings."""
    seen = set()
    current: BaseException | None = error
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        yield current
        reason = getattr(current, "reason", None)
        current = reason if isinstance(reason, BaseException) else (
            current.__cause__ or current.__context__
        )


def safe_network_diagnosis(error: BaseException) -> str:
    errors = list(_causes(error))
    # Raw strings are inspected only; they are never included in the returned text.
    combined = " ".join(str(item) for item in errors).lower()
    proxy_status = re.search(r"(?:tunnel connection failed|connect tunnel failed|proxy connect[^:]*):?\s*(\d{3})", combined)
    if proxy_status:
        status = proxy_status.group(1)
        return f"Proxyen afviste HTTPS CONNECT (HTTP {status}), før datakilden kunne nås."
    if any(isinstance(item, ssl.SSLError) for item in errors) or any(
        marker in combined for marker in (
            "certificate verify failed", "ssl certificate", "tls handshake",
            "curlcode: 60", "curlcode: 51", "ssl connect error", "curlcode: 35",
        )
    ):
        return "TLS-certifikat eller TLS-forbindelse kunne ikke verificeres. TLS-kontrollen er bevaret."
    for item in errors:
        if isinstance(item, HTTPError):
            return f"HTTPS-anmodningen modtog HTTP {item.code} efter forbindelsen var oprettet."
    # AWS/PyArrow normally returns status numbers inside an OSError, not HTTPError.
    aws_status = re.search(r"(?:http(?: response)?(?: status)?(?: code)?|responsecode|statuscode|status)\s*[:=]?\s*(\d{3})\b", combined)
    if aws_status:
        return f"S3-anmodningen modtog HTTP {aws_status.group(1)}."
    if any(isinstance(item, (TimeoutError, socket.timeout)) for item in errors) or any(
        marker in combined for marker in ("timed out", "timeout", "curlcode: 28")
    ):
        return "Netværksanmodningen overskred tidsgrænsen."
    if any(isinstance(item, socket.gaierror) for item in errors) or any(
        marker in combined for marker in ("name or service not known", "could not resolve", "curlcode: 6")
    ):
        return "Værtsnavnet kunne ikke slås op i DNS."
    if any(isinstance(item, (ConnectionError, URLError)) for item in errors):
        return "Netværksforbindelsen kunne ikke oprettes."
    return "Data kunne ikke læses; kontrollér forbindelsen og datakildens svarformat."


def fail_stage(stage: str, error: BaseException) -> ImportNetworkError:
    return ImportNetworkError(
        f"Importtrin {stage}: {safe_network_diagnosis(error)} Eksisterende virksomhedsdata er bevaret."
    )


def s3_connection_options(environment: Mapping[str, str] | None = None) -> dict[str, str]:
    """Reuse supported proxy/trust settings; never disable TLS certificate checks."""
    environment = os.environ if environment is None else environment
    result = {}
    proxy = environment.get("HTTPS_PROXY") or environment.get("https_proxy")
    if proxy:
        result["proxy_options"] = proxy
    bundle = environment.get("SSL_CERT_FILE") or environment.get("REQUESTS_CA_BUNDLE")
    if bundle:
        if not Path(bundle).is_file():
            raise ImportNetworkError(
                "Importtrin S3/læsning: Miljøets betroede CA-fil er ikke tilgængelig. "
                "TLS-kontrollen er bevaret, og eksisterende virksomhedsdata er bevaret."
            )
        result["tls_ca_file_path"] = bundle
    return result
