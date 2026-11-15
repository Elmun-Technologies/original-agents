import io
import shutil

import pytest
from PIL import Image

from yeppo_agents import media


def jpg(color, size=(800, 800)):
    b = io.BytesIO()
    Image.new("RGB", size, color).save(b, "JPEG")
    return b.getvalue()


ITEM = media.Item(brand="COSRX", name="Advanced Snail 96 Mucin Power Essence", price="189 000 soʻm",
                  photos=[jpg("white"), jpg("pink")], type="Essensiya", volume="100 ml",
                  need="Quruq teriga namlik", points=["Quruqlik, tortishish"], delivery="Toshkent boʻylab 1–2 kunda")


def test_card_sizes():
    assert media.card_main(ITEM).size == (1080, 1350)
    assert media.card_facts(ITEM).size == (1080, 1350)
    assert media.story(ITEM).size == (1080, 1920)


def test_no_facts_card_without_catalog_text():
    assert media.card_facts(media.Item(brand="a", name="b", price="1", photos=[jpg("white")])) is None


def test_packshot_detection():
    assert media.is_packshot(jpg("white"))
    assert not media.is_packshot(jpg("pink"))


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg missing")
def test_reels_mp4(tmp_path):
    import subprocess
    out = media.reels(ITEM, tmp_path / "r.mp4")
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height,codec_name", "-of", "csv=p=0", str(out)],
                           capture_output=True, text=True).stdout
    assert "h264,1080,1920" in probe and "aac" in probe
