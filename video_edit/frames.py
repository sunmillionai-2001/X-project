from pathlib import Path
import cv2
src = Path.home() / 'Desktop' / '\u4e66\u751f\u8585tokens.mp4'
c = cv2.VideoCapture(str(src))
for t in [0,30,60,80,95,110,125,140,160,175]:
    c.set(cv2.CAP_PROP_POS_MSEC,t*1000)
    ok,f=c.read()
    if ok: (Path(__file__).parent / f'frame_{t}.png').write_bytes(cv2.imencode('.png',f)[1].tobytes())
