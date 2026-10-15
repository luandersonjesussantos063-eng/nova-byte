"""Adaptive VOD renditions in R2. The source MP4 is kept as a playback fallback."""
import hashlib
import json
import logging
import math
import shutil
import time
from pathlib import Path

LOG = logging.getLogger('nplay-importer')
PROFILES = [(240, 280, 400, 64), (480, 900, 1200, 80), (720, 1800, 2400, 96)]


def version_for(etag):
    return hashlib.sha256(etag.strip('"').encode()).hexdigest()[:16]


def missing_object(exc):
    return getattr(exc, 'response', {}).get('Error', {}).get('Code') in ('404', 'NoSuchKey', 'NotFound')


def has_object(r2, bucket, key):
    try:
        return r2.head_object(Bucket=bucket, Key=key)
    except Exception as exc:
        if missing_object(exc):
            return None
        raise


def profiles_for(height):
    chosen = [p for p in PROFILES if p[0] <= height]
    return chosen or [(max(2, int(height) // 2 * 2), 280, 400, 64)]


def build_adaptive(job, r2, bucket, source, key, meta, run_process, timeout):
    head = r2.head_object(Bucket=bucket, Key=key)
    version = version_for(head['ETag'])
    prefix = key + '.hls/' + version + '/'
    if has_object(r2, bucket, prefix + 'master.m3u8'):
        return prefix + 'master.m3u8'
    profiles = profiles_for(meta['height'])
    required = int(meta['duration_seconds'] * sum(p[2] + p[3] for p in profiles) * 1000 / 8 * 1.2) + 512 * 1024**2
    if shutil.disk_usage(job.folder).free < required:
        raise RuntimeError('Espaço insuficiente para preparar as qualidades adaptativas')
    target = job.folder / 'adaptive'
    target.mkdir(exist_ok=True)
    master = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-INDEPENDENT-SEGMENTS']
    for index, (height, rate, maximum, audio) in enumerate(profiles):
        job.check()
        folder = target / str(index)
        folder.mkdir(exist_ok=True)
        playlist = folder / 'index.m3u8'
        # Only a completed VOD playlist can be resumed; interrupted output is rebuilt.
        if not playlist.is_file() or '#EXT-X-ENDLIST' not in playlist.read_text():
            for old in folder.iterdir():
                old.unlink()
            command = ['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', str(source),
                       '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn',
                       '-vf', f'scale=-2:{height}', '-c:v', 'libx264', '-preset', 'veryfast',
                       '-threads', '2', '-crf', '24', '-maxrate', f'{maximum}k', '-bufsize', f'{maximum * 2}k',
                       '-pix_fmt', 'yuv420p', '-force_key_frames', 'expr:gte(t,n_forced*6)',
                       '-sc_threshold', '0', '-c:a', 'aac', '-b:a', f'{audio}k',
                       '-f', 'hls', '-hls_time', '6', '-hls_playlist_type', 'vod',
                       '-hls_flags', 'independent_segments+temp_file',
                       '-hls_segment_filename', str(folder / 'segment_%05d.ts'), str(playlist)]
            LOG.info('Import %s: preparing adaptive %sp', job.id, height)
            run_process(job, command, timeout, 'optimizing', meta['duration_seconds'])
        files = sorted(folder.glob('segment_*.ts'))
        if not files or '#EXT-X-ENDLIST' not in playlist.read_text():
            raise RuntimeError('Qualidade adaptativa incompleta')
        # Decode the beginning of each rendition before exposing its manifest.
        run_process(job, ['ffmpeg', '-nostdin', '-v', 'error', '-xerror', '-i', str(playlist),
                          '-t', '2', '-map', '0:v:0', '-map', '0:a?', '-f', 'null', '-'],
                    90, 'validating')
        for path in files + [playlist]:
            job.check()
            object_key = prefix + str(index) + '/' + path.name
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            existing = has_object(r2, bucket, object_key)
            if not existing or existing.get('ContentLength') != path.stat().st_size or existing.get('Metadata', {}).get('sha256') != digest:
                r2.upload_file(str(path), bucket, object_key, ExtraArgs={
                    'ContentType': 'application/vnd.apple.mpegurl' if path == playlist else 'video/mp2t',
                    'Metadata': {'sha256': digest}})
                verified = r2.head_object(Bucket=bucket, Key=object_key)
                if verified['ContentLength'] != path.stat().st_size or verified.get('Metadata', {}).get('sha256') != digest:
                    raise RuntimeError('Verificação do segmento adaptativo falhou')
        durations = [float(line.split(':', 1)[1].rstrip(',')) for line in playlist.read_text().splitlines() if line.startswith('#EXTINF:')]
        peak = max(path.stat().st_size * 8 / duration for path, duration in zip(files, durations) if duration > 0)
        bandwidth = max((maximum + audio) * 1000, math.ceil(peak * 1.1))
        average = math.ceil(sum(path.stat().st_size for path in files) * 8 / sum(durations))
        master.extend([f'#EXT-X-STREAM-INF:BANDWIDTH={bandwidth},AVERAGE-BANDWIDTH={average}', f'{index}/index.m3u8'])
    # Master is the commit marker: never expose partially uploaded renditions.
    body = ('\n'.join(master) + '\n').encode()
    digest = hashlib.sha256(body).hexdigest()
    r2.put_object(Bucket=bucket, Key=prefix + 'master.m3u8', Body=body,
                  ContentType='application/vnd.apple.mpegurl', Metadata={'sha256': digest})
    verified = r2.head_object(Bucket=bucket, Key=prefix + 'master.m3u8')
    if verified['ContentLength'] != len(body) or verified.get('Metadata', {}).get('sha256') != digest:
        raise RuntimeError('Verificação do manifesto adaptativo falhou')
    LOG.info('Import %s: adaptive streaming ready (%s renditions)', job.id, len(profiles))
    return prefix + 'master.m3u8'


class BackgroundJob:
    def __init__(self, folder, stop_file):
        self.folder, self.stop_file = folder, stop_file
        self.id = folder.name
        self.last_progress = 0

    def check(self):
        if self.stop_file.exists():
            raise InterruptedError('Parada solicitada; otimização preservada para retomar')

    def progress(self, stage, percent=0, **kwargs):
        if time.monotonic() - self.last_progress > 60:
            LOG.info('Adaptive %s: %s %s%%', self.id, stage, round(percent))
            self.last_progress = time.monotonic()


def optimize_existing_once(db, r2, bucket, root, stop_file, inspect_media, run_process, timeout, cooldown):
    rows = db.table('novaplay_library').select('import_job_id,r2_object_key,is_published,media_validated_at').eq('is_published', True).execute().data or []
    for row in rows:
        key = row.get('r2_object_key')
        if not key or not row.get('media_validated_at') or cooldown.get(key, 0) > time.monotonic():
            continue
        cooldown[key] = time.monotonic() + 3600
        try:
            head = r2.head_object(Bucket=bucket, Key=key)
            version = version_for(head['ETag'])
            if has_object(r2, bucket, key + '.hls/' + version + '/master.m3u8'):
                continue
            folder = Path(root).resolve() / 'adaptive-jobs' / hashlib.sha256((key + version).encode()).hexdigest()[:24]
            folder.mkdir(parents=True, exist_ok=True)
            if folder.is_symlink() or folder.resolve().parent != (Path(root).resolve() / 'adaptive-jobs'):
                raise RuntimeError('Pasta de otimização inválida')
            job = BackgroundJob(folder, stop_file)
            source = folder / 'source.mp4'
            if not source.is_file() or source.stat().st_size != head['ContentLength']:
                if shutil.disk_usage(folder).free < head['ContentLength'] + 1024**3:
                    raise RuntimeError('Espaço insuficiente para otimizar vídeo já publicado')
                LOG.info('Adaptive %s: retrieving published source for optimization', job.id)
                r2.download_file(bucket, key, str(source), Callback=lambda _: job.check())
            job.check()
            build_adaptive(job, r2, bucket, source, key, inspect_media(source), run_process, timeout)
            shutil.rmtree(folder)
            return True
        except InterruptedError:
            return False
        except Exception as exc:
            LOG.warning('Adaptive optimization deferred (%s); published MP4 preserved', type(exc).__name__)
    return False
