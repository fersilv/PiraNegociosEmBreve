from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'logos'
OUT.mkdir(parents=True, exist_ok=True)

OFF = (245, 242, 235, 255)
LIGHT = (223, 136, 125, 255)
ACCENT = (204, 88, 67, 255)
PRIMARY = (166, 63, 45, 255)
DARK = (102, 38, 27, 255)
DEEP = (74, 28, 20, 255)
WHITE = (255, 255, 255, 255)
BLACK = (0, 0, 0, 255)
TRANSPARENT = (0, 0, 0, 0)

FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT_REGULAR = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def symbol(size: int, color):
    im = Image.new('RGBA', (size, size), TRANSPARENT)
    d = ImageDraw.Draw(im)
    cx, cy = size * 0.5, size * 0.40
    r = size * 0.27
    d.ellipse((cx-r, cy-r, cx+r, cy+r), fill=color)
    d.polygon([(cx-r*0.64, cy+r*0.55), (cx, size*0.90), (cx+r*0.64, cy+r*0.55)], fill=color)
    ir = r * 0.35
    d.ellipse((cx-ir, cy-ir, cx+ir, cy+ir), fill=TRANSPARENT)
    d.polygon([
        (cx+r*0.28, cy-r*0.92),
        (cx+r*1.05, cy-r*0.40),
        (cx+r*1.03, cy+r*0.10),
        (cx+r*0.40, cy-r*0.10),
    ], fill=TRANSPARENT)
    stem_w = r * 0.23
    d.polygon([
        (cx-stem_w, cy+ir*0.65),
        (cx+stem_w, cy+ir*0.65),
        (cx+stem_w*0.78, cy+r*1.55),
        (cx-stem_w*0.78, cy+r*1.55),
    ], fill=TRANSPARENT)
    return im


def save_symbol(name, color, size=1024):
    symbol(size, color).save(OUT / name, optimize=True)


def logo(name, symbol_color, pira_color, negocios_color, slogan=False, slogan_color=None):
    width, height = 2200, 700
    im = Image.new('RGBA', (width, height), TRANSPARENT)
    sym = symbol(520, symbol_color).resize((440, 440), Image.Resampling.LANCZOS)
    im.alpha_composite(sym, (40, 130))
    d = ImageDraw.Draw(im)
    f1 = ImageFont.truetype(FONT_BOLD, 220)
    f2 = ImageFont.truetype(FONT_REGULAR, 220)
    x, y = 510, 180
    d.text((x, y), 'Pira', font=f1, fill=pira_color)
    w1 = d.textbbox((x, y), 'Pira', font=f1)[2] - x
    d.text((x+w1, y), 'Negócios', font=f2, fill=negocios_color)
    if slogan:
        tf = ImageFont.truetype(FONT_BOLD, 54)
        d.text((x, 470), 'CONECTA OPORTUNIDADES', font=tf, fill=slogan_color or DARK)
    bbox = im.getbbox()
    im.crop(bbox).save(OUT / name, optimize=True)


# Logos horizontais transparentes
logo('logo-principal.png', PRIMARY, DARK, ACCENT)
logo('logo-principal-com-slogan.png', PRIMARY, DARK, ACCENT, True, DARK)
logo('logo-vinho-coral.png', DARK, DARK, ACCENT)
logo('logo-monocromatica-terracota.png', PRIMARY, PRIMARY, PRIMARY)
logo('logo-monocromatica-vinho.png', DARK, DARK, DARK)
logo('logo-monocromatica-preta.png', BLACK, BLACK, BLACK)
logo('logo-monocromatica-branca.png', WHITE, WHITE, WHITE)
logo('logo-branca-com-slogan.png', WHITE, WHITE, WHITE, True, WHITE)

# Símbolo isolado transparente
for name, color in [
    ('simbolo-terracota.png', PRIMARY),
    ('simbolo-coral.png', ACCENT),
    ('simbolo-vinho.png', DARK),
    ('simbolo-branco.png', WHITE),
    ('simbolo-preto.png', BLACK),
]:
    save_symbol(name, color)

# Badges/favicons transparentes
for size in (1024, 512, 256, 192, 128, 96, 64, 48, 32):
    symbol(size, PRIMARY).save(OUT / f'badge-transparente-{size}.png', optimize=True)
    symbol(size, WHITE).save(OUT / f'badge-branco-{size}.png', optimize=True)
    symbol(size, BLACK).save(OUT / f'badge-preto-{size}.png', optimize=True)

# Badge monocromático para notificações push / Android
for size in (512, 256, 192, 128, 96, 64):
    symbol(size, WHITE).save(OUT / f'notification-badge-{size}.png', optimize=True)

readme = '''# Logos PiraNegócios\n\nTodos os PNGs desta pasta são exportados com fundo transparente.\n\n## Logo principal\n- `logo-principal.png`: símbolo terracota, **Pira** vinho e **Negócios** coral.\n- `logo-principal-com-slogan.png`: mesma assinatura com “CONECTA OPORTUNIDADES”.\n\n## Variações\n- `logo-vinho-coral.png`\n- `logo-monocromatica-terracota.png`\n- `logo-monocromatica-vinho.png`\n- `logo-monocromatica-preta.png`\n- `logo-monocromatica-branca.png`\n- `logo-branca-com-slogan.png`\n\n## Símbolo isolado\nTerracota, coral, vinho, branco e preto. Todos transparentes.\n\n## Badges / favicon\nTerracota, branco e preto em 32, 48, 64, 96, 128, 192, 256, 512 e 1024 px.\n\n## Push\n`notification-badge-*` é monocromático, sem fundo, próprio para badge de notificação Android/Web Push.\n\n## Paleta\n- Off-white `#F5F2EB`\n- Coral `#CC5843`\n- Terracota `#A63F2D`\n- Vinho `#66261B`\n- Vinho profundo `#4A1C14`\n'''
(OUT / 'README.md').write_text(readme, encoding='utf-8')

print(f'Gerados {len(list(OUT.glob("*.png")))} PNGs transparentes em {OUT}')

# trigger: regenerate transparent brand exports
