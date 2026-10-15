from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from pipeline import inspect_media, run_process
from streaming import build_adaptive, profiles_for, version_for


class Missing(Exception):
    response = {'Error': {'Code': '404'}}


class Storage:
    def __init__(self):
        self.objects = {'source.mp4': {'ContentLength': 10, 'ETag': '"abc"'}}
        self.writes = []

    def head_object(self, Bucket, Key):
        if Key not in self.objects:
            raise Missing()
        return self.objects[Key]

    def upload_file(self, source, bucket, key, ExtraArgs):
        body = Path(source).read_bytes()
        self.objects[key] = {'ContentLength': len(body), 'Metadata': ExtraArgs['Metadata']}
        self.writes.append(key)

    def put_object(self, Bucket, Key, Body, ContentType, Metadata):
        self.objects[Key] = {'ContentLength': len(Body), 'Metadata': Metadata, 'body': Body}
        self.writes.append(Key)


class Job:
    id = 'test'
    def __init__(self, folder):
        self.folder = folder
    def check(self):
        pass
    def progress(self, *args, **kwargs):
        pass


class StreamingTest(unittest.TestCase):
    def test_profiles_do_not_upscale_and_version_matches_etag(self):
        self.assertEqual([p[0] for p in profiles_for(540)], [240, 480])
        self.assertEqual([p[0] for p in profiles_for(200)], [200])
        self.assertEqual(version_for('"abc"'), 'ba7816bf8f01cfea')

    def test_real_encode_upload_and_resume(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            source = folder / 'test.mp4'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i',
                            'testsrc2=size=960x540:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440',
                            '-t', '7', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', str(source)], check=True)
            store = Storage()
            master = build_adaptive(Job(folder), store, 'bucket', source, 'source.mp4', inspect_media(source), run_process, 60)
            self.assertEqual(store.writes[-1], master)
            self.assertIn(b'#EXT-X-STREAM-INF:', store.objects[master]['body'])
            self.assertIn(b'0/index.m3u8', store.objects[master]['body'])
            self.assertIn(b'1/index.m3u8', store.objects[master]['body'])
            writes = len(store.writes)
            self.assertEqual(build_adaptive(Job(folder), store, 'bucket', source, 'source.mp4', inspect_media(source), run_process, 60), master)
            self.assertEqual(len(store.writes), writes)

    def test_upload_failure_does_not_expose_master(self):
        with tempfile.TemporaryDirectory() as temp:
            store = Storage()
            def encode(job, command, timeout, stage, duration=None):
                if stage == 'optimizing':
                    playlist = Path(command[-1])
                    playlist.write_text('#EXTM3U\n#EXTINF:1.0,\nsegment_00000.ts\n#EXT-X-ENDLIST\n')
                    (playlist.parent / 'segment_00000.ts').write_bytes(b'segment')
            with patch.object(store, 'upload_file', side_effect=ConnectionError):
                with self.assertRaises(ConnectionError):
                    build_adaptive(Job(Path(temp)), store, 'bucket', Path(temp) / 'source.mp4', 'source.mp4',
                                   {'height': 240, 'duration_seconds': 1}, encode, 60)
            self.assertFalse(any(k.endswith('master.m3u8') for k in store.objects))

    def test_capacity_failure_does_not_expose_master(self):
        with tempfile.TemporaryDirectory() as temp:
            store = Storage()
            with patch('streaming.shutil.disk_usage') as usage:
                usage.return_value.free = 0
                with self.assertRaises(RuntimeError):
                    build_adaptive(Job(Path(temp)), store, 'bucket', Path(temp) / 'source.mp4', 'source.mp4',
                                   {'height': 720, 'duration_seconds': 100}, run_process, 60)
            self.assertFalse(store.writes)


if __name__ == '__main__':
    unittest.main()
