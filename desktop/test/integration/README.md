# Integration tests

These tests run the real database engine against disposable database servers
in Docker. They never use a personal, shared or production database.

There are two batches, so the databases fit in the memory Docker Desktop gives
its virtual machine by default.

**Batch 1: PostgreSQL, MySQL, MariaDB and SQL Server** (`engines.test.ts`)

```powershell
cd desktop
docker compose -f test/integration/docker-compose.yml up -d --wait
$env:NQ_IT = '1'; npx vitest run --config vitest.integration.config.ts test/integration/engines.test.ts; Remove-Item Env:NQ_IT
```

**Batch 2: Oracle, MongoDB, ClickHouse, Cassandra, DynamoDB Local and libSQL**
(`engines-extended.test.ts`)

```powershell
docker compose -f test/integration/docker-compose.yml stop postgres mysql mariadb sqlserver
docker compose -f test/integration/docker-compose.yml --profile extended up -d --wait
$env:NQ_IT_EXTENDED = '1'; npx vitest run --config vitest.integration.config.ts test/integration/engines-extended.test.ts; Remove-Item Env:NQ_IT_EXTENDED
```

Clean up with:

```powershell
docker compose -f test/integration/docker-compose.yml --profile extended down -v
```

The first start downloads several images (Oracle Free is about 6.5 GB and SQL
Server about 1.6 GB). The SSH jump host from batch 1 stays running for both
batches, so every network database is also tested through an SSH tunnel.

What is covered for each database:

- Connecting, and the server version shown in the connection dialog
- Schema discovery: schemas, quoted names, views, primary keys, foreign keys
- Exact values: dates and times without time zone shifts, big integers,
  decimals, JSON, binary, Unicode
- Row limits, including queries that already have their own limit
- Read-only enforcement in the query guard and in the database session
- Canceling a running query, and the query time limit
- Plain-language errors for wrong passwords, unknown databases and closed ports
- Every connection security mode, and SSH tunnels with host key pinning

Snowflake, BigQuery and Firestore have no local server to test against. Their
query parsing, value conversion and error messages are covered by unit tests,
and they need a check against a real account before each release.
