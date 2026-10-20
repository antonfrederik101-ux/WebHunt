"""Offline tests for safe importer diagnostics and existing TLS trust settings."""
import importlib.util
from pathlib import Path
import socket
import ssl
import tempfile
import unittest
from urllib.error import HTTPError, URLError

spec = importlib.util.spec_from_file_location('import_network', Path(__file__).resolve().parents[2] / 'scripts/import_network.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class NetworkDiagnostics(unittest.TestCase):
    def test_proxy_connect_403_is_not_reported_as_upstream_http(self):
        diagnostic = module.safe_network_diagnosis(URLError(OSError('Tunnel connection failed: 403 Forbidden')))
        self.assertIn('Proxyen', diagnostic)
        self.assertIn('CONNECT (HTTP 403)', diagnostic)

    def test_http_response_and_tls_are_distinguished(self):
        response = HTTPError('https://example.com/private?token=DO_NOT_PRINT', 403, 'Forbidden', {}, None)
        self.assertIn('efter forbindelsen', module.safe_network_diagnosis(response))
        self.assertIn('TLS', module.safe_network_diagnosis(ssl.SSLCertVerificationError('certificate verify failed')))
        self.assertIn('TLS', module.safe_network_diagnosis(OSError('curlCode: 60 SSL certificate problem')))

    def test_wrapped_errors_keep_safe_stage_and_hide_credentials(self):
        cause = URLError(OSError('Tunnel connection failed: 403 Forbidden https://user:DO_NOT_PRINT@proxy'))
        outer = RuntimeError('Raw library failure https://user:DO_NOT_PRINT@proxy')
        outer.__cause__ = cause
        message = str(module.fail_stage('STAC-katalog', outer))
        self.assertIn('STAC-katalog', message)
        self.assertIn('CONNECT', message)
        self.assertNotIn('DO_NOT_PRINT', message)
        self.assertNotIn('https://', message)

    def test_aws_http_dns_and_timeout_have_separate_diagnoses(self):
        self.assertIn('HTTP 503', module.safe_network_diagnosis(OSError('HTTP response code: 503')))
        self.assertIn('DNS', module.safe_network_diagnosis(socket.gaierror('Could not resolve host')))
        self.assertIn('tidsgrænsen', module.safe_network_diagnosis(TimeoutError('timed out')))

    def test_existing_proxy_and_ca_file_are_passed_to_arrow(self):
        with tempfile.NamedTemporaryFile() as certificate:
            config = module.s3_connection_options({'HTTPS_PROXY': 'https://user:secret@proxy:443', 'SSL_CERT_FILE': certificate.name})
            self.assertEqual(config['tls_ca_file_path'], certificate.name)
            self.assertEqual(config['proxy_options'], 'https://user:secret@proxy:443')
            self.assertNotIn('tls_verify', config)
            fallback = module.s3_connection_options({'REQUESTS_CA_BUNDLE': certificate.name})
            self.assertEqual(fallback['tls_ca_file_path'], certificate.name)

    def test_missing_configured_trust_bundle_stops_safely(self):
        with self.assertRaises(module.ImportNetworkError) as raised:
            module.s3_connection_options({'SSL_CERT_FILE': '/definitely/not/a/CA-file/secret-name'})
        self.assertNotIn('secret-name', str(raised.exception))
        self.assertIn('TLS-kontrollen er bevaret', str(raised.exception))
        self.assertEqual(module.s3_connection_options({}), {})


if __name__ == '__main__':
    unittest.main()
