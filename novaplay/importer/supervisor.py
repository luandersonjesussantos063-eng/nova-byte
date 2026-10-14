"""One supervisor per install, rotating logs, automatic restart, graceful stop file."""
from pathlib import Path
import logging
from logging.handlers import RotatingFileHandler
import os
import subprocess
import sys
import time

def main():
    base=Path(__file__).resolve().parent
    lock=(base/'supervisor.lock').open('a+b')
    lock.seek(0);lock.write(b'0');lock.flush();lock.seek(0)
    try:
        if os.name=='nt':
            import msvcrt
            msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
        else:
            import fcntl
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except (OSError,BlockingIOError):return
    logs=base/'logs';logs.mkdir(exist_ok=True)
    logger=logging.getLogger('supervisor');logger.setLevel(logging.INFO)
    handler=RotatingFileHandler(logs/'supervisor.log',maxBytes=2*1024**2,backupCount=3,encoding='utf-8')
    logger.addHandler(handler)
    while not (base/'importer.stop').exists():
        logger.info('Starting importer at %s',time.strftime('%Y-%m-%d %H:%M:%S'))
        output=logs/'worker.log'
        if output.exists() and output.stat().st_size>10*1024**2:os.replace(output,logs/'worker.previous.log')
        with output.open('a',encoding='utf-8') as log:
            proc=subprocess.Popen([sys.executable,'-u',str(base/'worker.py')],cwd=base,stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
            proc.wait()
        logger.info('Worker exited: %s',proc.returncode)
        if not (base/'importer.stop').exists():time.sleep(30)

if __name__=='__main__':main()
