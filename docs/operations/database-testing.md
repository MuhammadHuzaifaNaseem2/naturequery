# Database Testing Checklist

Track validation of each supported database before launch.

## How to use

**For local (Docker) databases:**

```bash
# Start all local test DBs
docker compose -f docker-compose.test-dbs.yml up -d

# Or just one
docker compose -f docker-compose.test-dbs.yml up -d mariadb-test

# Test a driver end-to-end (connection + schema + query)
npx tsx scripts/test-db-driver.ts mariadb localhost 3307 testdb testuser testpass
```

**For each database, verify these in the UI:**

1. Add connection (form accepts credentials)
2. Schema loads (tables/columns visible in UI)
3. AI generates SQL from natural language
4. SQL executes and returns rows
5. LIMIT is auto-injected (check result isn't 10k+ rows)
6. Save query works
7. Pin to dashboard works
8. Results export (CSV/Excel) works

---

## Local Docker databases (free, easy)

| DB          | Port  | Status    | Notes                                                                                                           |
| ----------- | ----- | --------- | --------------------------------------------------------------------------------------------------------------- |
| PostgreSQL  | 5432  | ✅ tested | Already in use for app DB                                                                                       |
| MySQL       | 3308  | ✅ tested | User confirmed working                                                                                          |
| SQLite      | file  | ✅ tested | User confirmed working                                                                                          |
| MariaDB     | 3307  | ⬜ test   | Start: `docker compose -f docker-compose.test-dbs.yml up -d mariadb-test`                                       |
| MongoDB     | 27017 | ⬜ test   | Start: `docker compose -f docker-compose.test-dbs.yml up -d mongo-test`                                         |
| ClickHouse  | 8123  | ⬜ test   | Start: `docker compose -f docker-compose.test-dbs.yml up -d clickhouse-test`                                    |
| CockroachDB | 26257 | ⬜ test   | Start: `docker compose -f docker-compose.test-dbs.yml up -d cockroach-test`                                     |
| SQL Server  | 1433  | ⬜ test   | Start: `docker compose -f docker-compose.test-dbs.yml up -d mssql-test`. User=`sa`, Pass=`TestPass123!`         |
| Oracle      | 1521  | ⬜ test   | Start: `docker compose -f docker-compose.test-dbs.yml up -d oracle-test`. Takes ~2 min first boot. SID=`XEPDB1` |

## Cloud databases (sign up for free tier)

| DB                  | Sign-up URL                       | Free tier     | Status              |
| ------------------- | --------------------------------- | ------------- | ------------------- |
| Neon (Postgres)     | https://neon.tech                 | Free          | ⬜ test             |
| PlanetScale (MySQL) | https://planetscale.com           | Free          | ⬜ test             |
| BigQuery            | https://cloud.google.com/bigquery | 1TB/mo free   | ⬜ test             |
| Snowflake           | https://signup.snowflake.com      | 30-day trial  | ⬜ test             |
| Redshift            | https://aws.amazon.com/redshift   | Requires card | ⬜ skip (paid only) |

---

## Test credentials (Docker stack)

All local test DBs use:

- **DB name**: `testdb`
- **Username**: `testuser` (except SQL Server which uses `sa`)
- **Password**: `testpass` (except SQL Server which uses `TestPass123!`)

## Sample data for testing

After connecting, run this to seed sample data (adapt per dialect):

```sql
CREATE TABLE customers (id INT PRIMARY KEY, name VARCHAR(100), email VARCHAR(100), created_at TIMESTAMP);
INSERT INTO customers VALUES (1, 'Alice', 'alice@test.com', NOW()), (2, 'Bob', 'bob@test.com', NOW());

CREATE TABLE orders (id INT PRIMARY KEY, customer_id INT, amount DECIMAL(10,2), status VARCHAR(20));
INSERT INTO orders VALUES (1, 1, 99.99, 'paid'), (2, 1, 49.99, 'pending'), (3, 2, 199.99, 'paid');
```

Then ask the AI: _"Show me total revenue per customer"_ — this tests: schema fetch, JOIN generation, aggregation, result rendering.

---

## Known issues / "SOON" databases

These are marked as "coming soon" in the UI — DO NOT enable until tested:

- IBM Db2
- DuckDB
- Turso
- Cassandra
- DynamoDB
- Firestore

---

## Launch criteria

A database is "launch-ready" when:

- [ ] `test-db-driver.ts` passes all 3 checks
- [ ] Connection form in UI accepts credentials and saves
- [ ] AI generates valid SQL for "list all tables"
- [ ] Query executes and returns data
- [ ] LIMIT auto-injection works (don't return > 1000 rows for regular users)
