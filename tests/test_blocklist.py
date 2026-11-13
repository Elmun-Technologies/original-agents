import pytest

from app.db.models import Product
from app.scraping import blocklist


@pytest.mark.parametrize("text,label", [
    ("Nike Dunk Low replika", "replika"),
    ("Yeezy 350 replikasi bor", "replika"),
    ("Air Max A-kopiya", "a-kopiya"),
    ("a kopiya sifat", "a-kopiya"),
    ("lyuks kopiya", "lyuks"),
    ("LUX COPY", "lyuks"),
    ("kopiyasi zo'r", "kopiya"),
    ("Кроссовки реплика", "replika"),
    ("люкс копия", "lyuks"),
    ("копии из Китая", "kopiya"),
    ("один в один как оригинал", "один в один"),
    ("Quality 1:1", "1:1"),
    ("１：１ quality", "1:1"),        # fullwidth
    ("1 в 1", "1:1"),
    ("1 to 1 copy", "1:1"),
    ("REPLICA shoes", "replica"),
    ("ＲＥＰＬＩＣＡ", "replica"),      # fullwidth
    ("not a fake?", "fake"),
    ("feyk emas", "feyk"),
    ("mirror quality", "mirror quality"),
    ("AAA quality", "aaa quality"),
    ("UA unauthorized authentic", "unauthorized authentic"),
    ("top quality copy", "top copy"),
    ("LJR batch Jordan 4", "batch"),
    ("PK batch", "batch"),
    ("公司级 AJ1", "公司级"),
    ("纯原版本", "纯原"),
    ("原单 尾货", "原单"),
    ("复刻", "复刻"),
    ("高仿鞋", "高仿"),
    ("莆田货源", "莆田"),
    ("1比1", "一比一"),
    ("一比一", "一比一"),
    ("A货", "A货"),
    ("超A品质", "超A"),
    ("工厂尾单", "尾单"),
    ("共享货源", "共享货源"),
    ("顶级版本", "顶级版本"),
    ("https://gxhyapp.com/item/123", "gxhyapp.com"),
])
def test_blocked(text, label):
    assert label in blocklist.find_terms(text)


@pytest.mark.parametrize("text", [
    "Nike Air Force 1 '07 Triple White",
    "New Balance 1906R Silver Metallic",
    "Air Jordan 1 Retro High OG 'Chicago'",
    "Copyright © Nike, Inc.",                  # 'copy' prefix must not trigger
    "Adidas Samba OG, EU 42 2/3",
    "Size chart: EU 41 = 26 cm, 1 1/3",
    "Asics Gel-Kayano 14, 2008 retro colorway",
    "Original, Poizon tekshiruvi, QR sertifikat",
    "Puxovik The North Face 1996 Nuptse",
    "UGG Classic Mini II",
    "Копировальный центр",                     # 'копир' is not 'копия'
    "",
    None,
])
def test_clean(text):
    assert blocklist.find_terms(text) == []


def test_check_reports_every_field_and_word():
    reason = blocklist.check({
        "name": "Nike Dunk Low",
        "description": "纯原 sifat, 1:1",
        "seller_note": "lyuks kopiya",
        "source_url": "https://www.poizon.com/product/x",
    })
    assert reason.startswith("replika: ")
    assert "name" not in reason and "source_url" not in reason
    assert "description='1:1, 纯原'" in reason
    assert "seller_note='kopiya, lyuks'" in reason


def test_check_clean_returns_none():
    assert blocklist.check({"name": "Nike Dunk Low", "description": None}) is None


def mk(**kw):
    base = dict(source="manual_sheet", brand="Nike", model_name="Dunk Low", style_code="DD1391-100",
                category="sneakers", is_active=True)
    return Product(**base | kw)


@pytest.mark.parametrize("field,value,where", [
    ("model_name", "Dunk Low replika", "name"),
    ("colorway", "Panda 1:1", "name"),
    ("description", "高仿 quality", "description"),
    ("seller_note", "A-kopiya, arzon", "seller_note"),
    ("source_url", "https://gxhyapp.com/x", "source_url"),
])
def test_apply_rejects_and_records_reason(field, value, where):
    p = mk(**{field: value})
    assert blocklist.apply(p) is False
    assert p.is_active is False
    assert p.rejected_reason.startswith(f"replika: {where}=")


def test_apply_clean_product_untouched():
    p = mk(description="Classic basketball silhouette", seller_note="EU 42 bor")
    assert blocklist.apply(p) is True
    assert p.is_active is True and p.rejected_reason is None
