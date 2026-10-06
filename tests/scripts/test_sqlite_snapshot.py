import gzip
import importlib.util
import io
from pathlib import Path
import sqlite3
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/sqlite-snapshot.py'
spec = importlib.util.spec_from_file_location('snapshot', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SnapshotTests(unittest.TestCase):
    def test_reads_committed_wal_and_restores_integrity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'live.db'
            connection = sqlite3.connect(source)
            connection.execute('PRAGMA journal_mode=WAL')
            connection.execute('CREATE TABLE orders (amount INTEGER)')
            connection.execute('INSERT INTO orders VALUES (120000)')
            connection.commit()
            self.assertTrue(Path(str(source) + '-wal').exists())
            compressed = io.BytesIO()
            module.snapshot(source, compressed)
            restored = root / 'restored.db'
            restored.write_bytes(gzip.decompress(compressed.getvalue()))
            with sqlite3.connect(restored) as db:
                self.assertEqual(db.execute('SELECT amount FROM orders').fetchone()[0], 120000)
                self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
            self.assertEqual(connection.execute('SELECT amount FROM orders').fetchone()[0], 120000)
            connection.close()

    def test_missing_database_emits_no_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            output = io.BytesIO()
            with self.assertRaises(ValueError):
                module.snapshot(Path(directory) / 'missing.db', output)
            self.assertEqual(output.getvalue(), b'')


if __name__ == '__main__':
    unittest.main()
