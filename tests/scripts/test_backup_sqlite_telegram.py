import gzip
import importlib.util
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import io

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/backup-sqlite-telegram.py'
spec = importlib.util.spec_from_file_location('backup', SCRIPT)
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupTests(unittest.TestCase):
    def test_wal_snapshot_and_encryption_roundtrip(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'live.db'
            connection = sqlite3.connect(source)
            connection.execute('PRAGMA journal_mode=WAL')
            connection.execute('CREATE TABLE orders (amount INTEGER)')
            connection.execute('INSERT INTO orders VALUES (120000)')
            connection.commit()
            encrypted = backup.create_backup(source, root / 'backups', 'test-password')
            self.assertEqual(encrypted.stat().st_mode & 0o777, 0o600)
            env = dict(os.environ, BACKUP_TEST_PASSWORD='test-password')
            result = subprocess.run(['openssl', 'enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', '200000', '-md', 'sha256', '-pass', 'env:BACKUP_TEST_PASSWORD', '-in', str(encrypted)], env=env, capture_output=True, check=True)
            restored = root / 'restored.db'
            restored.write_bytes(gzip.decompress(result.stdout))
            with sqlite3.connect(restored) as db:
                self.assertEqual(db.execute('SELECT amount FROM orders').fetchone()[0], 120000)
                self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
            connection.close()
            self.assertEqual(list((root / 'backups').glob('*.db')), [])

    def test_encryption_failure_cleans_plaintext_and_partial_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'live.db'
            with sqlite3.connect(source) as connection:
                connection.execute('CREATE TABLE sensitive (value TEXT)')
            temporary_paths = []
            real_temporary_directory = tempfile.TemporaryDirectory
            def record_temporary(*args, **kwargs):
                context = real_temporary_directory(*args, **kwargs)
                temporary_paths.append(Path(context.name))
                return context
            with patch.object(backup.tempfile, 'TemporaryDirectory', side_effect=record_temporary), patch.object(backup.subprocess, 'run', side_effect=subprocess.CalledProcessError(1, 'openssl')):
                with self.assertRaises(subprocess.CalledProcessError):
                    backup.create_backup(source, root / 'backups', 'password')
            self.assertTrue(temporary_paths)
            self.assertTrue(all(not path.exists() for path in temporary_paths))
            self.assertTrue(all(path.parent != root / 'backups' for path in temporary_paths))
            self.assertEqual(list((root / 'backups').iterdir()), [])

    def test_missing_database_does_not_create_empty_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaises(backup.BackupError):
                backup.create_backup(root / 'missing.db', root / 'backups', 'password')

    def test_relative_prisma_database_path(self):
        self.assertEqual(backup.database_path(Path('/project'), 'file:./dev.db'), Path('/project/prisma/dev.db'))
        with self.assertRaises(backup.BackupError):
            backup.database_path(Path('/project'), 'mongodb://invalid')

    def test_env_password_keeps_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / '.env'
            path.write_text('PASSWORD="hello#world"\nTOKEN=abc\n')
            self.assertEqual(backup.read_env(path)['PASSWORD'], 'hello#world')

    def test_telegram_confirmation_and_sanitized_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'backup.enc'
            path.write_bytes(b'encrypted-data')
            with patch.object(backup.urllib.request, 'urlopen', return_value=io.BytesIO(b'{"ok":true,"result":{"document":{},"message_id":42}}')):
                with self.assertRaises(backup.BackupError):
                    backup.send_document(path, 'SECRET', '123')
            with patch.object(backup.urllib.request, 'urlopen', return_value=io.BytesIO(b'{"ok":true,"result":{"document":{"file_id":"abc"},"message_id":42}}')) as request:
                self.assertEqual(backup.send_document(path, 'SECRET', '123'), 42)
                self.assertIn(b'encrypted-data', request.call_args.args[0].data)
            with patch.object(backup.urllib.request, 'urlopen', side_effect=RuntimeError('https://api.telegram.org/botSECRET')):
                with self.assertRaises(backup.BackupError) as error:
                    backup.send_document(path, 'SECRET', '123')
                self.assertNotIn('SECRET', str(error.exception))
                self.assertTrue(path.exists())

    def test_prune_only_confirmed_sent_backups(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ['shop-backup-old.sqlite3.gz.enc', 'shop-backup-unsent.sqlite3.gz.enc', 'unrelated.enc']:
                path = root / name
                path.write_bytes(b'data')
                os.utime(path, (1, 1))
            (root / 'shop-backup-old.sqlite3.gz.enc.sent').touch()
            backup.prune(root)
            self.assertFalse((root / 'shop-backup-old.sqlite3.gz.enc').exists())
            self.assertTrue((root / 'shop-backup-unsent.sqlite3.gz.enc').exists())
            self.assertTrue((root / 'unrelated.enc').exists())


if __name__ == '__main__':
    unittest.main()
