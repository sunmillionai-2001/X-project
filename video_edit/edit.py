from pathlib import Path
import subprocess
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

base=Path(__file__).resolve().parent
src=Path.home()/'Desktop'/'书生薅tokens.mp4'
out=Path.home()/'Desktop'/'书生薅tokens_X精简版.mp4'
ff=imageio_ffmpeg.get_ffmpeg_exe()
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',38)
small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',30)
segments=[
 (2,8,'01  查看额度','先看额度，再接入客户端','web'),
 (29,38,'02  选择模型','在模型列表中确认可用模型和模型 ID','web'),
 (56,60,'03  创建 API Key','点击「创建 API Key」，填写名称','web'),
 (67,75,'03  创建 API Key','创建并复制密钥 · 画面中的密钥已遮挡','web'),
 (84,100,'04  配置客户端','设置 → 模型 → 添加自定义模型 API','app'),
 (103,114,'04  配置客户端','填写 API 地址、协议和密钥','app'),
 (117,129,'04  配置客户端','添加模型 ID，保存模型提供商','app'),
 (134,140,'05  测试调用','新建会话，选择刚配置的模型','app'),
 (146,150,'05  测试调用','发送一条消息，测试能否正常调用','app'),
 (154,158,'05  测试调用','查看模型返回的回复','app'),
 (166,173,'06  查看用量','回到「用量查询」，查看 Token 消耗','web'),
]

def run(args,log):
    with (base/log).open('w',encoding='utf-8') as f:
        subprocess.run([ff,'-hide_banner','-y',*args],stdout=f,stderr=f,check=True)

for i,(start,end,title,caption,kind) in enumerate(segments):
    layer=Image.new('RGBA',(1920,1080),(0,0,0,0))
    d=ImageDraw.Draw(layer)
    d.rectangle((0,0,1920,89),fill='#0E1726')
    d.rectangle((0,990,1920,1080),fill='#0E1726')
    d.rectangle((42,28,49,65),fill='#58CBFF')
    d.text((70,21),'书生 Token 接入实测',font=font,fill='white')
    d.text((1860-d.textlength(title,font=small),29),title,font=small,fill='#58CBFF')
    d.text(((1920-d.textlength(caption,font=font))/2,1007),caption,font=font,fill='white')
    layer.save(base/f'overlay_{i:02}.png')
    vf=['delogo=x=1575:y=175:w=300:h=110:show=0']
    if start==67:
        vf.append("drawbox=x=980:y=728:w=600:h=75:color=0x172638:t=fill:enable='between(t,3.7,8)'")
    if kind=='app' and start not in [103,117]:
        vf.append('crop=1600:960:640:240,scale=1500:900,pad=1920:1080:210:90:color=0x0E1726')
    else:
        vf.append('crop=1900:1000:470:160,scale=1710:900,pad=1920:1080:105:90:color=0x0E1726')
    graph=f"[0:v]{','.join(vf)},setsar=1,fps=20[v];[v][1:v]overlay=0:0:shortest=1[out]"
    run(['-ss',str(start),'-t',str(end-start),'-i',str(src),'-loop','1','-i',str(base/f'overlay_{i:02}.png'),
         '-filter_complex',graph,'-map','[out]','-map','0:a:0','-af',f'volume=10dB,afade=t=in:d=0.04,afade=t=out:st={end-start-0.04}:d=0.04',
         '-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-ar','44100',
         '-t',str(end-start),'-map_metadata','-1',str(base/f'part_{i:02}.mp4')],f'part_{i:02}.log')
    print(f'Completed {i+1}/{len(segments)}',flush=True)
(base/'concat.txt').write_text('\n'.join(f"file 'part_{i:02}.mp4'" for i in range(len(segments))),encoding='utf-8')
run(['-f','concat','-safe','0','-i',str(base/'concat.txt'),'-c','copy','-movflags','+faststart','-map_metadata','-1',str(out)],'concat.log')
print(f'Duration: {sum(b-a for a,b,*_ in segments)} seconds; bytes: {out.stat().st_size}',flush=True)
