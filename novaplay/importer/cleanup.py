"""Remove managed local files only after publication and verified remote storage."""
import json
import logging
import os
from pathlib import Path
import re
import shutil
from datetime import datetime, timezone
import uuid

LOG = logging.getLogger('nplay-importer')


def cleanup_published_imports(db, r2, bucket, root, recovery):
    root, recovery = Path(root).resolve(), Path(recovery).resolve()
    cleaned = 0
    if not root.is_dir():
        return cleaned
    for folder in root.iterdir():
        try:
            # Never follow a job-directory link or a path supplied by a manifest.
            if str(uuid.UUID(folder.name)) != folder.name:
                continue
            if folder.is_symlink() or not folder.is_dir() or folder.resolve() != folder:
                continue
            manifest_path = folder / 'manifest.json'
            if manifest_path.is_symlink() or not manifest_path.is_file():
                continue
            manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
            if not manifest.get('complete') or manifest.get('local_cleanup_at'):
                continue
            key, digest = manifest.get('object_key'), manifest.get('sha256', '')
            size = manifest.get('metadata', {}).get('size_bytes', 0)
            if not key or not re.fullmatch('[0-9a-f]{64}', digest) or not isinstance(size, int) or size <= 0:
                continue
            jobs = db.table('novaplay_magnet_imports').select('status,r2_object_key').eq('id', folder.name).execute().data or []
            if len(jobs) != 1 or jobs[0]['status'] != 'ready' or jobs[0]['r2_object_key'] != key:
                continue
            entries = db.table('novaplay_library').select('is_published,r2_object_key,media_validated_at').eq('import_job_id', folder.name).execute().data or []
            if len(entries) != 1:
                continue
            entry = entries[0]
            if not entry['is_published'] or entry['r2_object_key'] != key or not entry['media_validated_at']:
                continue
            remote = r2.head_object(Bucket=bucket, Key=key)
            if remote.get('ContentLength') != size or remote.get('Metadata', {}).get('sha256') != digest:
                continue
            # Preserve the small receipt. Only job-owned downloads/output are removed.
            for child in folder.iterdir():
                if child.name == 'manifest.json':
                    continue
                if child.is_symlink() or not child.is_dir():
                    child.unlink()
                else:
                    shutil.rmtree(child)
            preserved = recovery / (folder.name + '.mp4')
            if preserved.is_file() or preserved.is_symlink():
                preserved.unlink()
            manifest['local_cleanup_at'] = datetime.now(timezone.utc).isoformat()
            temporary = folder / 'manifest.tmp'
            temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
            os.replace(temporary, manifest_path)
            cleaned += 1
            LOG.info('Import %s: local files removed after publication and R2 verification', folder.name)
        except ValueError:
            continue
        except Exception as exc:
            # Network/permission failures preserve remaining files and retry next pass.
            LOG.warning('Local cleanup deferred for %s (%s)', folder.name, type(exc).__name__)
    return cleaned
