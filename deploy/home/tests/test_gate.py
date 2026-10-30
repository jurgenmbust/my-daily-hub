import importlib.util
import io
import os
from pathlib import Path
import sys
import tarfile
import tempfile
import types
import unittest
from unittest.mock import patch, call

# Archive and rollback tests also run on a Windows development machine.
if os.name == 'nt':
    sys.modules.setdefault('fcntl', types.SimpleNamespace())
spec = importlib.util.spec_from_file_location('gate', Path(__file__).resolve().parents[1] / 'deploy-web.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def archive(extra=(), defaults=True):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w:gz') as tar:
        files = [('index.html', b'<html>Hola</html>'),
                 ('deployment-revision.txt', b'a' * 40),
                 ('assets/app.js', b'console.log("ok")')] if defaults else []
        for name, data in files:
            item = tarfile.TarInfo('./' + name)
            item.size = len(data)
            tar.addfile(item, io.BytesIO(data))
        for item in extra:
            tar.addfile(item)
    output.seek(0)
    return output


class GateTests(unittest.TestCase):
    def test_regular_assets_and_revision(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.assertEqual(gate.unpack(archive(), root), 'a' * 40)
            self.assertIn('Hola', (root / 'index.html').read_text())
            self.assertTrue((root / 'assets/app.js').is_file())
            if os.name != 'nt':
                self.assertEqual((root / 'assets').stat().st_mode & 0o777, 0o755)

    def test_reject_traversal_absolute_links_and_devices(self):
        for name, kind in [('../outside', tarfile.REGTYPE), ('/etc/passwd', tarfile.REGTYPE),
                           ('link', tarfile.SYMTYPE), ('hard', tarfile.LNKTYPE),
                           ('device', tarfile.CHRTYPE), ('pipe', tarfile.FIFOTYPE)]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as folder:
                item = tarfile.TarInfo(name)
                item.type = kind
                item.linkname = '/etc/passwd'
                with self.assertRaises(ValueError):
                    gate.unpack(archive([item]), Path(folder))

    def test_reject_duplicates_missing_index_and_oversized_files(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                gate.unpack(archive([tarfile.TarInfo('index.html')]), Path(folder))
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                gate.unpack(archive(defaults=False), Path(folder))
        with tempfile.TemporaryDirectory() as folder, patch.object(gate, 'MAX_TOTAL', 4):
            with self.assertRaises(ValueError):
                gate.unpack(archive(), Path(folder))

    def test_health_failure_restores_previous_image_and_reports_failure(self):
        failure = RuntimeError('Unhealthy')
        with patch.object(gate, 'docker') as docker, patch.object(gate, 'activate', side_effect=[failure, None]) as activate:
            with self.assertRaises(RuntimeError):
                gate.publish('candidate', 'previous')
            self.assertEqual(activate.call_count, 2)
            self.assertEqual(docker.call_args_list[-1], call('tag', 'previous', gate.IMAGE))

    def test_success_does_not_rollback(self):
        with patch.object(gate, 'docker') as docker, patch.object(gate, 'activate') as activate:
            gate.publish('candidate', 'previous')
            activate.assert_called_once()
            self.assertEqual(docker.call_args_list, [call('tag', 'previous', 'my-daily-hub-web:previous'),
                                                    call('tag', 'candidate', gate.IMAGE)])


if __name__ == '__main__':
    unittest.main()
