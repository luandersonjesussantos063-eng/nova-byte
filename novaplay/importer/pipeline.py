"""Durable import stages. Importing this module does not connect or start work."""
from __future__ import annotations
import argparse
import hashlib
import json
import logging
import math
import os
from pathlib import Path, PurePosixPath, PureWindowsPath
import re
import shutil
import socket
import subprocess
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone

LOG = logging.getLogger('nplay-importer')
VIDEO_EXT = {'.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v', '.ts', '.ogv'}

class ReviewRequired(Exception):
    pass

class MetadataUnavailable(TimeoutError):
    pass

class CapacityRequired(ReviewRequired):
    pass

class LeaseLost(Exception):
    pass

class PermanentError(Exception):
    pass

def utc(seconds=0):
    return (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat()

def atomic_json(path, value):
    path = Path(path)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(temporary, path)

def safe_file(root, relative):
    posix, windows = PurePosixPath(relative), PureWindowsPath(relative)
    if posix.is_absolute() or windows.is_absolute() or windows.drive or '..' in posix.parts or '..' in windows.parts or ':' in relative:
        raise PermanentError('Caminho inseguro no torrent')
    result = (Path(root) / Path(*posix.parts)).resolve()
    if not result.is_relative_to(Path(root).resolve()):
        raise PermanentError('Caminho fora da pasta da importação')
    return result

def select_video(candidates, selected=None):
    if selected is not None:
        matches = [f for f in candidates if f['index'] == selected]
        if not matches:
            raise ReviewRequired('O arquivo selecionado não existe mais neste torrent')
        return matches[0]
    main = [f for f in candidates if not re.search(r'(?i)(?:^|[ /_.-])(sample|trailer|extras?)(?:[ /_.-]|$)', f['name'])]
    if len(main) == 1:
        return main[0]
    raise ReviewRequired('Escolha o arquivo correto. Há vários vídeos ou somente amostras neste torrent.')

def inspect_media(path):
    p = subprocess.run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=60)
    if p.returncode:
        raise PermanentError('Arquivo não reconhecido pelo FFprobe')
    info = json.loads(p.stdout)
    video = next((s for s in info.get('streams', []) if s.get('codec_type') == 'video' and not s.get('disposition', {}).get('attached_pic')), None)
    duration = float(info.get('format', {}).get('duration') or 0)
    if not video or not math.isfinite(duration) or duration <= 0:
        raise PermanentError('Arquivo sem vídeo ou duração válida')
    audio = [s.get('codec_name') for s in info.get('streams', []) if s.get('codec_type') == 'audio']
    return {'duration_seconds': duration, 'size_bytes': Path(path).stat().st_size, 'video_codec': video.get('codec_name'), 'audio_codecs': audio, 'pixel_format': video.get('pix_fmt'), 'width': video.get('width'), 'height': video.get('height'), 'mime_type': 'video/mp4'}

def browser_compatible(path, meta):
    return Path(path).suffix.lower() == '.mp4' and meta['video_codec'] == 'h264' and meta['pixel_format'] == 'yuv420p' and all(a == 'aac' for a in meta['audio_codecs'])

def classify(title, filename):
    episode = re.search(r'(?i)S(\d{1,3})[ ._-]*E(\d{1,4})', filename)
    if episode:
        series = re.split(r'(?i)\bS\d+E\d+|\d+\s*[ªa]?\s*temporada|\bseason\s*\d+', title)[0].strip(' .-_')
        return {'kind':'episode','series_title':series or title,'season_number':int(episode[1]),'episode_number':int(episode[2])}
    if re.search(r'(?i)temporada|complete[ ._-]*season|\bseason\b', title + ' ' + filename):
        raise ReviewRequired('O conteúdo parece uma temporada. Identifique um episódio com nome S01E01 antes de continuar.')
    return {'kind':'movie'}

