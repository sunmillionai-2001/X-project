import os, sys, tempfile, unittest
from pathlib import Path
TEMP=tempfile.TemporaryDirectory()
os.environ['WORKBENCH_DATA']=TEMP.name
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import server as s

class WorkflowTests(unittest.TestCase):
    def project(self):
        return s.dispatch('/api/project',{'title':'测试选题','evidence':'有来源的事实','test':True})
    def test_revision_conflict(self):
        p=self.project();s.update_project({'id':p['id'],'revision':p['revision'],'title':'新标题'})
        with self.assertRaisesRegex(ValueError,'更新'):s.update_project({'id':p['id'],'revision':p['revision'],'title':'过期覆盖'})
    def test_edit_invalidates_approval(self):
        p=self.project();p=s.update_project({'id':p['id'],'revision':p['revision'],'factsApproved':True,'scriptApproved':True})
        p=s.update_project({'id':p['id'],'revision':p['revision'],'evidence':'事实发生变化'})
        self.assertFalse(p['scriptApproved']);self.assertFalse(p['factsApproved'])
    def test_render_gate_before_network(self):
        with self.assertRaisesRegex(ValueError,'确认脚本'):s.render(self.project()['id'])
    def test_export_rejects_unreviewed(self):
        with self.assertRaisesRegex(ValueError,'审核'):s.export(self.project()['id'])
    def test_unknown_metrics_stay_null(self):
        p=self.project();m=s.dispatch('/api/metrics',{'projectId':p['id'],'platform':'x','views':'','likes':0})
        self.assertIsNone(m['views']);self.assertEqual(m['likes'],0)
    def test_negative_metrics_rejected(self):
        p=self.project()
        with self.assertRaises(ValueError):s.dispatch('/api/metrics',{'projectId':p['id'],'platform':'x','views':-1})
    def test_path_traversal_rejected(self):
        with self.assertRaises(ValueError):s.folder('../secret')
    def test_missing_model_explicit(self):
        with self.assertRaisesRegex(ValueError,'尚未选择'):s.model_json('hello')
    def test_prediction_cannot_be_rewritten(self):
        p=self.project();p=s.update_project({'id':p['id'],'revision':p['revision'],'prediction':'开头演示可能吸引观众','lockPrediction':True})
        with self.assertRaisesRegex(ValueError,'已锁定'):s.update_project({'id':p['id'],'revision':p['revision'],'prediction':'事后修改'})
    def test_missing_assets_pauses_before_tts(self):
        p=self.project();p=s.update_project({'id':p['id'],'revision':p['revision'],'script':{'title':'test','scenes':[{'narration':'第一段'},{'narration':'第二段'}]},'factsApproved':True,'scriptApproved':True})
        with self.assertRaisesRegex(ValueError,'缺少'):s.render(p['id'])
        self.assertEqual(s.get(p['id'])['stage'],'blocked')

if __name__=='__main__':unittest.main()
