from pathlib import Path
import cv2
from PIL import Image, ImageDraw

src = Path.home() / 'Desktop' / '\u4e66\u751f\u8585tokens.mp4'
cap = cv2.VideoCapture(str(src))
duration = cap.get(cv2.CAP_PROP_FRAME_COUNT) / cap.get(cv2.CAP_PROP_FPS)
print(duration)
sheet = Image.new('RGB', (1600, 1200), '#222222')
draw = ImageDraw.Draw(sheet)
for i in range(30):
    t = i * duration / 30
    cap.set(cv2.CAP_PROP_POS_MSEC, t*1000)
    ok, frame = cap.read()
    if ok:
        im = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        im.thumbnail((400, 200))
        x,y = (i%4)*400,(i//4)*150
        im.thumbnail((400,125))
        sheet.paste(im,(x,y))
        draw.text((x+5,y+128),f'{t:.1f}s',fill='white')
sheet.save(Path(__file__).parent / 'overview.jpg')
