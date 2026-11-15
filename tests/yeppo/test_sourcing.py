from decimal import Decimal
from pathlib import Path

from yeppo_agents import sourcing, store
from yeppo_agents.demand import build
from yeppo_agents.fetch import Blocked

FX = Path(__file__).parent / "fixtures"
LISTING = (FX / "qdepot_listing.html").read_text()
PRODUCT = (FX / "qdepot_product.html").read_text()


class FakeFetcher:
    def __init__(self, block_after=None):
        self.urls, self.block_after = [], block_after

    def load_robots(self):
        pass

    def get(self, url):
        self.urls.append(url)
        if self.block_after is not None and len(self.urls) > self.block_after:
            raise Blocked("429 — test")
        return PRODUCT if "/skincare/" in url else LISTING


class FakeCatalog:
    def __init__(self, names=()):
        self.names = names

    def products(self, locale="uz"):
        return [{"name": n, "variants": []} for n in self.names]


def test_run_saves_priced_candidates():
    rep = sourcing.run(FakeCatalog(), FakeFetcher(), rate=Decimal("12500"), demand=build())
    assert rep.listed == 3 and rep.saved >= 1 and not rep.blocked
    c = store.candidates_by_status("new")[0]
    assert c["sell_uzs"] % 1000 == 0 and c["sell_uzs"] > 15 * 12500
    assert c["category"] == "krem"


def test_skips_products_we_already_sell():
    rep = sourcing.run(FakeCatalog(["AHC Ten Revolution Real Eye Cream For Face", "AHC Youth Lasting Real Eye Cream For Face"]),
                       FakeFetcher(), rate=Decimal("12500"), demand=build())
    assert rep.skipped["katalogda bor"] >= 2


def test_block_stops_and_reports():
    f = FakeFetcher(block_after=1)
    rep = sourcing.run(FakeCatalog(), f, rate=Decimal("12500"), demand=build())
    assert rep.blocked and "429" in rep.blocked
    assert len(f.urls) == 2  # nothing after the block


def test_same_product_ignores_volume_and_punctuation():
    assert sourcing.same_product("Beauty of Joseon Revive Serum: Ginseng + Snail Mucin 30ml",
                                 "Beauty of Joseon Revive Serum Ginseng Snail Mucin")
    assert not sourcing.same_product("Anua Heartleaf 77 Toner", "Anua Heartleaf Cleansing Oil")