class Job:
    def __init__(self, db, record, root):
        self.db, self.record = db, record
        self.id, self.token = record['id'], record['lock_token']
        self.folder = Path(root)/self.id
        self.folder.mkdir(parents=True, exist_ok=True)
        self.manifest_path = self.folder/'manifest.json'
        self.manifest = json.loads(self.manifest_path.read_text(encoding='utf-8')) if self.manifest_path.exists() else {}
        self.stop, self.lost = threading.Event(), threading.Event()
        self.last_progress = 0.0
        self.thread = None
        self.stage = None
        self.stage_started = time.monotonic()

    def check(self):
        if self.lost.is_set():
            raise LeaseLost('Reserva perdida; a tarefa foi interrompida para evitar duplicação')

    def update(self, **fields):
        self.check()
        rows = self.db.table('novaplay_magnet_imports').update(fields).eq('id',self.id).eq('lock_token',self.token).eq('status','processing').execute().data
        if not rows:
            self.lost.set()
            raise LeaseLost('Reserva não encontrada')

    def progress(self, stage, percent=0, force=False, **diagnostics):
        self.check()
        if self.stage != stage:
            self.stage, self.stage_started = stage, time.monotonic()
            force = True
        if force or time.monotonic()-self.last_progress >= 10:
            diagnostics.update(stage=stage,elapsed_seconds=int(time.monotonic()-self.stage_started))
            self.update(stage=stage, diagnostics=diagnostics, progress_percent=max(0,min(100,percent)),heartbeat_at=utc(),locked_until=utc(300))
            self.last_progress=time.monotonic()

    def checkpoint(self, **fields):
        self.manifest.update(fields)
        atomic_json(self.manifest_path,self.manifest)

    def heartbeat(self):
        last_success=time.monotonic()
        while not self.stop.wait(20):
            try:
                self.update(heartbeat_at=utc(),locked_until=utc(300))
                last_success=time.monotonic()
            except LeaseLost:return
            except Exception:
                LOG.warning('Heartbeat connection interrupted for %s; retrying',self.id)
                if time.monotonic()-last_success>=90:
                    self.lost.set()
                    LOG.error('Heartbeat unavailable for 90 seconds for %s; stopping this job',self.id)
                    return

    def __enter__(self):
        self.thread=threading.Thread(target=self.heartbeat,daemon=True)
        self.thread.start()
        return self

    def __exit__(self,*args):
        self.stop.set()
        self.thread.join(timeout=25)

