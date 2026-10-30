#!/usr/bin/python3 -I
"""Root-owned, no-argument deployment gate. Never execute workflow-supplied code."""
import fcntl
import gzip
import hashlib
import io
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile
import tempfile
from datetime import datetime, timezone

CONFIG = Path('/etc/my-daily-hub-deploy')
STATE = Path('/var/lib/my-daily-hub-deploy')
BACKUPS = Path('/var/backups/my-daily-hub')
IMAGE = 'my-daily-hub-web:local'
ENV = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'HOME': '/root', 'LANG': 'C.UTF-8'}
MAX_ARCHIVE = 32 * 1024 * 1024
MAX_FILES = 5000
MAX_TOTAL = 128 * 1024 * 1024


def unpack(stream, destination):
    """Accept bounded regular static files, with no links, devices or traversal."""
    compressed = stream.read(MAX_ARCHIVE + 1)
    if len(compressed) > MAX_ARCHIVE:
        raise ValueError('Website archive exceeds 32 MiB')
    total = count = 0
    seen = set()
    with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as zipped:
        expanded = zipped.read(MAX_TOTAL + 16 * 1024 * 1024 + 1)
    if len(expanded) > MAX_TOTAL + 16 * 1024 * 1024:
        raise ValueError('Expanded archive exceeds its limit')
    with tarfile.open(fileobj=io.BytesIO(expanded), mode='r:') as archive:
        for member in archive:
            count += 1
            if count > MAX_FILES:
                raise ValueError('Too many archive entries')
            path = PurePosixPath(member.name)
            if path.is_absolute() or '..' in path.parts or not re.fullmatch(r'[A-Za-z0-9_./-]+', member.name):
                raise ValueError('Invalid archive path')
            if member.isdir():
                continue
            if not member.isfile() or path == PurePosixPath('.') or str(path) in seen:
                raise ValueError('Only unique regular files are accepted')
            total += member.size
            if member.size < 0 or total > MAX_TOTAL:
                raise ValueError('Website exceeds 128 MiB')
            seen.add(str(path))
            target = destination.joinpath(*path.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            source = archive.extractfile(member)
            with target.open('xb') as output:
                while data := source.read(1024 * 1024):
                    output.write(data)
            target.chmod(0o644)
    if not (destination / 'index.html').is_file():
        raise ValueError('Missing index.html')
    for folder in destination.rglob('*'):
        if folder.is_dir():
            folder.chmod(0o755)
    revision = (destination / 'deployment-revision.txt').read_text().strip()
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('Missing or invalid deployment revision')
    return revision


def docker(*arguments, **kwargs):
    return subprocess.run(['/usr/bin/docker', *arguments], check=True, env=ENV,
                          cwd=CONFIG, timeout=600, **kwargs)


def activate():
    docker('compose', '--project-directory', str(CONFIG), '-f', str(CONFIG / 'web.yml'),
           'up', '-d', '--no-deps', '--pull', 'never', '--wait', '--wait-timeout', '90', 'web')


def publish(candidate, previous):
    docker('tag', previous, 'my-daily-hub-web:previous')
    docker('tag', candidate, IMAGE)
    try:
        activate()
    except Exception:
        print('Health check failed; restoring previous website image.', flush=True)
        docker('tag', previous, IMAGE)
        activate()
        raise


def main():
    if os.geteuid() != 0 or len(sys.argv) != 1:
        raise RuntimeError('Run the installed helper via its exact sudo rule, without arguments')
    os.umask(0o077)
    with (STATE / 'lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with tempfile.TemporaryDirectory(prefix='release-', dir=STATE) as directory:
            context = Path(directory)
            dist = context / 'dist'
            dist.mkdir(mode=0o755)
            revision = unpack(sys.stdin.buffer, dist)
            base = (CONFIG / 'base-image').read_text().strip()
            if not re.fullmatch(r'sha256:[0-9a-f]{64}', base):
                raise ValueError('Invalid installed base image')
            previous = docker('inspect', '--format', '{{.Image}}', 'my-daily-hub-web-1',
                              capture_output=True, text=True).stdout.strip()
            if not re.fullmatch(r'sha256:[0-9a-f]{64}', previous):
                raise ValueError('Cannot identify current website image')
            # The Dockerfile, base image and runtime settings are administrator-controlled.
            (context / 'Dockerfile').write_text(
                f'FROM {base}\nCOPY dist/ /usr/share/nginx/html/\n'
                f'LABEL org.opencontainers.image.revision="{revision}"\n')
            candidate = 'my-daily-hub-web:candidate'
            docker('build', '--network=none', '--pull=false', '-t', candidate, str(context))
            stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
            backup = BACKUPS / f'dailyhub-{stamp}.dump'
            partial = backup.with_suffix('.partial')
            try:
                with partial.open('xb') as output:
                    docker('exec', 'my-daily-hub-db-1', 'pg_dump', '-U', 'dailyhub', '-d', 'dailyhub', '-Fc', stdout=output)
                if partial.stat().st_size == 0:
                    raise RuntimeError('Empty database backup')
                partial.rename(backup)
                with backup.open('rb') as saved:
                    digest = hashlib.file_digest(saved, 'sha256').hexdigest()
                backup.with_suffix('.dump.sha256').write_text(f'{digest}  {backup.name}\n')
            finally:
                partial.unlink(missing_ok=True)
            # Keep a stable rollback tag; never remove or restore database volumes.
            publish(candidate, previous)
            (STATE / 'last-success').write_text(f'{revision}\n{stamp}\n')
            print(f'Deployed website revision {revision}; database backup {backup.name}', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Deployment failed: {error}', file=sys.stderr)
        sys.exit(1)
