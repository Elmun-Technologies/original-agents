import os
import tempfile

# isolate agent data before yeppo_agents.settings is imported
os.environ["YEPPO_DATA_DIR"] = tempfile.mkdtemp(prefix="yeppo-test-")
os.environ.pop("YEPPO_AGENTS_DB_URL", None)

import pytest  # noqa: E402

from yeppo_agents import store  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setenv("YEPPO_AGENTS_DB_URL", f"sqlite:///{tmp_path / 'agents.db'}")
    store.engine.cache_clear()
    yield
    store.engine.cache_clear()