def download(job,max_bytes,timeout):
    import libtorrent as lt
    source=job.manifest.get('downloaded')
    if source and job.manifest.get('selected_index')==job.record.get('selected_file_index') and safe_file(job.folder,source).is_file():return safe_file(job.folder,source)
    job.progress('metadata',force=True)
    torrent_path=job.folder/'source.torrent'
    params=lt.parse_magnet_uri(job.record['magnet_uri'])
    if torrent_path.exists():params.ti=lt.torrent_info(str(torrent_path))
    params.save_path=str(job.folder/'download')
    params.flags |= lt.torrent_flags.upload_mode
    params.flags &= ~lt.torrent_flags.auto_managed
    params.flags &= ~lt.torrent_flags.paused
    session=lt.session({'listen_interfaces':'0.0.0.0:0','enable_dht':True,'enable_lsd':False,'enable_upnp':False,'enable_natpmp':False})
    handle=session.add_torrent(params)
    started=time.monotonic()
    try:
        while not handle.has_metadata():
            job.check()
            state=handle.status()
            job.progress('metadata',peers=state.num_peers,seeds=state.num_seeds,download_rate=state.download_rate,timeout_seconds=min(timeout,600),message='Aguardando a lista de arquivos da fonte; o download do vídeo ainda não começou.')
            if time.monotonic()-started>min(timeout,600):raise MetadataUnavailable('A fonte não respondeu com os metadados. O magnet pode estar sem participantes disponíveis ou inacessível nesta rede.')
            time.sleep(2)
        info=handle.torrent_file()
        torrent_path.write_bytes(lt.bencode(lt.create_torrent(info).generate()))
        files=info.files()
        candidates=[]
        for i in range(files.num_files()):
            name=files.file_path(i)
            safe_file(job.folder/'download',name)
            if Path(name).suffix.lower() in VIDEO_EXT:
                candidates.append({'index':i,'name':name,'bytes':files.file_size(i)})
        if not candidates:raise PermanentError('Torrent sem arquivo de vídeo reconhecido')
        job.update(file_candidates=candidates)
        chosen=select_video(candidates,job.record.get('selected_file_index'))
        if chosen['bytes']>max_bytes:raise CapacityRequired(f"Este vídeo tem {chosen['bytes']/1024**3:.1f} GiB; o limite desta instalação é {max_bytes/1024**3:g} GiB. Use uma versão menor ou revise a capacidade do processador.")
        source=safe_file(job.folder/'download',chosen['name'])
        # libtorrent rechecks existing pieces, so partial data survives restarts.
        available=source.stat().st_size if source.exists() else 0
        if shutil.disk_usage(job.folder).free < max(0,chosen['bytes']-available)+chosen['bytes']*2+2*1024**3:
            raise CapacityRequired('Espaço insuficiente para baixar e preparar este vídeo mantendo os originais. Libere espaço ou escolha uma versão menor; atualizar a lista não resolve esta condição.')
        handle.prioritize_files([7 if i==chosen['index'] else 0 for i in range(files.num_files())])
        handle.unset_flags(lt.torrent_flags.upload_mode)
        job.progress('downloading',force=True)
        last_bytes=-1;last_advance=time.monotonic()
        while True:
            job.check();state=handle.status()
            if state.errc.value():raise RuntimeError(state.errc.message())
            done=handle.file_progress()[chosen['index']]
            if done>last_bytes:last_bytes=done;last_advance=time.monotonic()
            elif time.monotonic()-last_advance>180:raise TimeoutError('Download sem receber dados por 3 minutos; reconexão automática com reaproveitamento das partes')
            job.progress('downloading',done/max(1,chosen['bytes'])*100,peers=state.num_peers,seeds=state.num_seeds,download_rate=state.download_rate,bytes_done=done,bytes_total=chosen['bytes'])
            if done>=chosen['bytes']:break
            if time.monotonic()-started>timeout:raise TimeoutError('Tempo de download excedido; partes serão reaproveitadas')
            time.sleep(3)
        handle.pause();handle.flush_cache()
        if not source.is_file() or source.stat().st_size!=chosen['bytes']:raise RuntimeError('Arquivo baixado com tamanho inesperado')
        job.checkpoint(downloaded=str(source.relative_to(job.folder)),selected_name=chosen['name'],selected_index=job.record.get('selected_file_index'))
        return source
    finally:
        session.pause()
        session.remove_torrent(handle)

def run_process(job,command,timeout,stage,duration=None):
    progress_file=job.folder/(stage+'-progress.txt')
    stderr_file=job.folder/(stage+'-error.log')
    if duration:command=command[:-1]+['-progress',str(progress_file)]+command[-1:]
    with stderr_file.open('w',encoding='utf-8') as errors:
        proc=subprocess.Popen(command,stdout=subprocess.DEVNULL,stderr=errors)
        start=time.monotonic()
        try:
            while proc.poll() is None:
                job.check()
                if time.monotonic()-start>timeout:raise TimeoutError('Tempo máximo da preparação excedido')
                percent=0
                if duration and progress_file.exists():
                    matches=re.findall(r'out_time_us=(\d+)',progress_file.read_text(errors='ignore'))
                    if matches:percent=int(matches[-1])/1e6/duration*100
                job.progress(stage,percent)
                time.sleep(2)
            if proc.returncode:raise PermanentError('Falha ao decodificar/preparar o vídeo; confira o log local da tarefa')
        finally:
            if proc.poll() is None:
                proc.terminate()
                try:proc.wait(timeout=10)
                except subprocess.TimeoutExpired:proc.kill();proc.wait()

