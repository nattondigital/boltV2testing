# Migration Groups

Combined SQL migration files organized into 14 logical groups for easier deployment.

## Overview

- **Total Migrations**: 143 files combined into 14 groups
- **Total Size**: ~820KB
- **Isolated**: This directory is separate from your main codebase

## Quick Start

### Run in Another Application

Execute group files in order (1-14):

```bash
psql -d your_database -f group-01-foundation-and-core-tables.sql
psql -d your_database -f group-02-additional-foundation-tables.sql
# ... continue through group-14
```

### Export to Individual Files

For Supabase projects or if you need separate files:

```bash
node export-to-individual.cjs
# Creates exported-migrations/ with 143 files

node export-to-individual.cjs /custom/path
# Export to custom directory

node export-to-individual.cjs --dry-run
# Preview without creating files
```

## Groups Overview

1. **Foundation and Core Tables** (8 files) - Base tables, admin system, OTP
2. **Additional Foundation** (8 files) - Sessions, tools access, support, leads
3. **LMS and Configuration** (10 files) - Learning system, WhatsApp, automations
4. **Workflow System** (11 files) - API webhooks, triggers, executions
5. **Support and Attendance** (10 files) - Tickets, attendance, affiliates
6. **Products and Expenses** (6 files) - Product catalog, expenses, leave
7. **Billing System** (11 files) - Estimates, invoices, subscriptions, receipts
8. **Contacts and Sync** (11 files) - Contacts master, media, integrations
9. **Appointments and Calendar** (7 files) - Scheduling system
10. **Tasks Management** (10 files) - Tasks with workflows
11. **Contact Triggers** (5 files) - Contact automation
12. **Pipeline Management** (13 files) - Sales pipelines and stages
13. **Support and Media Updates** (11 files) - AI agents, media storage
14. **Advanced Features** (22 files) - Custom fields, reminders, optimizations

## Important Notes

- **Execute in Order**: Run groups 1→14 sequentially
- **Idempotent**: Safe to re-run if something fails
- **Default Admin**: admin@aiacademy.com / Admin@123 (MUST CHANGE)
- **RLS Enabled**: All tables have Row Level Security

## Files

- `combine-migrations.cjs` - Regenerate group files
- `export-to-individual.cjs` - Export to individual files
- `group-01-*.sql` through `group-14-*.sql` - Combined SQL files

## Verification

After running migrations:

```sql
-- Count tables
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';

-- Verify RLS
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
```

## Regenerate Groups

If you modify individual migrations:

```bash
node combine-migrations.cjs
```

This will recreate all 14 group files from the latest individual migrations.
