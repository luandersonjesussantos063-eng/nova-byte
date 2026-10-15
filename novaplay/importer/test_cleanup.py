import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock
from cleanup import cleanup_published_imports


class CleanupTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'jobs'
        self.id = '11111111-1111-4111-8111-111111111111'
        self.folder = self.root / self.id
        self.folder.mkdir(parents=True)
        self.recovery = self.base / 'recovery'
        self.recovery.mkdir()
        self.original = self.folder / 'download' / 'original.mkv'
        self.original.parent.mkdir()
        self.original.write_bytes(b'original')
        (self.folder / 'output.mp4').write_bytes(b'output')
        self.saved = self.recovery / (self.id + '.mp4')
        self.saved.write_bytes(b'recovery')
        self.outside = self.base / 'personal.mp4'
        self.outside.write_bytes(b'personal')
        self.manifest = {'complete': True, 'object_key': 'owner/film.mp4', 'sha256': 'a' * 64,
                         'metadata': {'size_bytes': 6}, 'source': str(self.outside)}
        self.write_manifest()
        self.job = {'status': 'ready', 'r2_object_key': 'owner/film.mp4'}
        self.entry = {'is_published': True, 'r2_object_key': 'owner/film.mp4', 'media_validated_at': 'now'}
        self.db = MagicMock()
        self.db.table.side_effect = self.table
        self.r2 = MagicMock()
        self.r2.head_object.return_value = {'ContentLength': 6, 'Metadata': {'sha256': 'a' * 64}}

    def table(self, name):
        query = MagicMock()
        query.select.return_value = query
        query.eq.return_value = query
        query.execute.return_value.data = [self.job if name == 'novaplay_magnet_imports' else self.entry]
        return query

    def write_manifest(self):
        (self.folder / 'manifest.json').write_text(json.dumps(self.manifest))

    def clean(self):
        return cleanup_published_imports(self.db, self.r2, 'nplay-filmes', self.root, self.recovery)

    def test_published_verified_import_removes_only_managed_files(self):
        self.assertEqual(self.clean(), 1)
        self.assertFalse(self.original.exists())
        self.assertFalse(self.saved.exists())
        self.assertTrue(self.outside.exists())
        self.assertIn('local_cleanup_at', json.loads((self.folder / 'manifest.json').read_text()))
        self.assertEqual(self.clean(), 0)
        self.r2.head_object.assert_called_once()

    def test_draft_preserves_files(self):
        self.entry['is_published'] = False
        self.assertEqual(self.clean(), 0)
        self.assertTrue(self.original.exists())
        self.r2.head_object.assert_not_called()

    def test_incomplete_or_processing_import_preserves_files(self):
        self.job['status'] = 'processing'
        self.assertEqual(self.clean(), 0)
        self.assertTrue(self.original.exists())
        self.manifest['complete'] = False
        self.write_manifest()
        self.job['status'] = 'ready'
        self.assertEqual(self.clean(), 0)
        self.assertTrue(self.original.exists())

    def test_replaced_catalog_video_preserves_original(self):
        self.entry['r2_object_key'] = 'different.mp4'
        self.assertEqual(self.clean(), 0)
        self.assertTrue(self.original.exists())

    def test_remote_integrity_mismatch_preserves_files(self):
        for head in [{'ContentLength': 5, 'Metadata': {'sha256': 'a' * 64}},
                     {'ContentLength': 6, 'Metadata': {'sha256': 'b' * 64}}]:
            self.r2.head_object.return_value = head
            self.assertEqual(self.clean(), 0)
            self.assertTrue(self.original.exists())

    def test_network_failure_preserves_files_and_can_retry(self):
        self.r2.head_object.side_effect = ConnectionError()
        self.assertEqual(self.clean(), 0)
        self.assertTrue(self.original.exists())
        self.r2.head_object.side_effect = None
        self.assertEqual(self.clean(), 1)

    def test_symlink_cannot_delete_external_directory(self):
        external = self.base / 'external'
        external.mkdir()
        target = external / 'keep.txt'
        target.write_text('keep')
        (self.folder / 'link').symlink_to(external, target_is_directory=True)
        self.assertEqual(self.clean(), 1)
        self.assertTrue(target.exists())


if __name__ == '__main__':
    unittest.main()
