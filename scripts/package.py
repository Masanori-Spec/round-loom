"""Deterministic local deliverable; no network or publication."""
import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
out = root.parent / 'round-loom-output'
out.mkdir(exist_ok=True)
roots = ['.github', 'docs', 'fixtures', 'scripts', 'src', 'web', 'tests', 'dist']
files = [root / x for x in ['README.md', 'SECURITY.md', 'THIRD_PARTY_NOTICES.md', 'package.json', 'package-lock.json', '.gitignore']]
for name in roots:
    files.extend(p for p in (root / name).rglob('*') if p.is_file() and 'artifacts' not in p.parts and '__pycache__' not in p.parts)
files = sorted(set(files), key=lambda p: p.relative_to(root).as_posix())
entries = [{'path': p.relative_to(root).as_posix(), 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
manifest = {'project': 'round-loom', 'version': '0.1.0', 'algorithm': 'SHA-256', 'fileCount': len(entries), 'files': entries}
manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
(out / 'source-manifest.json').write_bytes(manifest_bytes)
archive = out / 'round-loom.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for path, content in [(e['path'], p.read_bytes()) for e, p in zip(entries, files)] + [('MANIFEST.json', manifest_bytes)]:
        info = zipfile.ZipInfo('round-loom/' + path, date_time=(2026, 10, 3, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        z.writestr(info, content)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for e in entries:
        data = z.read('round-loom/' + e['path'])
        assert hashlib.sha256(data).hexdigest() == e['sha256']
result = {'archive': archive.name, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'bytes': archive.stat().st_size, 'verifiedFiles': len(entries)}
(out / 'archive-verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
