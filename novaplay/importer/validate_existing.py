"""Validate existing ready imports without downloading the whole object or publishing."""
import json,os,subprocess
from pathlib import Path
import boto3
from dotenv import load_dotenv
from supabase import create_client
load_dotenv(Path(__file__).with_name('.env'))
db=create_client(os.environ['SUPABASE_URL'],os.environ['SUPABASE_SERVICE_ROLE_KEY'])
r2=boto3.client('s3',endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],region_name='auto')
results=[]
for row in db.table('novaplay_magnet_imports').select('id,r2_object_key,media_metadata,duplicate_of').eq('status','ready').execute().data:
    if row['duplicate_of'] or row['media_metadata'].get('validated') or not row['r2_object_key']:continue
    try:
        key=row['r2_object_key'];bucket=os.getenv('R2_BUCKET','nplay-filmes')
        head=r2.head_object(Bucket=bucket,Key=key)
        url=r2.generate_presigned_url('get_object',Params={'Bucket':bucket,'Key':key},ExpiresIn=1800)
        probe=subprocess.run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',url],capture_output=True,text=True,timeout=120)
        if probe.returncode:raise ValueError('ffprobe_failed')
        data=json.loads(probe.stdout);streams=data.get('streams',[])
        video=next(s for s in streams if s.get('codec_type')=='video' and not s.get('disposition',{}).get('attached_pic'))
        duration=float(data['format']['duration']);audio=[s.get('codec_name') for s in streams if s.get('codec_type')=='audio']
        if duration<=0 or video.get('codec_name')!='h264' or video.get('pix_fmt')!='yuv420p' or any(a!='aac' for a in audio):raise ValueError('incompatible_media')
        for point in sorted({0,duration/2,max(0,duration-3)}):
            decoded=subprocess.run(['ffmpeg','-nostdin','-v','error','-xerror','-ss',str(point),'-i',url,'-t','2','-map','0:v:0','-map','0:a?','-f','null','-'],capture_output=True,timeout=120)
            if decoded.returncode:raise ValueError('decode_failed')
        meta={**row['media_metadata'],'validated':True,'duration_seconds':duration,'size_bytes':head['ContentLength'],'mime_type':'video/mp4','video_codec':video['codec_name'],'audio_codecs':audio,'pixel_format':video['pix_fmt'],'validation_method':'remote_ffprobe+decode_begin_middle_end+R2_head'}
        db.table('novaplay_magnet_imports').update({'media_metadata':meta}).eq('id',row['id']).eq('status','ready').execute()
        result={'id':row['id'],'validated':True,'duration':duration,'size':head['ContentLength']}
    except Exception as exc:result={'id':row['id'],'validated':False,'error_type':type(exc).__name__}
    results.append(result);print(json.dumps(result),flush=True)
Path(__file__).with_name('validation-results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
