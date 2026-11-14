#!/bin/sh
# Nightly Postgres backup (runs in the "backup" service, postgres:16-alpine image).
# One pg_dump per day at BACKUP_HOUR (Asia/Tashkent), kept BACKUP_KEEP_DAYS days.
# A failed backup is reported to the admins on Telegram.
set -u
: "${BACKUP_HOUR:=03}" "${BACKUP_KEEP_DAYS:=7}"
mkdir -p /backups

alert() {
  for id in $(echo "${TELEGRAM_ADMIN_IDS:-}" | tr ',' ' '); do
    wget -q -O /dev/null "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --post-data "chat_id=${id}&text=$1" || true
  done
}

echo "backup: every day at ${BACKUP_HOUR}:00, keeping ${BACKUP_KEEP_DAYS} days"
while :; do
  day=$(date +%F)
  if [ "$(date +%H)" = "$BACKUP_HOUR" ] && [ ! -f "/backups/.done-$day" ]; then
    if pg_dump -Fc -f "/backups/db-$day.dump.tmp" && mv "/backups/db-$day.dump.tmp" "/backups/db-$day.dump"; then
      touch "/backups/.done-$day"
      echo "backup ok: db-$day.dump"
    else
      rm -f "/backups/db-$day.dump.tmp"
      alert "⚠️ Kechki baza nusxasi (backup) olinmadi: $day. Server loglarini tekshiring."
    fi
    find /backups -name 'db-*.dump' -mtime +$((BACKUP_KEEP_DAYS - 1)) -delete
    find /backups -name '.done-*' -mtime +$((BACKUP_KEEP_DAYS - 1)) -delete
  fi
  sleep 600
done
