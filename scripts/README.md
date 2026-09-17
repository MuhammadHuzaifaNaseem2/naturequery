# Operational scripts

This directory contains utilities for development and controlled maintenance.

- Root-level scripts perform named administrative or setup tasks.
- `diagnostics/` contains manually invoked verification programs.
- `sql/legacy/` preserves manual SQL retained for compatibility.
- `sql/samples/` contains synthetic schemas and data for local testing.

Read a script before running it. Administrative scripts can change users, plans, roles, or database state and should always be pointed at an explicit environment.
