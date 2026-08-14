# Supabase migrations

`manifest.txt` lists the SQL files that are currently present in Git and their application order.

This directory is not yet a complete production baseline. A schema-only dump from the production database must be reviewed and committed before migration readiness can be marked complete. Generate it with the database credentials held outside Git:

```bash
pg_dump "$SUPABASE_DB_URL" --schema-only --no-owner --no-privileges > supabase/schema/current-schema.sql
```

Do not place a database password or service-role key in this repository.
