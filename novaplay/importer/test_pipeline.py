import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, MagicMock
from pipeline import safe_file,select_video,ReviewRequired,PermanentError,browser_compatible,classify,upload_resumable

class MissingObject(Exception):
    response={'Error':{'Code':'404'}}

class FakeJob:
    id='11111111-1111-4111-8111-111111111111'
    record={'created_by':'22222222-2222-4222-8222-222222222222'}
    def __init__(self):self.manifest={}
    def check(self):pass
    def checkpoint(self,**fields):self.manifest.update(fields)
    def progress(self,*args,**kw):pass

class FakeR2:
    def __init__(self):self.parts={};self.object=None;self.calls=[];self.fail_part=None;self.fail_complete=False
    def head_object(self,**kw):
        if self.object is None:raise MissingObject()
        return self.object
    def create_multipart_upload(self,**kw):self.metadata=kw['Metadata'];return {'UploadId':'upload-1'}
    def upload_part(self,**kw):
        n=kw['PartNumber'];self.calls.append(n)
        if self.fail_part==n:self.fail_part=None;raise ConnectionError('interruption')
        self.parts[n]={'PartNumber':n,'ETag':str(n),'Size':len(kw['Body'])}
        return self.parts[n]
    def get_paginator(self,name):return self
    def paginate(self,**kw):return [{'Parts':list(self.parts.values())}]
    def complete_multipart_upload(self,**kw):
        self.object={'ContentLength':sum(p['Size'] for p in self.parts.values()),'Metadata':self.metadata}
        if self.fail_complete:self.fail_complete=False;raise ConnectionError('response lost after completion')

class PipelineTest(unittest.TestCase):
    def test_lost_lease_cannot_write_progress(self):
        from pipeline import Job, LeaseLost
        with tempfile.TemporaryDirectory() as root:
            db=MagicMock();query=db.table.return_value.update.return_value
            query.eq.return_value=query;query.execute.return_value.data=[]
            job=Job(db,{'id':FakeJob.id,'lock_token':'old-token'},root)
            with self.assertRaises(LeaseLost):job.update(stage='uploading')
            self.assertTrue(job.lost.is_set())
            self.assertIn((('lock_token','old-token'),),query.eq.call_args_list)
            before=query.execute.call_count
            with self.assertRaises(LeaseLost):job.update(stage='complete')
            self.assertEqual(query.execute.call_count,before)

    def test_path_traversal_and_windows_drive_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            for name in ['../secret','C:/secret','C:secret','..\\secret','/absolute','video.mp4:stream']:
                with self.subTest(name=name),self.assertRaises(PermanentError):safe_file(root,name)
            self.assertEqual(safe_file(root,'movie/film.mp4'),Path(root).resolve()/'movie/film.mp4')
    def test_ambiguous_pack_requires_choice(self):
        files=[{'index':0,'name':'show.S01E01.mp4','bytes':100},{'index':1,'name':'show.S01E02.mp4','bytes':200}]
        with self.assertRaises(ReviewRequired):select_video(files)
        self.assertEqual(select_video(files,0),files[0])
    def test_sample_not_selected_as_main(self):
        self.assertEqual(select_video([{'index':0,'name':'sample.mp4'},{'index':1,'name':'movie.mp4'}])['index'],1)
    def test_mp4_hevc_requires_conversion(self):
        meta={'video_codec':'hevc','pixel_format':'yuv420p','audio_codecs':['aac']}
        self.assertFalse(browser_compatible('movie.mp4',meta))
        meta['video_codec']='h264';self.assertTrue(browser_compatible('movie.mp4',meta))
        meta['audio_codecs']=['dts'];self.assertFalse(browser_compatible('movie.mp4',meta))
    def test_episode_metadata_and_season_ambiguity(self):
        self.assertEqual(classify('Programa 2ª Temporada (2026)','show.S02E03.mkv')['episode_number'],3)
        with self.assertRaises(ReviewRequired):classify('Programa 2ª Temporada','full.mp4')
    def test_resume_skips_already_uploaded_parts(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'video.mp4';path.write_bytes(b'x'*(32*1024**2+7))
            job=FakeJob();r2=FakeR2();r2.fail_part=2
            with self.assertRaises(ConnectionError):upload_resumable(job,r2,'bucket',path)
            upload_resumable(job,r2,'bucket',path)
            self.assertEqual(r2.calls,[1,2,2])
            # Database update failed after upload: retry must not upload again.
            upload_resumable(job,r2,'bucket',path);self.assertEqual(r2.calls,[1,2,2])
    def test_lost_complete_response_reconciled_by_checksum(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'video.mp4';path.write_bytes(b'x'*17)
            job=FakeJob();r2=FakeR2();r2.fail_complete=True
            with self.assertRaises(ConnectionError):upload_resumable(job,r2,'bucket',path)
            upload_resumable(job,r2,'bucket',path)
            self.assertEqual(r2.calls,[1])

if __name__=='__main__':unittest.main()
