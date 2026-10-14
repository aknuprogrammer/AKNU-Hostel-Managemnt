# AKNU Hostel Management System — Database Backup & Disaster Recovery Guide

## 1. Overview
The database holds critical student credentials, room assignments, and meal audit records. Regular automated backups ensure compliance with university data integrity requirements.

---

## 2. Automated Daily Backup Script (`backup.sh`)

Create `/usr/local/bin/aknu_db_backup.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/aknu_hostels"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/aknu_hostels_${TIMESTAMP}.sql.gz"
DB_NAME="aknu_hostels"
DB_USER="aknu_admin"

mkdir -p ${BACKUP_DIR}

# Execute compressed pg_dump
pg_dump -U ${DB_USER} -h localhost ${DB_NAME} | gzip > ${BACKUP_FILE}

# Set secure permissions
chmod 600 ${BACKUP_FILE}

# Delete backups older than 30 days
find ${BACKUP_DIR} -type f -name "*.sql.gz" -mtime +30 -delete

echo "[$(date)] Backup completed successfully: ${BACKUP_FILE}" >> /var/log/aknu_backup.log
```

Make the script executable:
```bash
chmod +x /usr/local/bin/aknu_db_backup.sh
```

---

## 3. Configure Automated Cron Job

```bash
sudo crontab -e
```
Add the following line to execute backups every night at 02:00 AM:
```cron
0 2 * * * /usr/local/bin/aknu_db_backup.sh
```

---

## 4. Disaster Recovery & Restoration Procedure

If a failure occurs or test restoration is required:

```bash
# 1. Unzip target backup file
gunzip -k /var/backups/aknu_hostels/aknu_hostels_20261012_020000.sql.gz

# 2. Terminate active database connections
sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'aknu_hostels';"

# 3. Drop and recreate database
sudo -u postgres psql -c "DROP DATABASE aknu_hostels;"
sudo -u postgres psql -c "CREATE DATABASE aknu_hostels OWNER aknu_admin;"

# 4. Restore SQL dump
psql -U aknu_admin -d aknu_hostels -h localhost -f /var/backups/aknu_hostels/aknu_hostels_20261012_020000.sql

# 5. Verify database integrity
psql -U aknu_admin -d aknu_hostels -h localhost -c "SELECT COUNT(*) FROM students;"
psql -U aknu_admin -d aknu_hostels -h localhost -c "SELECT COUNT(*) FROM meal_transactions;"
```
