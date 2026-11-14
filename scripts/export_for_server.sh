#!/bin/sh
# Mac -> server move, step 1 (see docs/deploy_coolify.md).
# Stops the bot on this Mac (so nothing changes while copying and two bots never run at once),
# then packs the SQLite DB and the photo/post folders into data/export-<time>.tgz.
set -e
cd "$(dirname "$0")/.."

if pkill -f "app.bot.admin_bot"; then
  echo "Mac'dagi bot to'xtatildi."
  sleep 2
else
  echo "Mac'da bot ishlamayapti."
fi

uv run --env-file .env alembic upgrade head
out="data/export-$(date +%Y%m%d-%H%M).tgz"
items="app.db"
for x in photos posts screens reports cbu_usd.json cbu_cny.json; do
  [ -e "data/$x" ] && items="$items $x"
done
COPYFILE_DISABLE=1 tar czf "$out" --exclude='screens/preview' -C data $items
echo "Tayyor: $out ($(du -h "$out" | cut -f1))"
echo "Endi uni serverga yuboring: docs/deploy_coolify.md, 4-qadam."
