"""Single entry point for every LLM call (CLAUDE.md §10).

- Model: LLM_MODEL env var (never hard-coded).
- PII guard: customer phone / name / address / email / @username never leave the process.
- Daily budget (settings.yaml llm.daily_budget_usd, Tashkent day): when reached, calls stop
  and the admin is alerted once per day.
- Prompt caching: the stable system prompt carries cache_control; per-call data goes in the
  user message after it.
- Every call is recorded in llm_calls (tokens + cost, no text); rollup_expenses() writes the
  daily total into expenses (type "ai").
"""
import logging
import math
import re
from collections.abc import Callable, Iterable
from datetime import date, datetime, time, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import config
from app.config import TZ
from app.db.models import Expense, LlmCall, Order

log = logging.getLogger(__name__)

FALLBACK_BETA = "server-side-fallback-2026-07-01"
EXPENSE_NOTE = "LLM (auto)"


class LlmError(Exception):
    pass


class LlmBudgetExceeded(LlmError):
    pass


class LlmRefused(LlmError):
    pass


class PiiError(LlmError):
    """Message lists only the kinds of PII found, never the values."""


# --- PII guard -------------------------------------------------------------

_UZ_CODES = "20|33|50|55|61|62|65|66|67|69|70|71|72|73|74|75|76|77|78|79|88|90|91|93|94|95|97|98|99"
_SEP = r"[\s\-.]*"
PII_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("telefon", re.compile(rf"(?<!\d)(?:\+?998{_SEP})?\(?(?:{_UZ_CODES})\)?{_SEP}\d{{3}}{_SEP}\d{{2}}{_SEP}\d{{2}}(?!\d)")),
    ("telefon", re.compile(r"\+\d[\d\s\-()]{8,}\d")),  # any international number
    ("email", re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")),
    ("username", re.compile(r"(?<![\w@])@[A-Za-z][A-Za-z0-9_.]{3,31}")),
    ("manzil", re.compile(r"(?i)\b(?:ko['ʻ‘’`]?cha(?:si)?|kv|xonadon|uy|mavze|улица|ул|дом|кв)\.?\s*[№#]?\s*\d+")),
]


def find_pii(text: str, known: Iterable[str] = (), allowlist: Iterable[str] = ()) -> list[str]:
    """Kinds of PII in text (e.g. ["telefon", "ism"]). known: customer names/contacts from
    the DB, matched as whole words. allowlist: our own public handles."""
    t = text
    for a in allowlist:
        t = t.replace(a, " ")
    kinds = [kind for kind, rx in PII_PATTERNS if rx.search(t)]
    low = t.casefold()
    for k in known:
        k = (k or "").strip().casefold()
        if len(k) >= 3 and re.search(rf"(?<!\w){re.escape(k)}(?!\w)", low):
            kinds.append("ism/kontakt")
            break
    return sorted(set(kinds))


def known_customer_pii(session: Session) -> list[str]:
    # ponytail: loads all customer names/contacts per call; fine for MVP volumes,
    # cache per day if orders grow into the tens of thousands.
    rows = session.execute(select(Order.customer_name, Order.customer_contact).distinct()).all()
    return [v for row in rows for v in row if v]


# --- cost / budget ---------------------------------------------------------

def call_cost(usage, price: dict) -> Decimal:
    per = lambda n, k: Decimal(n or 0) * Decimal(str(price[k]))
    total = (per(usage.input_tokens, "input") + per(usage.output_tokens, "output")
             + per(getattr(usage, "cache_creation_input_tokens", 0), "cache_write")
             + per(getattr(usage, "cache_read_input_tokens", 0), "cache_read"))
    return total / Decimal(1_000_000)


def day_bounds_utc(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time(), TZ).astimezone(timezone.utc)
    end = datetime.combine(date.fromordinal(day.toordinal() + 1), time(), TZ).astimezone(timezone.utc)
    return start, end


def spent_usd(session: Session, day: date) -> Decimal:
    start, end = day_bounds_utc(day)
    total = session.scalar(select(func.sum(LlmCall.cost_usd))
                           .where(LlmCall.created_at >= start, LlmCall.created_at < end))
    return Decimal(total or 0)


def rollup_expenses(session: Session, day: date, usd_rate: Decimal) -> Expense | None:
    """Upserts one expenses row (type "ai") with the day's LLM spend in UZS. Idempotent."""
    usd = spent_usd(session, day)
    row = session.scalar(select(Expense).where(Expense.date == day, Expense.type == "ai",
                                               Expense.note == EXPENSE_NOTE))
    if usd == 0 and row is None:
        return None
    row = row or Expense(date=day, type="ai", note=EXPENSE_NOTE)
    row.amount_uzs = math.ceil(usd * Decimal(usd_rate))
    session.add(row)
    session.flush()
    return row


