"""Marketing visuals in the site's look (design/yeppo-handoff/tokens): 1080×1350 cards, 1080×1920 story,
9:16 Reels MP4 (ffmpeg). The product photo is only scaled/cropped — never altered (CLAUDE.md §2)."""
import io
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

from yeppo_agents.settings import cfg

ASSETS = Path(__file__).parent / "assets"
C = {"bg": "#F0EEE9", "surface": "#FBFAF7", "surface2": "#F6F3EF", "blush": "#F2D6D0", "peach": "#F5DCC9",
     "rose": "#A8475C", "ink": "#2A211E", "muted": "#6B5F59", "line": "#E2DAD2", "dot": "#E8B4B8"}


@dataclass
class Item:
    brand: str
    name: str
    price: str            # "219 000 soʻm"
    photos: list[bytes]   # original product photos, first = main
    type: str = ""        # "Serum"
    volume: str = ""
    need: str = ""        # one line: what it is for (from the catalog, admin-written)
    points: list[str] = field(default_factory=list)  # 1-3 short facts (from the catalog)
    site: str = "yeppo.uz"
    delivery: str = ""    # "Toshkent boʻylab 1–2 kunda"


def font(size: int, weight: int = 500, serif: bool = False, italic: bool = False) -> ImageFont.FreeTypeFont:
    if serif:
        return ImageFont.truetype(str(ASSETS / ("InstrumentSerif-italic-latin.woff2" if italic else "InstrumentSerif-latin.woff2")), size)
    f = ImageFont.truetype(str(ASSETS / "InterTight-latin.woff2"), size)
    f.set_variation_by_axes([weight])
    return f


def wrap(d: ImageDraw.ImageDraw, text: str, f, width: int, max_lines: int) -> list[str]:
    lines, cur = [], ""
    for w in text.split():
        t = f"{cur} {w}".strip()
        if d.textlength(t, font=f) <= width:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        while d.textlength(lines[-1] + "…", font=f) > width and " " in lines[-1]:
            lines[-1] = lines[-1].rsplit(" ", 1)[0]
        lines[-1] += "…"
    return lines


def text_block(d, xy, text, f, width, max_lines, fill, spacing=1.12) -> int:
    x, y = xy
    for line in wrap(d, text, f, width, max_lines):
        d.text((x, y), line, font=f, fill=fill)
        y += int(f.size * spacing)
    return y


def rounded(img: Image.Image, r: int) -> Image.Image:
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, *img.size), r, fill=255)
    out = img.convert("RGBA")
    out.putalpha(m)
    return out


def readable(data: bytes) -> bool:
    try:
        Image.open(io.BytesIO(data)).verify()
        return True
    except Exception:
        return False


def load(data: bytes) -> Image.Image:
    """Decode only. A transparent PNG/WebP is laid on white, as a browser shows it (plain convert() makes it black)."""
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
    if im.mode in ("RGBA", "LA", "PA") or "transparency" in im.info:
        im = im.convert("RGBA")
        im = Image.alpha_composite(Image.new("RGBA", im.size, "white"), im)
    return im.convert("RGB")


