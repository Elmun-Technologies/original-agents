import pytest

from app import config
from app.db.models import Product
from app.scraping import blocklist


@pytest.mark.parametrize("text,term", [
    ("Nike Dunk Low replika", "replik"),
    ("Yeezy 350 replikasi bor", "replik"),
    ("Air Max A-kopiya", "kopiya"),
    ("a kopiya sifat", "kopiya"),
    ("lyuks kopiya", "kopiya"),
    ("LUX COPY", "lux copy"),
    ("lux-copy", "lux copy"),
    ("kopiyasi zo'r", "kopiya"),
    ("Кроссовки реплика", "реплик"),
    ("люкс копия", "копия"),
    ("копии из Китая", "копии"),
    ("один в один как оригинал", "один в один"),
    ("Quality 1:1", "1:1"),
    ("１：１ quality", "1:1"),        # fullwidth
    ("1 в 1", "1 в 1"),
    ("1в1", "1 в 1"),
    ("1 to 1", "1 to 1"),
    ("REPLICA shoes", "replic"),
    ("ＲＥＰＬＩＣＡ", "replic"),       # fullwidth
    ("not a fake?", "fake"),
    ("feyk emas", "feyk"),
    ("mirror quality", "mirror quality"),
    ("AAA quality", "aaa"),
    ("UA unauthorized authentic", "unauthorized authentic"),
    ("top quality copy", "quality copy"),
    ("LJR batch Jordan 4", "ljr batch"),
    ("公司级 AJ1", "公司级"),
    ("纯原版本", "纯原"),
    ("原单 尾货", "原单"),
    ("高仿鞋", "高仿"),
    ("莆田货源", "莆田"),
    ("1比1", "1比1"),
    ("一比一", "一比一"),
    ("正品A货", "a货"),                # glued to other Chinese chars
    ("超A品质", "超a"),
    ("工厂尾单", "尾单"),
    ("共享货源", "共享货源"),
    ("顶级版本", "顶级版"),
    ("https://gxhyapp.com/item/123", "gxhyapp.com"),
    ("复刻", "复刻"),                  # external text: blocked
])
def test_blocked(text, term):
    assert term in blocklist.find_terms(text)


@pytest.mark.parametrize("text", [
    "Nike Air Force 1 '07 Triple White",
    "New Balance 1906R Silver Metallic",
    "Air Jordan 1 Retro High OG 'Chicago'",
    "Copyright © Nike, Inc.",                  # exception
    "Копировальный центр",                     # exception
    "Adidas Samba OG, EU 42 2/3",
    "Size chart: EU 41 = 26 cm, 1 1/3",
    "Delivery 11:15",                          # '1:1' must not match inside digits
    "Asics Gel-Kayano 14, 2008 retro colorway",
    "Original, Poizon tekshiruvi, QR sertifikat",
    "Puxovik The North Face 1996 Nuptse",
    "UGG Classic Mini II",
    "",
    None,
])
def test_clean(text):
    assert blocklist.find_terms(text) == []


def test_terms_are_normalized_on_load():
    r = blocklist.build_rules({"common": ["ＲＥＰＬＩＣＡ", "  Fake  "], "external_only": [],
                               "domains": ["GXHYAPP.COM"], "exceptions": ["COPYRIGHT"],
                               "official_sources": []})
    assert [t for t, _ in r.common] == ["replica", "fake"]
    assert blocklist.find_terms("replica fake gxhyapp.com", r) == ["replica", "fake", "gxhyapp.com"]
    assert blocklist.find_terms("Copyright", blocklist.build_rules(
        {"common": ["copy"], "external_only": [], "domains": [], "exceptions": ["COPYRIGHT"],
         "official_sources": []})) == []


def test_real_blocklist_yaml_is_valid():
    r = blocklist.build_rules(config.load_yaml("blocklist.yaml"))
    assert r.common and r.external_only and r.domains and r.exceptions
    assert "poizon_com" in r.official_sources


def test_bad_blocklist_yaml():
    with pytest.raises(config.ConfigError, match="common"):
        blocklist.build_rules({"common": "replika"})


# --- 复刻 (official retro) rule ---

@pytest.mark.parametrize("fields,official,blocked", [
    # official Poizon text: retro release, not a replica
    ({"name": "Air Jordan 1 复刻版 Chicago"}, True, False),
    ({"description": "经典复刻 OG 配色"}, True, False),
    # same word in seller note / external source: rejected
    ({"name": "Air Jordan 1", "seller_note": "复刻"}, True, True),
    ({"name": "Air Jordan 1 复刻版"}, False, True),
    # 复刻 + any common term: rejected anywhere
    ({"name": "AJ1 复刻 1:1"}, True, True),
    ({"description": "复刻 纯原"}, True, True),
    ({"name": "AJ1 复刻版", "seller_note": "lyuks kopiya"}, True, True),
])
def test_fuke_rule(fields, official, blocked):
    assert (blocklist.check(fields, official=official) is not None) == blocked


def test_fuke_with_common_term_reports_both():
    reason = blocklist.check({"name": "AJ1 复刻 1:1"}, official=True)
    assert reason == "replika: name='1:1, 复刻'"


def test_check_reports_every_field_and_word():
    reason = blocklist.check({
        "name": "Nike Dunk Low",
        "description": "纯原 sifat, 1:1",
        "seller_note": "lyuks kopiya",
        "source_url": "https://www.poizon.com/product/x",
    })
    assert reason == "replika: description='1:1, 纯原'; seller_note='kopiya'"


def mk(**kw):
    base = dict(source="manual_sheet", brand="Nike", model_name="Dunk Low", style_code="DD1391-100",
                category="sneakers", is_active=True)
    return Product(**base | kw)


@pytest.mark.parametrize("field,value,where", [
    ("model_name", "Dunk Low replika", "name"),
    ("colorway", "Panda 1:1", "name"),
    ("description", "高仿 quality", "description"),
    ("seller_note", "A-kopiya, arzon", "seller_note"),
    ("seller_note", "复刻", "seller_note"),
    ("source_url", "https://gxhyapp.com/x", "source_url"),
])
def test_apply_rejects_and_records_reason(field, value, where):
    p = mk(**{field: value})
    assert blocklist.apply(p) is False
    assert p.is_active is False
    assert p.rejected_reason.startswith(f"replika: {where}=")


def test_apply_official_fuke_passes():
    p = mk(source="poizon_com", model_name="Air Jordan 1 复刻版", description="经典复刻")
    assert blocklist.apply(p) is True and p.rejected_reason is None


def test_apply_clean_product_untouched():
    p = mk(description="Classic basketball silhouette", seller_note="EU 42 bor")
    assert blocklist.apply(p) is True
    assert p.is_active is True and p.rejected_reason is None
