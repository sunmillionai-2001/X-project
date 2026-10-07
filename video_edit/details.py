from pathlib import Path
import cv2
from PIL import Image,ImageDraw
c=cv2.VideoCapture(str(Path.home()/'Desktop'/'\u4e66\u751f\u8585tokens.mp4'))
for name,times in [('key',range(56,77,2)),('test',range(130,158,2))]:
    out=Image.new('RGB',(1600,((len(times)+2)//3)*330),'#222222'); d=ImageDraw.Draw(out)
    for i,t in enumerate(times):
        c.set(cv2.CAP_PROP_POS_MSEC,t*1000); ok,f=c.read()
        if ok:
            im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)); im.thumbnail((530,300)); x,y=i%3*530,i//3*330
            out.paste(im,(x,y)); d.text((x+5,y+302),str(t),fill='white')
    out.save(Path(__file__).parent/f'{name}_details.jpg')