def prepare(job,source,max_bytes,timeout):
    job.progress('inspecting',force=True)
    meta=inspect_media(source)
    if meta['size_bytes']>max_bytes:raise CapacityRequired('Arquivo excede o limite configurado. Escolha uma versão menor ou revise a capacidade do processador.')
    fingerprint={'path':str(source.resolve()),'size':source.stat().st_size,'mtime_ns':source.stat().st_mtime_ns}
    output=source
    if not browser_compatible(source,meta):
        output=job.folder/'prepared.mp4'
        ready=job.manifest.get('prepared')
        if not (ready and output.is_file() and job.manifest.get('source_fingerprint')==fingerprint):
            if shutil.disk_usage(job.folder).free < max(meta['size_bytes']*2,1024**3):raise CapacityRequired('Espaço insuficiente para converter sem perder o original. Libere espaço antes de retomar.')
            partial=job.folder/'prepared.partial.mp4'
            command=['ffmpeg','-nostdin','-y','-i',str(source),'-map','0:v:0','-map','0:a?','-sn','-dn','-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',str(partial)]
            job.progress('converting',force=True)
            run_process(job,command,timeout,'converting',meta['duration_seconds'])
            os.replace(partial,output)
            job.checkpoint(prepared=True,source_fingerprint=fingerprint)
        meta=inspect_media(output)
    if not browser_compatible(output,meta):raise PermanentError('Saída incompatível com o player')
    if meta['size_bytes']>max_bytes:raise CapacityRequired('Vídeo preparado maior que o limite. Escolha uma versão menor ou revise a capacidade.')
    job.progress('validating',force=True)
    # Decode beginning, middle and end; distinguish this from a full-file integrity scan.
    for point in sorted({0,meta['duration_seconds']/2,max(0,meta['duration_seconds']-3)}):
        run_process(job,['ffmpeg','-nostdin','-v','error','-xerror','-ss',str(point),'-i',str(output),'-t','2','-map','0:v:0','-map','0:a?','-f','null','-'],90,'validating')
    meta['validated']=True
    meta['validation_method']='ffprobe+decode_begin_middle_end+R2_size_sha256'
    return output,meta

def sha256_file(job,path):
    digest=hashlib.sha256()
    with Path(path).open('rb') as src:
        for block in iter(lambda:src.read(4*1024**2),b''):
            job.check();digest.update(block)
    return digest.hexdigest()

def transport_error(exc):
    from botocore.exceptions import ConnectionClosedError, EndpointConnectionError, ReadTimeoutError, ConnectTimeoutError
    return isinstance(exc,(ConnectionError,TimeoutError,ConnectionClosedError,EndpointConnectionError,ReadTimeoutError,ConnectTimeoutError))

def upload_part_with_retry(job,r2,**kwargs):
    for attempt in range(3):
        job.check()
        try:return r2.upload_part(**kwargs)
        except Exception as exc:
            if not transport_error(exc) or attempt==2:raise
            LOG.warning('Upload connection interrupted for %s; retrying same part',job.id)
            time.sleep(2**(attempt+1))

