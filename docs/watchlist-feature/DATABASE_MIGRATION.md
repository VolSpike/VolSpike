# Database Migration Status for Watchlist Feature

## Schema Status

✅ **Good News: The database schema is already in place!**

The `Watchlist` and `WatchlistItem` models are already defined in the Prisma schema (`prisma/schema.prisma`):

```prisma
model Watchlist {
  id        String   @id @default(cuid())
  userId    String
  name      String
  createdAt DateTime @default(now())

  items WatchlistItem[]
  user  User            @relation(fields: [userId], references: [id])

  @@map("watchlists")
}

model WatchlistItem {
  id          String @id @default(cuid())
  watchlistId String
  contractId  String

  watchlist Watchlist @relation(fields: [watchlistId], references: [id])
  contract  Contract  @relation(fields: [contractId], references: [id])

  @@unique([watchlistId, contractId])
  @@map("watchlist_items")
}
```

## Migration Check

### To Verify Database Schema is Up-to-Date:

1. **Check if tables exist:**
   ```bash
   cd volspike-nodejs-backend
   npx prisma db pull --print | grep -i watchlist
   ```

2. **Check migration status:**
   ```bash
   npx prisma migrate status
   ```

3. **If tables don't exist, run migration:**
   ```bash
   # For development (non-production)
   npx prisma db push
   
   # OR for production (creates migration files)
   npx prisma migrate dev --name add_watchlist_feature
   ```

### Recommended: Add Cascade Delete

The current schema should be updated to include cascade delete behavior for better data integrity. Update the relations:

```prisma
model Watchlist {
  id        String   @id @default(cuid())
  userId    String
  name      String
  createdAt DateTime @default(now())

  items WatchlistItem[]
  user  User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("watchlists")
}

model WatchlistItem {
  id          String @id @default(cuid())
  watchlistId String
  contractId  String

  watchlist Watchlist @relation(fields: [watchlistId], references: [id], onDelete: Cascade)
  contract  Contract  @relation(fields: [contractId], references: [id])

  @@unique([watchlistId, contractId])
  @@map("watchlist_items")
}
```

**Why Cascade Delete?**
- When a user is deleted, their watchlists are automatically deleted
- When a watchlist is deleted, its items are automatically deleted
- Prevents orphaned records

## Migration Steps

### Option 1: Development Database (db push)
```bash
cd volspike-nodejs-backend
npx prisma db push
```

### Option 2: Production Database (migrate)
```bash
cd volspike-nodejs-backend
npx prisma migrate dev --name add_watchlist_cascade_delete
# Review the migration file
npx prisma migrate deploy  # For production
```

## Verification

After migration, verify:

1. **Tables exist:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('watchlists', 'watchlist_items');
   ```

2. **Columns are correct:**
   ```sql
   \d watchlists
   \d watchlist_items
   ```

3. **Foreign keys are set:**
   ```sql
   SELECT 
     tc.table_name, 
     kcu.column_name, 
     ccu.table_name AS foreign_table_name,
     ccu.column_name AS foreign_column_name,
     rc.delete_rule
   FROM information_schema.table_constraints AS tc 
   JOIN information_schema.key_column_usage AS kcu
     ON tc.constraint_name = kcu.constraint_name
   JOIN information_schema.constraint_column_usage AS ccu
     ON ccu.constraint_name = tc.constraint_name
   JOIN information_schema.referential_constraints AS rc
     ON rc.constraint_name = tc.constraint_name
   WHERE tc.table_name IN ('watchlists', 'watchlist_items')
     AND tc.constraint_type = 'FOREIGN KEY';
   ```

## Current Status

✅ **Schema defined** - Models exist in Prisma schema  
⚠️ **Migration needed** - Run `npx prisma db push` or `npx prisma migrate dev`  
⚠️ **Cascade delete** - Recommended to add `onDelete: Cascade` to relations  

## Action Required

**Before deploying to production:**

1. ✅ Verify schema matches code expectations
2. ⚠️ Run database migration: `npx prisma db push` (dev) or `npx prisma migrate deploy` (prod)
3. ⚠️ Consider adding cascade delete for better data integrity
4. ✅ Test watchlist creation/deletion after migration

## Notes

- The schema is already compatible with the implemented code
- No breaking changes needed
- Cascade delete is optional but recommended
- Migration should be non-destructive (only creates new tables if they don't exist)

