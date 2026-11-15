#!/bin/sh
# Every day at BACKUP_HOUR (Asia/Tashkent):
#   1) pg_dump -> /backups/db-YYYY-MM-DD.dump (kept LOCAL_KEEP_DAYS days on the server)
#   2) copy the dump and sync the media folder to the off-site remote "offsite:" (rclone, configured only through
#      RCLONE_CONFIG_OFFSITE_* environment variables — credentials are never written to disk or logs)
#   3) delete off-site dumps older than OFFSITE_KEEP_DAYS
# BACKUP_NOW=1 runs one backup immediately (used for the first test). Failures go to Telegram if configured.
set -u
# compose passes every RCLONE_CONFIG_OFFSITE_* key; empty ones would confuse rclone
for v in $(env | grep -E '^RCLONE_CONFIG_OFFSITE_[A-Z_]+=$' | cut -d= -f1); do unset "$v"; done
: "${BACKUP_HOUR:=03}" "${LOCAL_KEEP_DAYS:=3}" "${OFFSITE_KEEP_DAYS:=14}" "${OFFSITE_PATH:=yeppo}"
mkdir -p /backups

alert() {
  echo "ALERT: $1"
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] || return 0
  for id in $(echo "${TELEGRAM_ADMIN_IDS:-}" | tr ',' ' '); do
    wget -q -O /dev/null "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" --post-data "chat_id=${id}&text=$1" || true
  done
}

offsite_ok() { [ -n "${RCLONE_CONFIG_OFFSITE_TYPE:-}" ]; }

run() {
  day=$(date +%F)
  f="/backups/db-$day.dump"
  if ! pg_dump -Fc -f "$f.tmp"; then rm -f "$f.tmp"; alert "⚠️ Yeppo: baza nusxasi olinmadi ($day)"; return 1; fi
  mv "$f.tmp" "$f"
  echo "backup: $(basename "$f") $(du -h "$f" | cut -f1)"
  if offsite_ok; then
    rclone copy "$f" "offsite:$OFFSITE_PATH/db/" --quiet \
      && rclone sync /media "offsite:$OFFSITE_PATH/media/" --quiet \
      && rclone delete "offsite:$OFFSITE_PATH/db/" --min-age "${OFFSITE_KEEP_DAYS}d" --quiet \
      && echo "backup: copied off-site ($OFFSITE_PATH)" \
      || alert "⚠️ Yeppo: nusxa serverdan tashqariga yuborilmadi ($day)"
  else
    alert "⚠️ Yeppo: tashqi zaxira (RCLONE_CONFIG_OFFSITE_*) sozlanmagan — nusxa faqat serverda ($day)"
  fi
  find /backups -name 'db-*.dump' -mtime +$((LOCAL_KEEP_DAYS - 1)) -delete
  touch "/backups/.done-$day"
}

[ "${BACKUP_NOW:-}" = 1 ] && { run; exit $?; }
echo "backup: every day at ${BACKUP_HOUR}:00, local ${LOCAL_KEEP_DAYS} d, off-site ${OFFSITE_KEEP_DAYS} d"
while :; do
  if [ "$(date +%H)" = "$BACKUP_HOUR" ] && [ ! -f "/backups/.done-$(date +%F)" ]; then run; fi
  find /backups -name '.done-*' -mtime +2 -delete
  sleep 600
done
