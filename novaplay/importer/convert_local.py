"""Converte um vídeo local autorizado para MP4 compatível com navegadores.

Uso: python convert_local.py "C:\\Videos\\meu-video.mkv"
Requer ffmpeg e ffprobe instalados no PATH. Não baixa torrents nem publica vídeos.
"""
import argparse
import json
import pathlib
import shutil
import subprocess
import sys

EXTENSIONS = {".mkv", ".mp4", ".mov", ".avi", ".webm", ".m4v", ".ts"}
MAX_BYTES = 8 * 1024**3

def execute(args):
    return subprocess.run(args, check=True, capture_output=True, text=True)

def probe(path):
    result = execute(["ffprobe", "-v", "error", "-show_entries",
                      "stream=codec_type,codec_name", "-of", "json", str(path)])
    return json.loads(result.stdout).get("streams", [])

def main():
    parser = argparse.ArgumentParser(description="Preparar vídeo local autorizado para NPlay")
    parser.add_argument("source", help="Arquivo de vídeo local")
    parser.add_argument("--output", help="Destino MP4 (opcional)")
    args = parser.parse_args()
    source = pathlib.Path(args.source).expanduser().resolve()
    if not source.is_file() or source.suffix.lower() not in EXTENSIONS:
        parser.error("Informe um arquivo de vídeo local válido")
    if source.stat().st_size > MAX_BYTES:
        parser.error("Arquivo maior que o limite de 8 GiB")
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        parser.error("Instale FFmpeg (ffmpeg e ffprobe) e adicione ao PATH")
    destination = pathlib.Path(args.output).expanduser().resolve() if args.output else source.with_name(source.stem + "-nplay.mp4")
    if destination == source or destination.exists() or destination.suffix.lower() != ".mp4":
        parser.error("Destino precisa ser um novo arquivo .mp4 que ainda não exista")
    streams = probe(source)
    if not any(s.get("codec_type") == "video" for s in streams):
        parser.error("O arquivo não contém vídeo identificável")
    print("Convertendo para H.264/AAC em MP4 (pode demorar)...", flush=True)
    temporary = destination.with_name(destination.stem + ".partial.mp4")
    if temporary.exists():
        parser.error("Arquivo temporário existente; remova-o manualmente após conferir")
    try:
        command = ["ffmpeg", "-hide_banner", "-nostdin", "-n", "-i", str(source),
                   "-map", "0:v:0", "-map", "0:a:0?", "-sn", "-dn",
                   "-c:v", "libx264", "-preset", "medium", "-crf", "22",
                   "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
                   "-movflags", "+faststart", str(temporary)]
        subprocess.run(command, check=True)
        if not any(s.get("codec_type") == "video" and s.get("codec_name") == "h264" for s in probe(temporary)):
            raise RuntimeError("A conversão não gerou vídeo H.264 válido")
        if temporary.stat().st_size > MAX_BYTES:
            raise RuntimeError("Arquivo convertido excedeu o limite de 8 GiB")
        temporary.replace(destination)
        print(f"Concluído: {destination}")
        print("Arquivo preparado localmente; não enviado ou publicado.")
    except Exception:
        print(f"Falha na conversão. Verifique: {temporary}", file=sys.stderr)
        raise

if __name__ == "__main__":
    main()