# --- client ----------------------------------------------------------------

class Llm:
    def __init__(
        self,
        session_factory: Callable[[], Session],
        *,
        client=None,
        alert: Callable[[str], None] | None = None,
        settings: dict | None = None,
    ):
        self.session_factory = session_factory
        self._client = client
        self.alert = alert or (lambda msg: log.warning("ADMIN ALERT: %s", msg))
        self.cfg = (settings or config.settings())["llm"]
        self._alerted_days: set[date] = set()  # ponytail: per-process; one alert per day per process

    @property
    def client(self):
        if self._client is None:
            import anthropic
            self._client = anthropic.Anthropic()
        return self._client

    def _alert_once(self, day: date, msg: str) -> None:
        if day not in self._alerted_days:
            self._alerted_days.add(day)
            self.alert(msg)

    def complete(self, purpose: str, system: str, user: str, *, now: datetime | None = None,
                 max_tokens: int | None = None, effort: str | None = None) -> str:
        """system: stable instructions (cached). user: per-call data. Returns response text."""
        model = config.env("LLM_MODEL")
        prices = self.cfg["prices_per_mtok"]
        if model not in prices:
            raise config.ConfigError(f"LLM_MODEL={model} has no price in settings.yaml llm.prices_per_mtok")
        today = (now or datetime.now(TZ)).astimezone(TZ).date()
        budget = Decimal(str(self.cfg["daily_budget_usd"]))

        with self.session_factory() as s:
            kinds = find_pii(system + "\n" + user, known_customer_pii(s), self.cfg["pii_allowlist"])
            if kinds:
                log.error("LLM call blocked (%s): PII kinds %s", purpose, kinds)
                raise PiiError(f"LLM so'roviga shaxsiy ma'lumot tushgan ({', '.join(kinds)}). So'rov yuborilmadi.")
            if spent_usd(s, today) >= budget:
                msg = f"LLM kunlik limiti (${budget}) tugadi. Yangi so'rovlar ertagacha to'xtatildi."
                self._alert_once(today, msg)
                raise LlmBudgetExceeded(msg)

        kw = {}
        if self.cfg["refusal_fallback"]:
            kw = {"betas": [FALLBACK_BETA], "fallbacks": "default"}
        resp = self.client.beta.messages.create(
            model=model,
            max_tokens=max_tokens or self.cfg["max_tokens"],
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user}],
            output_config={"effort": effort or self.cfg["effort"]},
            **kw,
        )

        served = getattr(resp, "model", None) or model
        if served not in prices:
            log.warning("served model %s has no price; costing at %s prices", served, model)
        u = resp.usage
        cost = call_cost(u, prices.get(served, prices[model]))
        with self.session_factory() as s:
            s.add(LlmCall(purpose=purpose, model=served, input_tokens=u.input_tokens,
                          output_tokens=u.output_tokens,
                          cache_write_tokens=getattr(u, "cache_creation_input_tokens", 0) or 0,
                          cache_read_tokens=getattr(u, "cache_read_input_tokens", 0) or 0,
                          cost_usd=cost, stop_reason=resp.stop_reason,
                          request_id=getattr(resp, "_request_id", None)))
            s.commit()
            spent = spent_usd(s, today)
        log.info("LLM %s model=%s in=%s out=%s cache_w=%s cache_r=%s cost=$%.4f day=$%.4f stop=%s",
                 purpose, served, u.input_tokens, u.output_tokens,
                 getattr(u, "cache_creation_input_tokens", 0), getattr(u, "cache_read_input_tokens", 0),
                 cost, spent, resp.stop_reason)
        if spent >= budget:
            self._alert_once(today, f"LLM kunlik limiti (${budget}) tugadi: bugun ${spent:.2f} sarflandi. "
                                    f"Yangi so'rovlar ertagacha to'xtatildi.")

        if resp.stop_reason == "refusal":
            details = getattr(resp, "stop_details", None)
            raise LlmRefused(f"Model so'rovni rad etdi (kategoriya: {getattr(details, 'category', None)}).")
        if resp.stop_reason == "max_tokens":
            raise LlmError("Javob max_tokens chegarasida kesildi.")
        return "".join(b.text for b in resp.content if b.type == "text")