def upload_resumable(job,r2,bucket,path):
    size=Path(path).stat().st_size
    digest=sha256_file(job,path)
    key=f"{job.record['created_by']}/{job.id}-import-{job.id}.mp4"
    job.checkpoint(object_key=key,sha256=digest)
    def confirmed():
        try:h=r2.head_object(Bucket=bucket,Key=key)
        except Exception as exc:
            if getattr(exc,'response',{}).get('Error',{}).get('Code') in ('404','NoSuchKey','NotFound'):return False
            raise
        return h['ContentLength']==size and h.get('Metadata',{}).get('sha256')==digest
    if confirmed():return key
    upload=job.manifest.get('multipart',{})
    if upload and upload.get('sha256')!=digest:
        r2.abort_multipart_upload(Bucket=bucket,Key=key,UploadId=upload['id']);upload={}
    parts=[]
    if upload:
        try:
            paginator=r2.get_paginator('list_parts')
            for page in paginator.paginate(Bucket=bucket,Key=key,UploadId=upload['id']):parts.extend(page.get('Parts',[]))
        except Exception as exc:
            if getattr(exc,'response',{}).get('Error',{}).get('Code')!='NoSuchUpload':raise
            if confirmed():return key
            upload={}
    if not upload:
        response=r2.create_multipart_upload(Bucket=bucket,Key=key,ContentType='video/mp4',Metadata={'sha256':digest,'import-id':job.id})
        upload={'id':response['UploadId'],'sha256':digest,'part_size':32*1024**2}
        job.checkpoint(multipart=upload)
    known={p['PartNumber']:p for p in parts};completed=[];done=0
    upload_started=time.monotonic();sent=0
    job.progress('uploading',force=True,bytes_done=0,bytes_total=size)
    with Path(path).open('rb') as src:
        number=1
        while data:=src.read(upload['part_size']):
            job.check();part=known.get(number)
            if not part or part['Size']!=len(data):
                part=upload_part_with_retry(job,r2,Bucket=bucket,Key=key,UploadId=upload['id'],PartNumber=number,Body=data)
                sent+=len(data)
            completed.append({'PartNumber':number,'ETag':part['ETag']})
            done+=len(data);number+=1;job.progress('uploading',done/size*100,force=True,bytes_done=done,bytes_total=size,upload_rate=int(sent/max(1,time.monotonic()-upload_started)))
    job.check()
    try:r2.complete_multipart_upload(Bucket=bucket,Key=key,UploadId=upload['id'],MultipartUpload={'Parts':completed})
    except Exception as exc:
        # A dropped response can mean the object was successfully committed.
        if not transport_error(exc) or not confirmed():raise
    if not confirmed():raise RuntimeError('Verificação do objeto enviado falhou')
    job.checkpoint(upload_complete=True)
    return key

def process(job,r2,bucket,max_bytes,timeout,recovery,local_file=None):
    preserved=Path(recovery)/(job.id+'.mp4')
    if local_file:
        source=Path(local_file).resolve()
    elif preserved.is_file():
        source=preserved
    else:source=download(job,max_bytes,timeout)
    kind=classify(job.record['title'],job.manifest.get('selected_name',source.name))
    output,meta=prepare(job,source,max_bytes,timeout)
    meta.update(kind)
    try:
        poster=job.folder/'poster.jpg'
        run_process(job,['ffmpeg','-nostdin','-v','error','-y','-ss',str(min(30,meta['duration_seconds']/3)),'-i',str(output),'-frames:v','1','-vf','scale=640:-2','-q:v','3',str(poster)],60,'inspecting')
        poster_key=f"{job.record['created_by']}/{job.id}.jpg"
        job.db.storage.from_('novaplay-posters').upload(poster_key,poster.read_bytes(),file_options={'content-type':'image/jpeg','upsert':'true'})
        meta['poster_path']=poster_key
    except LeaseLost:raise
    except Exception:LOG.warning('Automatic cover unavailable for %s; draft will need a cover',job.id)
    key=upload_resumable(job,r2,bucket,output)
    job.progress('validating',100,force=True)
    # The DB trigger creates the draft transactionally; if it fails, retry reuses the object.
    job.update(status='ready',stage='complete',progress_percent=100,r2_object_key=key,media_metadata=meta,error_message=None,error_code=None,locked_until=None)
    job.checkpoint(complete=True,completed_at=utc(),metadata=meta)
    LOG.info('Import %s ready; draft created/updated',job.id)

def transient_error(exc):
    import httpx
    if transport_error(exc) or isinstance(exc,httpx.TransportError):return True
    status=getattr(getattr(exc,'response',None),'status_code',0)
    response=getattr(exc,'response',{})
    if isinstance(response,dict):status=response.get('ResponseMetadata',{}).get('HTTPStatusCode',0)
    return status==429 or isinstance(status,int) and 500<=status<600

