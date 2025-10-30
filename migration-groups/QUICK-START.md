# Quick Start

## Run Migrations in New Project

### Option 1: Execute Combined Files (Recommended)

```bash
cd migration-groups

# Run all 14 groups in order
for i in {01..14}; do
    file=$(ls group-$i-*.sql 2>/dev/null | head -1)
    echo "Running $file..."
    psql -d your_database -f "$file" || exit 1
done
```

### Option 2: Export Individual Files

```bash
# Export all 143 files
node export-to-individual.cjs

# Then copy to your Supabase project
cp -r exported-migrations/* /path/to/supabase/migrations/
```

## Important

1. Run groups 1-14 in order
2. Change default admin password after Group 1
   - Email: admin@aiacademy.com  
   - Password: Admin@123
3. All migrations are idempotent (safe to re-run)

## Verify

```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
-- Expected: 50+ tables
```

## Help

- See README.md for full documentation
- Each group file has detailed headers
