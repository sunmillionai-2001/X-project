"""Three real-source render checks; isolated records, not actual account results."""
import os,sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
root=Path(__file__).resolve().parents[3]
os.environ['WORKBENCH_DATA']=str(root/'research'/'qa-v2')
import server as s
from PIL import Image,ImageDraw

cases=[
('一段文字怎样变成解说视频','https://github.com/harry0703/MoneyPrinterTurbo',[
 '写好一段文字，离一条完整视频还有多远？MoneyPrinterTurbo 把文案、配音、字幕和素材合成放在一套流程里。它的代码公开，可以在自己的电脑上运行。',
 '你可以提供主题，也可以使用自己的文案，再设置画面比例和声音。它能减少重复操作，但素材能不能准确解释内容，仍然需要逐段检查。自动合成不等于自动做好。',
 '如果你想做 AI 解说，先准备一个具体选题和可靠来源，用自己的截图测试一次。注意，开源代码不代表所有模型和素材接口都免费，运行前要查看配置与费用。'
 ]),
('用文件管理自己的创作流程','https://github.com/fengjunchengCode/obsidian-creator-workbench',[
 '选题放在聊天里，稿子放在文档里，发布后又忘了复盘。这个开源创作工作台，尝试把这些环节放回一个文件夹，用普通 Markdown 文件保存内容。',
 '它用 Python 读取选题、排期和已发布记录，再生成网页看板。你修改文件后重新构建，就能查看新的进度。Obsidian 能帮助管理文件，但不是运行看板的必需品。',
 '它的价值是保留每次创作的过程和判断。需要注意，页面上的示例数据是虚构的，而且视频数据通常需要你回填。它能辅助组织创作，不能保证内容一定获得高播放。'
 ]),
('中文解说配音可以怎样自动制作','https://github.com/rany2/edge-tts',[
 '做一条解说视频，配音常常是重复工作。edge-tts 是一个开源的 Python 工具，可以通过在线语音服务，把输入的文字转换成语音，也支持选择声音和调整语速。',
 '一个实用的做法是先确认脚本，再按分镜生成旁白，把语音与对应画面组合。字幕需要跟着声音检查，特别是英文产品名和数字，不能生成后就直接发布。',
 '这个工具需要联网，不是完全离线的语音模型。在线服务可能变化或暂时失败，因此工作台应保留稿件，明确报错并允许重试。先试听一小段，再制作整条视频。'
 ])]
results=[]
for index,(title,url,narrations) in enumerate(cases):
 p=s.dispatch('/api/project',{'title':title,'url':url,'evidence':'依据链接项目文档整理；验收用解说，非实测效果宣称。','test':True})
 script={'title':title,'douyin':title+'。看清能力和限制，再决定是否使用。','x':title+'\n来源：'+url,'scenes':[{'narration':n,'visual':'原创功能说明图；不是产品截图'} for n in narrations]}
 p=s.update_project({'id':p['id'],'revision':p['revision'],'script':script,'topicApproved':True})
 for i,n in enumerate(narrations):
  im=Image.new('RGB',(1000,700),'#edf1fa');d=ImageDraw.Draw(im)
  d.text((60,65),'流程说明 · 非产品截图',font=s.font(28),fill='#566884')
  labels=[['文案','配音 / 字幕','审核与导出'],['选题文件','制作与排期','回填与复盘'],['确认稿件','在线生成配音','试听与对齐']][index]
  for j,label in enumerate(labels):
   d.rounded_rectangle((60,155+j*150,930,260+j*150),radius=18,fill='#5362e8' if i==j else '#dce4f5')
   d.text((100,179+j*150),str(j+1)+'  '+label,font=s.font(37),fill='white' if i==j else '#263752')
  import io
  data=io.BytesIO();im.save(data,format='PNG');p=s.image_asset(p['id'],data.getvalue(),'原创功能示意图','验收原创说明图')
 assets=[dict(a,approved=True,rights='本次原创功能说明图，未复制项目宣传图片',scene=i) for i,a in enumerate(p['assets'])]
 p=s.update_project({'id':p['id'],'revision':p['revision'],'assets':assets,'factsApproved':True,'scriptApproved':True})
 try:
  p=s.render(p['id']);results.append({'title':title,'id':p['id'],'status':'rendered','render':p['render'],'path':str(s.folder(p['id'])/p['render']['dir']/'video.mp4')})
  print(json.dumps(results[-1],ensure_ascii=False),flush=True)
 except Exception as e:
  results.append({'title':title,'id':p['id'],'status':'failed','error':str(e)});print(json.dumps(results[-1],ensure_ascii=False),flush=True)
(root/'research'/'qa-v2'/'render-report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
