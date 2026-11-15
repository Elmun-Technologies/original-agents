#!/bin/sh
# Proves a backup can be restored: takes the newest dump from the off-site copy (or the local one),
# restores it into a throw-away database, counts rows, then drops that database. The live database is not touched.
set -eu
# compose passes every RCLONE_CONFIG_OFFSITE_* key; empty ones would confuse rclone
for v in $(env | grep -E '^RCLONE_CONFIG_OFFSITE_[A-Z_]+=$' | cut -d= -f1); do unset "$v"; done
: "${OFFSITE_PATH:=yeppo}"
mkdir -p /tmp/restore
if [ -n "${RCLONE_CONFIG_OFFSITE_TYPE:-}" ]; then
  latest=$(rclone lsf "offsite:$OFFSITE_PATH/db/" | sort | tail -1)
  rclone copy "offsite:$OFFSITE_PATH/db/$latest" /tmp/restore/ --quiet
  src="off-site"
else
  latest=$(ls /backups | grep '^db-' | sort | tail -1); cp "/backups/$latest" /tmp/restore/; src="local"
fi
db="restore_test_$(date +%s)"
createdb "$db"
pg_restore --no-owner -d "$db" "/tmp/restore/$latest"
echo "restore-test ($src $latest): products=$(psql -tAd "$db" -c 'select count(*) from products') media=$(psql -tAd "$db" -c 'select count(*) from media') orders=$(psql -tAd "$db" -c 'select count(*) from orders')"
dropdb "$db"
rm -rf /tmp/restore
echo "restore-test: OK"
