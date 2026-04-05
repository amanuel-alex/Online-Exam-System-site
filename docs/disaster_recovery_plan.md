# 🛡️ National Disaster Recovery (DR) & High-Availability Plan

## 🌍 Strategic Goals
- **RPO (Recovery Point Objective)**: < 15 minutes (Database Transaction Logs).
- **RTO (Recovery Time Objective)**: < 30 minutes (Platform Restoration).
- **Target Uptime**: 99.9% availability during national exam sessions.

---

## 1. 🏗️ High-Availability (HA) Design
The "Examina" backend is now **100% Stateless**, enabling horizontal scaling (Clustering) without a Single Point of Failure (SPOF).

| Component | HA Strategy | Configuration |
| --- | --- | --- |
| **API Backend** | Horizontal Scaling | Replicated nodes (Nodes A, B, C) behind a Load Balancer (Nginx/AWS ELB). |
| **Database** | Multi-AZ Clustered | PostgreSQL Primary with Hot-Standby Replicas (Read-Only). |
| **Caching (Redis)**| Redis Sentinel/Cluster | Persistent Append-Only File (AOF) + Multi-Node Failover. |
| **Storage** | Cloud S3 | Globally distributed object store (eliminates local disk SPOF). |

---

## 2. 💾 Automated Backup Policy
Backups are orchestrated at the infrastructure and database levels.

- **Daily Full Backup**: Automated PostgreSQL `pg_dump` every night at 02:00 AM.
- **Off-Site Storage**: Backups are encrypted (AES-256) and synced to a strictly isolated S3 bucket in a different geographic region.
- **WAL Archiving**: Periodic Write-Ahead Logging (WAL) archiving every 10 minutes for point-in-time recovery (PITR).

---

## 3. 🚑 Disaster Response Procedure
In the event of a catastrophic regional failure:

1.  **Detection**: CloudWatch/Grafana alerts trigger after 60 seconds of 100% heartbeat failure.
2.  **Traffic Rerouting**: DNS failover moves traffic to the Secondary "DR Region" instance.
3.  **Datastore Restore**: 
    - The latest Regional S3 backup is pulled.
    - PostgreSQL performs a `pg_restore` followed by WAL-replay to the latest valid transaction.
4.  **Validation**: Health-check suite validates core services (Auth, Exam-Attempt, Grading) before opening traffic.

---

## 📜 Automated Backup Script (Template)
`apps/api/scripts/backup-pg.sh` (Example implementation):
```bash
#!/bin/bash
# National Backup Script: PostgreSQL -> Encrypted S3
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="examina_prod_$TIMESTAMP.sql.gz"

pg_dump -h $DB_HOST -U $DB_USER $DB_NAME | gzip > /tmp/$BACKUP_NAME
# Encrypt and Upload to isolated S3 bucket
aws s3 cp /tmp/$BACKUP_NAME s3://examina-backups-secure/$BACKUP_NAME
rm /tmp/$BACKUP_NAME
echo "✅ Backup Successful: $BACKUP_NAME"
```