def retry_delay(attempts):
    return min(900,60*2**min(max(0,attempts),4))

def failure_state(exc, attempts):
    if isinstance(exc,CapacityRequired):return 'needs_review','capacity',False
    if isinstance(exc,ReviewRequired):return 'needs_review','selection',False
    if isinstance(exc,MetadataUnavailable):return 'queued','retry_wait',True
    if isinstance(exc,PermanentError):return 'failed','failed',False
    if transient_error(exc):return 'queued','retry_wait',True
    if attempts<3:return 'queued','retry_wait',True
    return 'failed','failed',False

def handle_job(db,r2,record,root,recovery,bucket,max_bytes,timeout,local_file=None):
    with Job(db,record,root) as job:
        try:process(job,r2,bucket,max_bytes,timeout,recovery,local_file)
        except LeaseLost:LOG.warning('Import %s stopped after loss of lease',job.id)
        except Exception as exc:
            status,stage,retry=failure_state(exc,record['attempts'])
            review=status=='needs_review';permanent=isinstance(exc,PermanentError)
            # Do not log secrets, raw SDK responses, signed URLs or magnets.
            message=str(exc) if review or permanent or isinstance(exc,TimeoutError) else 'Falha temporária de conexão/processamento; os arquivos foram preservados'
            LOG.error('Import %s: %s (%s)',job.id,message,type(exc).__name__)
            if not job.lost.is_set():
                delay=3600 if isinstance(exc,MetadataUnavailable) and record['attempts']>=3 else retry_delay(record['attempts'])
                job.update(status=status,stage=stage,error_message=message[:500],error_code=type(exc).__name__,next_retry_at=utc(delay) if retry else None,locked_until=None)

def main():
    from dotenv import load_dotenv
    from supabase import create_client
    import boto3
    from botocore.config import Config
    base=Path(__file__).resolve().parent
    load_dotenv(base/'.env')
    parser=argparse.ArgumentParser(description='NPlay importer v2: resumable stages and leased queue')
    parser.add_argument('--once',action='store_true')
    parser.add_argument('--job-id')
    parser.add_argument('--local-file',help='Authorized local test/recovery file; requires --job-id')
    args=parser.parse_args()
    if args.local_file and not args.job_id:parser.error('--local-file requires --job-id')
    logging.basicConfig(level=logging.INFO,format='%(asctime)s %(levelname)s %(message)s')
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('httpcore').setLevel(logging.WARNING)
    db=create_client(os.environ['SUPABASE_URL'],os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    r2=boto3.client('s3',endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],region_name='auto',config=Config(retries={'max_attempts':5,'mode':'adaptive'},connect_timeout=20,read_timeout=90,tcp_keepalive=True))
    worker=f'{socket.gethostname()}-{os.getpid()}-{uuid.uuid4().hex[:8]}'
    root=Path(os.getenv('IMPORTER_WORK_DIR',str(base/'jobs')))
    recovery=Path(os.getenv('IMPORTER_RECOVERY_DIR',str(base/'recovery')))
    max_bytes=int(os.getenv('IMPORTER_MAX_BYTES',str(16*1024**3)))
    timeout=int(os.getenv('IMPORTER_TIMEOUT_SECONDS','7200'))
    while not (base/'importer.stop').exists():
        try:
            jobs=db.rpc('novaplay_claim_import',{'p_worker_id':worker,'p_job_id':args.job_id}).execute().data or []
            if jobs:handle_job(db,r2,jobs[0],root,recovery,os.getenv('R2_BUCKET','nplay-filmes'),max_bytes,timeout,args.local_file)
            elif not args.once:time.sleep(15)
        except Exception as exc:
            LOG.error('Queue unavailable (%s)',type(exc).__name__)
            if args.once:raise
            time.sleep(30)
        if args.once:break

if __name__=='__main__':main()
