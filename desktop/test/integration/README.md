# Integration tests

These tests run the real database engine against disposable database servers
in Docker. They never use a personal, shared or production database.

```powershell
cd desktop
docker compose -f test/integration/docker-compose.yml up -d --wait
$env:NQ_IT = '1'; npm run test:integration; Remove-Item Env:NQ_IT
docker compose -f test/integration/docker-compose.yml down -v
```

The first start downloads several images (SQL Server alone is about 1.6 GB).

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
