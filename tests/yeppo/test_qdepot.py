from decimal import Decimal
from pathlib import Path

from yeppo_agents import qdepot

FX = Path(__file__).parent / "fixtures"


def test_listing_real_markup():
    items = qdepot.parse_listing((FX / "qdepot_listing.html").read_text())
    assert len(items) == 3
    a = items[0]
    assert a.url.startswith("https://www.q-depot.com/skincare/")
    assert a.brand == "AHC" and a.price_usd == Decimal("23.00") and a.product_id
    assert a.img and a.img.endswith(("500x500.jpg", "500x500.jpeg"))
    assert qdepot.page_count((FX / "qdepot_listing.html").read_text()) == 52


def test_sale_price_uses_new_price():
    page = ('<div class="product-thumb"><span class="stats-label">Brand:</span> <span><a href="x">COSRX</a></span>'
            '<div class="name"><a href="https://www.q-depot.com/a-b-c-d">COSRX Snail Essence 100ml</a></div>'
            '<span class="price-new">$12.00</span><span class="price-old">$16.00</span></div>')
    [it] = qdepot.parse_listing(page)
    assert it.price_usd == Decimal("12.00") and it.old_usd == Decimal("16.00")


def test_product_jsonld():
    d = qdepot.parse_product((FX / "qdepot_product.html").read_text(), "u")
    assert d.brand == "ETUDE" and d.model == "ETUDE2011" and d.price_usd == Decimal("15.00") and d.in_stock
    assert d.images[0].endswith("1000x1000.jpg")


def test_product_out_of_stock():
    page = (FX / "qdepot_product.html").read_text().replace("InStock", "OutOfStock").replace("in-stock", "out-of-stock")
    assert not qdepot.parse_product(page, "u").in_stock


def test_not_a_product():
    assert qdepot.parse_product("<html></html>", "u") is None


def test_volume():
    assert qdepot.volume("Cream 50ml") == "50 ml"
    assert qdepot.volume("Mask 25ml*20pcs") == "25 ml × 20"
    assert qdepot.volume("No volume") is None
