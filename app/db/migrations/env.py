from alembic import context

from app.db import make_engine
from app.db.models import Base

# URL: set by caller (tests) via config.set_main_option, else DATABASE_URL env.
url = context.config.get_main_option("sqlalchemy.url") or None
OPTS = dict(target_metadata=Base.metadata, render_as_batch=True, compare_type=True)


if context.is_offline_mode():
    from app import config
    context.configure(url=url or config.env("DATABASE_URL"), literal_binds=True, **OPTS)
    with context.begin_transaction():
        context.run_migrations()
else:
    with make_engine(url).connect() as conn:
        context.configure(connection=conn, **OPTS)
        with context.begin_transaction():
            context.run_migrations()
