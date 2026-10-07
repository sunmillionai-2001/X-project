from pathlib import Path
import cv2
from PIL import Image
src=Path.home()/'Desktop'/'书生薅tokens_X精简版.mp4'
c=cv2.VideoCapture(str(src))
print('Resolution:',int(c.get(3)),int(c.get(4)),'FPS:',c.get(5),'Duration:',c.get(7)/c.get(5))
for t in [0,23,44,74,83]:
    c.set(cv2.CAP_PROP_POS_MSEC,t*1000); ok,f=c.read()
    if ok: Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).save(Path(__file__).parent/f'check_{t}.jpg')
