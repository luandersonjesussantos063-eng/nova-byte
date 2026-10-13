"""Private NPlay magnet importer. Run only on a controlled backend server."""
import os, time, uuid, pathlib, tempfile, logging
import boto3
from dotenv import load_dotenv
load_dotenv()
import libtorrent as lt
from supabase import create_client

logging.basicConfig(level=logging.INFO)
log=logging.getLogger("nplay-importer")
URL=os.environ["SUPABASE_URL"]
DB=create_client(URL,os.environ["SUPABASE_SERVICE_ROLE_KEY"])
ACCOUNT=os.environ["R2_ACCOUNT_ID"]
R2=boto3.client("s3",endpoint_url=f"https://{ACCOUNT}.r2.cloudflarestorage.com",aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],region_name="auto")
BUCKET=os.getenv("R2_BUCKET","nplay-filmes")
MAX_BYTES=int(os.getenv("IMPORTER_MAX_BYTES",str(8*1024**3)))
TIMEOUT=int(os.getenv("IMPORTER_TIMEOUT_SECONDS","7200"))
VIDEO_EXT={".mp4",".webm",".ogv"}
KNOWN_VIDEO_EXT=VIDEO_EXT|{".mkv",".avi",".mov",".m4v",".ts"}

def update(job_id,**fields):
    DB.table("novaplay_magnet_imports").update(fields).eq("id",job_id).execute()

def run(job):
    jid=job["id"]
    if not job.get("rights_confirmed") or not job.get("approved_for_processing") or not job.get("license_reference"):
        return
    magnet=job["magnet_uri"]
    if not magnet.startswith("magnet:?xt=urn:btih:"):
        update(jid,status="failed",error_message="Magnet inválido")
        return
    update(jid,status="processing",error_message=None)
    session=None
    try:
        with tempfile.TemporaryDirectory(prefix="nplay-") as tmp:
            session=lt.session({"listen_interfaces":"0.0.0.0:0","enable_dht":True,"enable_lsd":False,"enable_upnp":False,"enable_natpmp":False})
            handle=lt.add_magnet_uri(session,magnet,{"save_path":tmp})
            started=time.monotonic()
            while not handle.has_metadata():
                if time.monotonic()-started>min(TIMEOUT,600):
                    raise TimeoutError("Metadados do torrent não disponíveis")
                time.sleep(2)
            info=handle.get_torrent_info()
            files=info.files()
            log.info("Job %s: metadados recebidos; %d arquivos no torrent",jid,files.num_files())
            candidates=[]
            for i in range(files.num_files()):
                relative=pathlib.PurePosixPath(files.file_path(i))
                if relative.is_absolute() or ".." in relative.parts:
                    raise ValueError("Caminho inseguro no torrent")
                size=files.file_size(i)
                if pathlib.Path(relative.name).suffix.lower() in VIDEO_EXT:
                    candidates.append((i,size,relative))
            if not candidates:
                details=[]
                for i in range(min(files.num_files(),20)):
                    name=pathlib.PurePosixPath(files.file_path(i)).name
                    ext=pathlib.Path(name).suffix.lower() or "(sem extensão)"
                    details.append(f"{name[:90]} [{ext}]")
                log.warning("Job %s: nenhum formato aceito; arquivos encontrados: %s",jid,"; ".join(details) or "(nenhum)")
                detected={pathlib.Path(files.file_path(i)).suffix.lower() for i in range(files.num_files())}
                other=sorted(detected & (KNOWN_VIDEO_EXT-VIDEO_EXT))
                if other:
                    raise ValueError("Torrent contém vídeo em formato não aceito: "+", ".join(other)+". Formatos aceitos: "+", ".join(sorted(VIDEO_EXT)))
                raise ValueError("Torrent sem arquivo de vídeo compatível; consulte o log para ver os arquivos encontrados")
            idx,size,relative=max(candidates,key=lambda x:x[1])
            if size>MAX_BYTES:
                raise ValueError("Vídeo maior que limite permitido")
            for i in range(files.num_files()):
                handle.file_priority(i,7 if i==idx else 0)
            while True:
                state=handle.status()
                if state.is_seeding or state.progress>=1.0:
                    break
                if time.monotonic()-started>TIMEOUT:
                    raise TimeoutError("Tempo máximo de download excedido")
                time.sleep(3)
            source=(pathlib.Path(tmp)/pathlib.Path(*relative.parts)).resolve()
            if not source.is_relative_to(pathlib.Path(tmp).resolve()) or not source.is_file():
                raise ValueError("Arquivo não encontrado")
            if source.stat().st_size>MAX_BYTES:
                raise ValueError("Arquivo excedeu o limite")
            key=f"{job['created_by']}/{uuid.uuid4()}-import-{uuid.uuid4()}{source.suffix.lower()}"
            R2.upload_file(str(source),BUCKET,key,ExtraArgs={"ContentType":{".mp4":"video/mp4",".webm":"video/webm",".ogv":"video/ogg"}[source.suffix.lower()]})
            update(jid,status="ready",r2_object_key=key,error_message=None)
            log.info("Job %s uploaded to R2; remains unpublished",jid)
    except Exception as exc:
        log.exception("Job %s failed",jid)
        update(jid,status="failed",error_message=str(exc)[:500])
    finally:
        if session:
            try: session.pause()
            except Exception: pass

def main():
    log.info("NPlay magnet processor started")
    while True:
        try:
            jobs=DB.table("novaplay_magnet_imports").select("*").eq("status","pending_processor").eq("approved_for_processing",True).order("created_at").limit(1).execute().data or []
            if jobs: run(jobs[0])
            else: time.sleep(15)
        except Exception:
            log.exception("Polling error")
            time.sleep(30)

if __name__=="__main__": main()
