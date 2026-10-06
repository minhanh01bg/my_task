#!/usr/bin/python3
"""Emit an integrity-checked, gzip-compressed online SQLite snapshot to stdout."""
import gzip
from pathlib import Path
import shutil
import sqlite3
import sys
import tempfile


def snapshot(source, output):
    if not source.is_file():
        raise ValueError('SQLite database does not exist')
    with tempfile.TemporaryDirectory(prefix='shop-snapshot-') as directory:
        path = Path(directory) / 'snapshot.db'
        live = sqlite3.connect(source.resolve().as_uri() + '?mode=ro', uri=True, timeout=30)
        copy = sqlite3.connect(path)
        try:
            live.backup(copy, pages=256)
            if copy.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                raise ValueError('SQLite integrity check failed')
        finally:
            copy.close()
            live.close()
        with path.open('rb') as input_file, gzip.GzipFile(fileobj=output, mode='wb') as archive:
            shutil.copyfileobj(input_file, archive)


if __name__ == '__main__':
    try:
        snapshot(Path(sys.argv[1]), sys.stdout.buffer)
    except Exception:
        print('Không tạo được snapshot SQLite.', file=sys.stderr)
        raise SystemExit(1)
