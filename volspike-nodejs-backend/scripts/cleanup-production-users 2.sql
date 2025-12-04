-- Production Database Cleanup Script
-- Removes all users except test@volspike.com
-- WARNING: This will permanently delete user data from production

-- Step 1: Delete related records that don't have cascade delete
-- (Watchlist, Alert, Preference tables)

DELETE FROM watchlists 
WHERE "userId" IN (
  SELECT id FROM users 
  WHERE email != 'test@volspike.com'
);

DELETE FROM alerts 
WHERE "userId" IN (
  SELECT id FROM users 
  WHERE email != 'test@volspike.com'
);

DELETE FROM preferences 
WHERE "userId" IN (
  SELECT id FROM users 
  WHERE email != 'test@volspike.com'
);

-- Note: AuditLog records reference users but won't block deletion
-- They may become orphaned, but that's acceptable for audit purposes

-- Step 2: Delete all users except test@volspike.com
-- This will cascade delete: accounts, sessions, verification_tokens, admin_sessions
DELETE FROM users 
WHERE email != 'test@volspike.com';

-- Step 3: Verify the cleanup (should return only 1 row)
SELECT id, email, tier, "createdAt" 
FROM users;

