-- Drop All - PearlPath Database Reset
-- Run this in Supabase SQL Editor to completely remove all tables and functions

-- Drop triggers
DROP TRIGGER IF EXISTS auto_approve_poi_trigger ON pois CASCADE;
DROP TRIGGER IF EXISTS update_users_updated_at ON users CASCADE;
DROP TRIGGER IF EXISTS update_guides_updated_at ON guides CASCADE;
DROP TRIGGER IF EXISTS update_drivers_updated_at ON drivers CASCADE;
DROP TRIGGER IF EXISTS update_pois_updated_at ON pois CASCADE;
DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings CASCADE;
DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews CASCADE;
DROP TRIGGER IF EXISTS update_community_updates_updated_at ON community_updates CASCADE;
DROP TRIGGER IF EXISTS update_events_updated_at ON events CASCADE;
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments CASCADE;
DROP TRIGGER IF EXISTS update_kyc_verifications_updated_at ON kyc_verifications CASCADE;
DROP TRIGGER IF EXISTS update_reports_updated_at ON reports CASCADE;
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS auto_approve_poi() CASCADE;
DROP FUNCTION IF EXISTS names_are_similar(VARCHAR, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS check_poi_similarity(VARCHAR, DECIMAL, DECIMAL, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS find_nearby_drivers(DECIMAL, DECIMAL, DECIMAL, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS find_nearby_guides(DECIMAL, DECIMAL, DECIMAL, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS kyc_verifications CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS community_updates CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS pois CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS guides CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop extensions
DROP EXTENSION IF EXISTS "postgis" CASCADE;
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;

-- Done! Now run schema.sql to recreate everything