def photo(data: bytes, size: tuple[int, int], mode: str = "cover") -> Image.Image:
    im = load(data)
    if mode == "cover":
        return ImageOps.fit(im, size, Image.LANCZOS, centering=(0.5, 0.45))
    # contain on a soft surface — packshots on white keep their whole shape
    bg = Image.new("RGB", size, C["surface"])
    im.thumbnail((int(size[0] * 0.86), int(size[1] * 0.86)), Image.LANCZOS)
    bg.paste(im, ((size[0] - im.width) // 2, (size[1] - im.height) // 2))
    return bg


def is_packshot(data: bytes) -> bool:
    """White/plain background product shot -> show whole (contain); lifestyle photo -> cover."""
    im = load(data).convert("L").resize((64, 64))
    edge = [im.getpixel((x, y)) for x in range(64) for y in (0, 63)] + [im.getpixel((x, y)) for y in range(64) for x in (0, 63)]
    return sum(p > 235 for p in edge) / len(edge) > 0.8


def logo(d: ImageDraw.ImageDraw, x: int, y: int, scale: float = 1.0) -> None:
    r = int(9 * scale)
    d.ellipse((x, y + int(10 * scale), x + 2 * r, y + int(10 * scale) + 2 * r), fill=C["dot"])
    d.ellipse((x + int(11 * scale), y + int(10 * scale), x + int(11 * scale) + 2 * r, y + int(10 * scale) + 2 * r), fill=C["ink"])
    d.text((x + int(42 * scale), y), "Yeppo", font=font(int(36 * scale), 500), fill=C["ink"])


def chip(d, x, y, text, f, bg, fg, pad=(22, 12), anchor_right=False) -> int:
    w = int(d.textlength(text, font=f)) + 2 * pad[0]
    h = f.size + 2 * pad[1]
    if anchor_right:
        x -= w
    d.rounded_rectangle((x, y, x + w, y + h), h // 2, fill=bg)
    d.text((x + pad[0], y + pad[1] - int(f.size * 0.1)), text, font=f, fill=fg)
    return x + w


# --- cards ------------------------------------------------------------------------------------
def card_main(it: Item) -> Image.Image:
    W, H = cfg()["content"]["card"]["w"], cfg()["content"]["card"]["h"]
    im = Image.new("RGB", (W, H), C["bg"])
    d = ImageDraw.Draw(im)
    logo(d, 60, 50)
    chip(d, W - 60, 50, "Original · Koreya", font(26, 500), C["surface"], C["ink"], anchor_right=True)
    box = (60, 130, W - 60, 900)
    pw, ph = box[2] - box[0], box[3] - box[1]
    main = it.photos[0]
    pic = photo(main, (pw, ph), "contain" if is_packshot(main) else "cover")
    im.paste(rounded(pic, 28), box[:2], rounded(pic, 28))
    if it.type:
        chip(d, box[0] + 24, box[1] + 24, it.type, font(26, 500), C["surface"], C["ink"])
    y = 940
    d.text((60, y), it.brand.upper(), font=font(28, 600), fill=C["muted"])
    y = text_block(d, (60, y + 44), it.name, font(54, 500), W - 120, 2, C["ink"], 1.08)
    if it.volume:
        d.text((60, y + 6), it.volume, font=font(28, 400), fill=C["muted"])
    d.text((60, H - 150), it.price, font=font(76, 600), fill=C["ink"])
    d.text((60, H - 64), it.site, font=font(28, 500), fill=C["rose"])
    if it.delivery:
        f = font(26, 400)
        d.text((W - 60 - d.textlength(it.delivery, font=f), H - 64), it.delivery, font=f, fill=C["muted"])
    return im


def card_photo(it: Item, data: bytes) -> Image.Image:
    W, H = cfg()["content"]["card"]["w"], cfg()["content"]["card"]["h"]
    im = photo(data, (W, H), "contain" if is_packshot(data) else "cover")
    d = ImageDraw.Draw(im)
    f = font(28, 500)
    label = f"{it.brand} · {it.price}"
    chip(d, 48, H - 100, label, f, C["surface"], C["ink"])
    return im


def card_facts(it: Item) -> Image.Image | None:
    if not (it.need or it.points):
        return None
    W, H = cfg()["content"]["card"]["w"], cfg()["content"]["card"]["h"]
    im = Image.new("RGB", (W, H), C["blush"])
    d = ImageDraw.Draw(im)
    logo(d, 60, 50)
    d.text((60, 190), "Nimasi yaxshi", font=font(40, 400, serif=True, italic=True), fill=C["rose"])
    y = text_block(d, (60, 250), it.need or it.name, font(64, 500), W - 120, 4, C["ink"], 1.08) + 40
    for p in it.points[:3]:
        d.ellipse((60, y + 18, 76, y + 34), fill=C["rose"])
        y = text_block(d, (100, y), p, font(36, 400), W - 160, 3, C["ink"], 1.3) + 22
    thumb = photo(it.photos[0], (300, 300), "contain" if is_packshot(it.photos[0]) else "cover")
    im.paste(rounded(thumb, 24), (W - 360, H - 360), rounded(thumb, 24))
    d.text((60, H - 150), it.price, font=font(64, 600), fill=C["ink"])
    d.text((60, H - 70), it.site, font=font(28, 500), fill=C["rose"])
    return im


def story(it: Item) -> Image.Image:
    W, H = cfg()["content"]["story"]["w"], cfg()["content"]["story"]["h"]
    im = Image.new("RGB", (W, H), C["bg"])
    d = ImageDraw.Draw(im)
    logo(d, 70, 120, 1.2)
    main = it.photos[0]
    pic = photo(main, (W - 140, 1060), "contain" if is_packshot(main) else "cover")
    im.paste(rounded(pic, 36), (70, 230), rounded(pic, 36))
    y = 1340
    d.text((70, y), it.brand.upper(), font=font(32, 600), fill=C["muted"])
    y = text_block(d, (70, y + 50), it.name, font(60, 500), W - 140, 2, C["ink"], 1.08)
    d.text((70, H - 330), it.price, font=font(88, 600), fill=C["ink"])
    chip(d, 70, H - 200, "Buyurtma — havola profilda", font(34, 500), C["ink"], C["surface"], pad=(30, 18))
    return im


# --- reels ----------------------------------------------------------------------------------------
def reel_scenes(it: Item) -> list[Image.Image]:
    W, H = cfg()["content"]["reels"]["w"], cfg()["content"]["reels"]["h"]
    out = []
    main = it.photos[0]
    pack = is_packshot(main)

    # 1. hook: photo + "Koreyadan" in serif italic
    s = Image.new("RGB", (W, H), C["bg"])
    pic = photo(main, (W, int(H * 0.72)), "contain" if pack else "cover")
    s.paste(pic, (0, 0))
    d = ImageDraw.Draw(s)
    d.text((70, int(H * 0.75)), "Koreyadan", font=font(84, 400, serif=True, italic=True), fill=C["rose"])
    text_block(d, (70, int(H * 0.75) + 110), it.type or it.brand, font(96, 500), W - 140, 2, C["ink"], 1.05)
    out.append(s)

    # 2. brand + name over the photo
    s = Image.new("RGB", (W, H), C["surface"])
    pic = photo(it.photos[1] if len(it.photos) > 1 else main, (W - 120, 1100), "contain" if pack else "cover")
    s.paste(rounded(pic, 40), (60, 200), rounded(pic, 40))
    d = ImageDraw.Draw(s)
    logo(d, 60, 90, 1.2)
    d.text((60, 1360), it.brand.upper(), font=font(36, 600), fill=C["muted"])
    y = text_block(d, (60, 1420), it.name, font(70, 500), W - 120, 3, C["ink"], 1.06)
    if it.volume:
        d.text((60, y + 10), it.volume, font=font(36, 400), fill=C["muted"])
    out.append(s)

    # 3. what it is for (only real catalog text)
    if it.need or it.points:
        s = Image.new("RGB", (W, H), C["blush"])
        d = ImageDraw.Draw(s)
        d.text((70, 360), "Nimasi yaxshi", font=font(64, 400, serif=True, italic=True), fill=C["rose"])
        y = text_block(d, (70, 470), it.need or it.name, font(80, 500), W - 140, 5, C["ink"], 1.08) + 60
        for p in it.points[:3]:
            d.ellipse((70, y + 22, 92, y + 44), fill=C["rose"])
            y = text_block(d, (120, y), p, font(46, 400), W - 190, 3, C["ink"], 1.3) + 30
        out.append(s)

    # 4. price + call to action
    s = Image.new("RGB", (W, H), C["bg"])
    thumb = photo(main, (760, 760), "contain" if pack else "cover")
    s.paste(rounded(thumb, 40), ((W - 760) // 2, 260), rounded(thumb, 40))
    d = ImageDraw.Draw(s)
    f = font(120, 600)
    d.text(((W - d.textlength(it.price, font=f)) / 2, 1110), it.price, font=f, fill=C["ink"])
    if it.delivery:
        f2 = font(42, 400)
        d.text(((W - d.textlength(it.delivery, font=f2)) / 2, 1280), it.delivery, font=f2, fill=C["muted"])
    f3 = font(48, 500)
    label = "Buyurtma — havola profilda"
    w = d.textlength(label, font=f3) + 100
    x = (W - w) / 2
    d.rounded_rectangle((x, 1420, x + w, 1540), 60, fill=C["ink"])
    d.text((x + 50, 1452), label, font=f3, fill=C["surface"])
    f4 = font(44, 500)
    d.text(((W - d.textlength(it.site, font=f4)) / 2, 1640), it.site, font=f4, fill=C["rose"])
    out.append(s)
    return out


def reels(it: Item, out: Path) -> Path:
    """Scenes -> slow zoom each -> crossfades -> H.264 MP4 with a silent track (music is added in Instagram)."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg topilmadi")
    r = cfg()["content"]["reels"]
    W, H, fps, sec, xf = r["w"], r["h"], r["fps"], r["scene_seconds"], r["xfade_seconds"]
    scenes = reel_scenes(it)
    frames = int(sec * fps)
    with tempfile.TemporaryDirectory() as tmp:
        inputs, filters = [], []
        for i, sc in enumerate(scenes):
            p = Path(tmp) / f"s{i}.png"
            sc.save(p)
            inputs += ["-i", str(p)]  # one still; zoompan makes the frames (a looped input only fills ffmpeg's queues)
            filters.append(
                f"[{i}:v]scale={W * 2}:{H * 2},zoompan=z='min(1+0.0009*on,1.06)':d={frames}"
                f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={fps},setsar=1,format=yuv420p[v{i}]")
        last, offset = "v0", 0.0
        for i in range(1, len(scenes)):
            offset += sec - xf
            filters.append(f"[{last}][v{i}]xfade=transition=fade:duration={xf}:offset={offset:.2f}[x{i}]")
            last = f"x{i}"
        total = sec * len(scenes) - xf * (len(scenes) - 1)
        # Thread and lookahead caps keep ffmpeg's memory flat (~0.4 GB) whatever the host's core count;
        # with the defaults a 4-core host needs >1 GB and the container is OOM-killed (compose mem_limit).
        cmd = ["ffmpeg", "-y", "-loglevel", "error", *inputs,
               "-f", "lavfi", "-t", f"{total:.2f}", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
               "-filter_complex_threads", "1", "-filter_complex", ";".join(filters),
               "-map", f"[{last}]", "-map", f"{len(scenes)}:a",
               "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(fps),
               "-threads", "2", "-x264-params", "rc-lookahead=5:sync-lookahead=0:bframes=0:ref=1",
               "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", str(out)]
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, errors="replace", timeout=600)
        except subprocess.TimeoutExpired:
            raise RuntimeError("ffmpeg 10 daqiqada tugamadi") from None  # the default message is the whole command
        if r.returncode:
            out.unlink(missing_ok=True)
            raise RuntimeError(f"ffmpeg xato ({r.returncode}): {r.stderr.strip()[-300:]}")
    return out
