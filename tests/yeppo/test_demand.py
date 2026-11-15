from datetime import date

from yeppo_agents import demand as dm


def test_category_by_whole_words():
    assert dm.category_of("COSRX Pure Fit Cica Creamy Foam Cleanser 150ml") == "tozalash"
    assert dm.category_of("Beauty of Joseon Relief Sun SPF50") == "spf"
    assert dm.category_of("Anua Heartleaf 77 Toner") == "toner"
    assert dm.category_of("Medicube Collagen Night Wrapping Cream") == "krem"
    assert dm.category_of("Hair Brush") is None


def test_skip_makeup():
    assert dm.skipped("Holika Waterdrop Tint Bomb")
    assert not dm.skipped("Anua Heartleaf Toner")


def test_translate_customer_words():
    assert "acne" in dm.translate("husnbuzarga krem")
    assert "cream" in dm.translate("husnbuzarga krem")
    assert "anua" in dm.translate("Anua toner")
    assert "sun" in dm.translate("крем от солнца")
    assert "eye" in dm.translate("koʻz atrofi")


def test_signals_with_reasons():
    d = dm.build(today=date(2026, 7, 10), missed=[("anua toner", 4)], trends=["cica koʻp soʻralyapti"])
    s, why = d.score("Anua Heartleaf 77 Toner 250ml", "toner")
    assert s > 0
    assert any("topilmadi" in w for w in why) and any("mavsum" in w for w in why)
    s2, _ = d.score("Some Cica Cream", "krem")
    assert s2 > 0  # admin trend


def test_holiday_window_crosses_year():
    d = dm.build(today=date(2026, 12, 20))
    assert d.cats.get("toplamlar", 0) >= 3
    assert dm._holiday_active(date(2026, 12, 20), "12-31", 21)
    assert not dm._holiday_active(date(2026, 11, 1), "12-31", 21)


def test_trend_noise_words_dropped_and_summary_keys_clean():
    assert dm.translate("anua toner koʻp soʻralyapti") == ["toner", "anua"]
    d = dm.build(today=date(2026, 7, 1), trends=["anua toner koʻp soʻralyapti"])
    assert all(not line.startswith(":") for line in d.summary())
    assert any(line.startswith("anua:") for line in d.summary())
