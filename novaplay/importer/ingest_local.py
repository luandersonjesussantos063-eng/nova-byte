"""NPlay: local authorized-video ingest. Converts when needed, uploads to private R2,
and creates a local review manifest. Does not publish a catalog item.
Usage: .venv\\Scripts\\python.exe ingest_local.py "C:\\Videos\\authorized.mkv"
"""
import argparse
import json
import mimetypes
import os
import pathlib
import subprocess
import tempfile
import uuid
from datetime import datetime, timezone
import boto3
from dotenv import load_dotenv

load_dotenv(pathlib.Path(__file__).with_name(".env"))
ALLOWED={".mp4",".mkv",".mov",".avi",".webm",".m4v",".ts"}
MAX_BYTES=int(os.getenv("IMPORTER_MAX_BYTES",str(8*1024**3)))
BUCKET=os.getenv("R2_BUCKET","nplay-filmes")

def cmd(*args):
    return subprocess.run(args,check=True,capture_output=True,text=True).stdout

def streams(path):
    data=json.loads(cmd("ffprobe","-v","error","-show_entries","stream=codec_type,codec_name","-of","json",str(path)))
    return data.get("streams",[])

def main():
    p=argparse.ArgumentParser(description="Enviar vídeo local autorizado para revisão NPlay")
    p.add_argument("source",help="Arquivo de vídeo local")
    p.add_argument("--title",help="Título para o rascunho")
    p.add_argument("--license-reference",required=True,help="Referência interna da autorização")
    p.add_argument("--confirm-rights",action="store_true",help="Confirma autorização para converter e armazenar este vídeo")
    a=p.parse_args()
    if not a.confirm_rights:
        p.error("É necessário confirmar os direitos com --confirm-rights")
    if len(a.license_reference.strip())<5:
        p.error("Informe uma referência de autorização com ao menos 5 caracteres")
    source=pathlib.Path(a.source).expanduser().resolve()
    if not source.is_file() or source.suffix.lower() not in ALLOWED:
        p.error("Arquivo local inexistente ou extensão incompatível")
    if source.stat().st_size>MAX_BYTES:
        p.error("Arquivo excede o limite configurado")
    s=streams(source)
    if not any(x.get("codec_type")=="video" for x in s):
        p.error("Vídeo não identificado")
    video=next(x for x in s if x.get("codec_type")=="video")
    audio=next((x for x in s if x.get("codec_type")=="audio"),None)
    compatible=source.suffix.lower()==".mp4" and video.get("codec_name")=="h264" and (audio is None or audio.get("codec_name")=="aac")
    account=os.environ["R2_ACCOUNT_ID"]
    r2=boto3.client("s3",endpoint_url=f"https://{account}.r2.cloudflarestorage.com",aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],region_name="auto")
    with tempfile.TemporaryDirectory(prefix="nplay-local-") as temp:
        output=source if compatible else pathlib.Path(temp)/"converted.mp4"
        if not compatible:
            print("Convertendo para MP4 H.264/AAC...",flush=True)
            subprocess.run(["ffmpeg","-hide_banner","-nostdin","-y","-i",str(source),"-map","0:v:0","-map","0:a:0?","-sn","-dn","-c:v","libx264","-preset","medium","-crf","22","-pix_fmt","yuv420p","-c:a","aac","-b:a","160k","-movflags","+faststart",str(output)],check=True)
        verified=streams(output)
        if not any(x.get("codec_type")=="video" and x.get("codec_name")=="h264" for x in verified):
            raise ValueError("MP4 final sem vídeo H.264 válido")
        if output.stat().st_size>MAX_BYTES:
            raise ValueError("MP4 convertido excedeu o limite")
        key=f"local-review/{uuid.uuid4()}.mp4"
        print("Enviando MP4 para armazenamento privado R2...",flush=True)
        r2.upload_file(str(output),BUCKET,key,ExtraArgs={"ContentType":"video/mp4"})
    draft={"title":a.title or source.stem,"source_filename":source.name,"license_reference":a.license_reference,"r2_bucket":BUCKET,"r2_object_key":key,"status":"awaiting_catalog_review","is_published":False,"created_at":datetime.now(timezone.utc).isoformat()}
    drafts=pathlib.Path(__file__).with_name("drafts")
    drafts.mkdir(exist_ok=True)
    manifest=drafts/(str(uuid.uuid4())+".json")
    manifest.write_text(json.dumps(draft,ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"Enviado ao R2. Rascunho local: {manifest}")
    print("NÃO publicado. Para exibir no painel será necessária integração adicional ao catálogo.")

if __name__=="__main__":
    main()
