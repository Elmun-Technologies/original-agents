"""The one place Yeppo agents call Claude: daily budget, cached system prompt, cost log (no text stored).
Only product data goes in — never customer data."""
import logging

import anthropic

from yeppo_agents import store
from yeppo_agents.settings import cfg, env

log = logging.getLogger(__name__)


class LlmError(Exception):
    pass


_client = None


def client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=env("ANTHROPIC_API_KEY", required=True), max_retries=3)
    return _client


def complete(purpose: str, system: str, user: str) -> str:
    c = cfg()["llm"]
    model = env("YEPPO_LLM_MODEL") or c["model"]
    price = c["prices_per_mtok"].get(model)
    if not price:
        raise LlmError(f"{model}: narxi config/yeppo.yaml llm.prices_per_mtok da yo'q")
    if store.llm_spent_today() >= c["daily_budget_usd"]:
        raise LlmError(f"LLM kunlik limiti (${c['daily_budget_usd']}) tugadi")
    resp = client().beta.messages.create(
        model=model, max_tokens=c["max_tokens"],
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": user}],
        output_config={"effort": c["effort"]},
    )
    u = resp.usage
    cw = getattr(u, "cache_creation_input_tokens", 0) or 0
    cr = getattr(u, "cache_read_input_tokens", 0) or 0
    cost = (u.input_tokens * price["input"] + u.output_tokens * price["output"] + cw * price["cache_write"]
            + cr * price["cache_read"]) / 1e6
    store.add_llm_usage(purpose, u.input_tokens + cw + cr, u.output_tokens, cost)
    log.info("LLM %s %s in=%s out=%s $%.4f stop=%s", purpose, model, u.input_tokens, u.output_tokens, cost, resp.stop_reason)
    if resp.stop_reason in ("refusal", "max_tokens"):
        raise LlmError(f"LLM javobi to'liq emas ({resp.stop_reason})")
    return "".join(b.text for b in resp.content if b.type == "text")
