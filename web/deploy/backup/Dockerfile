# Daily Postgres + media backup, copied OFF the server with rclone (S3 or Hetzner Storage Box over SFTP).
FROM postgres:16-alpine
RUN apk add --no-cache rclone tzdata
COPY backup.sh restore-test.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore-test.sh
ENTRYPOINT ["backup.sh"]
