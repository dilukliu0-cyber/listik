"""Иконка и заставка Listik: синий #3390EC, белый пузырь сообщения.
Запуск: python3 scripts/make-icons.py"""
from PIL import Image, ImageDraw

BLUE = (0x33, 0x90, 0xEC, 255)
DARK_BG = (0x1C, 0x1C, 0x1D, 255)
DARK_FG = (0x5E, 0xB5, 0xF7, 255)
WHITE = (255, 255, 255, 255)
S = 4  # суперсэмплинг для гладких краёв


def bubble(draw, cx, cy, w, color):
    """Пузырь как в мессенджере: скруглённый прямоугольник + хвостик снизу слева."""
    h = w * 0.78
    x0, y0 = cx - w / 2, cy - h / 2 - w * 0.04
    x1, y1 = cx + w / 2, cy + h / 2 - w * 0.04
    r = h * 0.5
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=color)
    tail = [
        (x0 + w * 0.12, y1 - h * 0.30),
        (x0 + w * 0.04, y1 + h * 0.20),
        (x0 + w * 0.40, y1 - h * 0.06),
    ]
    draw.polygon(tail, fill=color)


def icon(size, bg, fg, path, transparent=False, scale=0.56):
    big = size * S
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0) if transparent else bg)
    d = ImageDraw.Draw(img)
    bubble(d, big / 2, big / 2, big * scale, fg)
    img = img.resize((size, size), Image.LANCZOS)
    if not transparent:
        img = img.convert('RGB')
    img.save(path)


icon(1024, BLUE, WHITE, 'assets/icon.png')
icon(1024, DARK_BG, DARK_FG, 'assets/icon-dark.png')
# tinted-иконка iOS 18: оттенки серого на прозрачном
icon(1024, None, WHITE, 'assets/icon-tinted.png', transparent=True)
# заставка: белая плитка с синим пузырём (фон #3390EC задаётся в app.json)
big = 600 * S
img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
pad = big * 0.1
d.rounded_rectangle([pad, pad, big - pad, big - pad], radius=big * 0.22, fill=WHITE)
bubble(d, big / 2, big / 2, big * 0.48, BLUE)
img.resize((600, 600), Image.LANCZOS).save('assets/splash-icon.png')
icon(48, BLUE, WHITE, 'assets/favicon.png')
print('ok')
