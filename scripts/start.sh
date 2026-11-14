#!/bin/sh
# Container entrypoint: migrate the DB, then run the bot (+ scheduler).
# BOT_HOLD=true: migrate only and wait — used once while importing data from the Mac.
set -e
mkdir -p /app/data
alembic upgrade head
if [ "$BOT_HOLD" = "true" ]; then
  echo "BOT_HOLD=true: baza tayyor, bot ishga tushirilmadi (maʼlumot koʻchirish rejimi)."
  exec sleep infinity
fi
exec python -m app.bot.admin_bot
