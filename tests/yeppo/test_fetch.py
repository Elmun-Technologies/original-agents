import httpx
import pytest

from yeppo_agents.fetch import Blocked, Fetcher, NotAllowed

ROBOTS = "User-agent: *\nDisallow: /*?route=product/search\nDisallow: /*?sort\n"


def make(handler, tmp_path):
    sleeps = []
    f = Fetcher("https://shop.test", sleep=sleeps.append, client=httpx.Client(transport=httpx.MockTransport(handler)),
                cache_dir=tmp_path / "c")
    return f, sleeps


def test_robots_and_pause(tmp_path):
    hits = []

    def h(req):
        hits.append(str(req.url))
        return httpx.Response(200, text=ROBOTS if req.url.path == "/robots.txt" else "<html>ok</html>")
    f, sleeps = make(h, tmp_path)
    assert f.get("https://shop.test/skincare") == "<html>ok</html>"
    assert f.get("https://shop.test/skincare?page=2")
    assert sleeps and all(s > 0 for s in sleeps)  # pause between requests
    with pytest.raises(NotAllowed):
        f.get("https://shop.test/x?sort=p.price")
    with pytest.raises(NotAllowed):
        f.get("https://other.test/a")
    n = len(hits)
    f.get("https://shop.test/skincare")  # cached
    assert len(hits) == n


@pytest.mark.parametrize("status", [403, 429])
def test_stops_on_block(tmp_path, status):
    f, _ = make(lambda req: httpx.Response(200, text="") if req.url.path == "/robots.txt" else httpx.Response(status), tmp_path)
    with pytest.raises(Blocked):
        f.get("https://shop.test/skincare")


def test_stops_on_captcha(tmp_path):
    f, _ = make(lambda req: httpx.Response(200, text="" if req.url.path == "/robots.txt" else "<title>Attention Required! | Cloudflare</title>"), tmp_path)
    with pytest.raises(Blocked):
        f.get("https://shop.test/skincare")


def test_robots_wildcards_like_qdepot():
    from yeppo_agents.fetch import Robots
    r = Robots("User-agent: *\nDisallow: /*&limit\nDisallow: /*?sort\nDisallow: /*?route=account/\nAllow: /\n"
               "User-agent: GPTBot\nDisallow: /\n")
    assert r.allowed("https://x/skincare?page=2")
    assert not r.allowed("https://x/skincare?sort=p.price")
    assert not r.allowed("https://x/index.php?route=account/login")
    assert r.allowed("https://x/etude-house-sunprise")


def test_robots_specific_group_and_end_anchor():
    from yeppo_agents.fetch import Robots
    r = Robots("User-agent: *\nAllow: /\nUser-agent: YeppoBot\nDisallow: /private\nDisallow: /*.pdf$\n")
    assert not r.allowed("https://x/private/a")
    assert not r.allowed("https://x/a/file.pdf")
    assert r.allowed("https://x/a/file.pdf?x=1")
    assert Robots("").allowed("https://x/anything")
