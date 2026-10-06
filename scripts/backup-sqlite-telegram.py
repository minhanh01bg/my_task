#!/usr/bin/python3
"""Online SQLite snapshot, password encryption, and Telegram delivery."""
import argparse
from datetime import datetime, timezone
import fcntl
import gzip
import json
import os
from pathlib import Path
import secrets
import shutil
import sqlite3
import subprocess
import tempfile
import time
import urllib.request


class BackupError(Exception):
    pass


def read_env(path):
    values = {}
    if not path.exists():
        return values
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('export '):
            line = line[7:]
        key, separator, value = line.partition('=')
        if separator:
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in '\"\'':
                value = value[1:-1]
            values[key.strip()] = value
    return values


def database_path(root, url):
    if not url.startswith('file:'):
        raise BackupError('DATABASE_URL must reference SQLite (file:).')
    raw = url[5:].split('?', 1)[0]
    if not raw:
        raise BackupError('Empty database path.')
    path = Path(raw)
    return path if path.is_absolute() else (root / 'prisma' / path).resolve()


def create_backup(source, destination, password):
    if not source.is_file():
        raise BackupError('SQLite database does not exist.')
    if not password:
        raise BackupError('Backup encryption password is missing.')
    destination.mkdir(mode=0o700, parents=True, exist_ok=True)
    destination.chmod(0o700)
    name = datetime.now(timezone.utc).strftime('shop-backup-%Y%m%dT%H%M%SZ-') + secrets.token_hex(4) + '.sqlite3.gz.enc'
    target = destination / name
    try:
        with tempfile.TemporaryDirectory(prefix='shop-snapshot-') as temporary:
            snapshot = Path(temporary) / 'snapshot.db'
            source_db = sqlite3.connect(source.resolve().as_uri() + '?mode=ro', uri=True, timeout=30)
            output_db = sqlite3.connect(snapshot)
            try:
                source_db.backup(output_db, pages=256)
                if output_db.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                    raise BackupError('SQLite snapshot integrity check failed.')
            finally:
                output_db.close()
                source_db.close()
            compressed = Path(temporary) / 'snapshot.gz'
            with snapshot.open('rb') as input_file, gzip.open(compressed, 'wb') as output_file:
                shutil.copyfileobj(input_file, output_file)
            env = dict(os.environ, SHOP_BACKUP_PASSWORD=password)
            subprocess.run(['openssl', 'enc', '-aes-256-cbc', '-salt', '-pbkdf2', '-iter', '200000', '-md', 'sha256', '-pass', 'env:SHOP_BACKUP_PASSWORD', '-in', str(compressed), '-out', str(target)], env=env, check=True, capture_output=True, timeout=120)
            target.chmod(0o600)
        return target
    except Exception:
        target.unlink(missing_ok=True)
        raise


def send_document(path, token, chat_id):
    if path.stat().st_size > 49_000_000:
        raise BackupError('Encrypted backup exceeds Telegram upload limit; file retained locally.')
    boundary = 'BackupBoundary' + secrets.token_hex(16)
    body = bytearray()
    fields = {'chat_id': chat_id, 'caption': 'Sao lưu dữ liệu Tạp hóa Tuấn Toàn (SQLite, mã hóa bằng mật khẩu).'}
    for key, value in fields.items():
        body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
    body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="document"; filename="{path.name}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode())
    body.extend(path.read_bytes())
    body.extend(f'\r\n--{boundary}--\r\n'.encode())
    request = urllib.request.Request(f'https://api.telegram.org/bot{token}/sendDocument', data=bytes(body), headers={'Content-Type': f'multipart/form-data; boundary={boundary}'})
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            result = json.load(response)
        if result.get('ok') is not True or not result.get('result', {}).get('document'):
            raise BackupError('Telegram did not confirm document delivery; file retained locally.')
        return result['result']['message_id']
    except BackupError:
        raise
    except Exception:
        raise BackupError('Telegram upload failed; check bot/chat configuration or network. Encrypted file retained locally.') from None


def prune(destination):
    cutoff = time.time() - 7 * 86400
    for path in destination.glob('shop-backup-*.sqlite3.gz.enc'):
        marker = path.with_name(path.name + '.sent')
        if marker.is_file() and path.stat().st_mtime < cutoff:
            path.unlink()
            marker.unlink()


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument('--no-send', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    values = read_env(root / '.env')
    values.update(read_env(root / '.env.backup'))
    for key in ['DATABASE_URL', 'BACKUP_ENCRYPTION_PASSWORD', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']:
        if not values.get(key):
            raise BackupError(f'Missing {key} in backup configuration.')
    destination = Path.home() / '.local/state/my-task-backups'
    destination.mkdir(mode=0o700, parents=True, exist_ok=True)
    destination.chmod(0o700)
    with (destination / '.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise BackupError('Another backup is already running.') from None
        path = create_backup(database_path(root, values['DATABASE_URL']), destination, values['BACKUP_ENCRYPTION_PASSWORD'])
        print(f'Backup verified and encrypted: {path.name} ({path.stat().st_size} bytes)', flush=True)
        if not args.no_send:
            message_id = send_document(path, values['TELEGRAM_BOT_TOKEN'], values['TELEGRAM_CHAT_ID'])
            path.with_name(path.name + '.sent').touch(mode=0o600)
            prune(destination)
            print(f'Telegram delivery confirmed: message {message_id}', flush=True)


if __name__ == '__main__':
    try:
        main()
    except BackupError as error:
        print(f'Backup failed: {error}', flush=True)
        raise SystemExit(1)
    except Exception:
        print('Backup failed: snapshot/encryption error. Check database access and OpenSSL installation.', flush=True)
        raise SystemExit(1)
