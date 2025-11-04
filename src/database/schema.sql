-- PearlPath Database Schema for Supabase
-- Sri Lanka Smart Travel Platform

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    language VARCHAR(5) NOT NULL DEFAULT 'en',
    role VARCHAR(20) NOT NULL DEFAULT 'tourist',
    verification_tier INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    profile_image TEXT,
    bio TEXT,
    date_of_birth DATE,
    nationality VARCHAR(50),
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guides table
CREATE TABLE guides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    languages TEXT[] NOT NULL,
    specializations TEXT[] NOT NULL,
    hourly_rate DECIMAL(10,2) NOT NULL,
    bio TEXT NOT NULL,
    experience INTEGER NOT NULL DEFAULT 0,
    license_number VARCHAR(50) NOT NULL,
    vehicle_owned BOOLEAN DEFAULT FALSE,
    max_group_size INTEGER DEFAULT 10,
    available_days TEXT[] NOT NULL,
    working_hours JSONB NOT NULL,
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INTEGER DEFAULT 0,
    total_bookings INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT FALSE,
    current_lat DECIMAL(10,8),
    current_lng DECIMAL(11,8),
    last_location_update TIMESTAMP WITH TIME ZONE,
    portfolio JSONB DEFAULT '[]',
    verification_status VARCHAR(20) DEFAULT 'pending',
    verification_documents JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drivers table
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(20) NOT NULL,
    vehicle_number VARCHAR(20) NOT NULL,
    vehicle_model VARCHAR(100) NOT NULL,
    vehicle_year INTEGER NOT NULL,
    license_number VARCHAR(50) NOT NULL,
    insurance_number VARCHAR(50) NOT NULL,
    max_passengers INTEGER DEFAULT 3,
    base_rate DECIMAL(10,2) NOT NULL,
    per_km_rate DECIMAL(10,2) NOT NULL,
    per_minute_rate DECIMAL(10,2) NOT NULL,
    available_days TEXT[] NOT NULL,
    working_hours JSONB NOT NULL,
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INTEGER DEFAULT 0,
    total_rides INTEGER DEFAULT 0,
    is_online BOOLEAN DEFAULT FALSE,
    current_lat DECIMAL(10,8),
    current_lng DECIMAL(11,8),
    last_location_update TIMESTAMP WITH TIME ZONE,
    verification_status VARCHAR(20) DEFAULT 'pending',
    verification_documents JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Points of Interest table
CREATE TABLE pois (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    entry_fee DECIMAL(10,2) DEFAULT 0.00,
    operating_hours JSONB,
    best_time_to_visit VARCHAR(100),
    accessibility TEXT,
    images TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INTEGER DEFAULT 0,
    visit_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    approval_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, needs_review
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookings table
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guide_id UUID REFERENCES guides(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL,
    booking_reference VARCHAR(20) UNIQUE NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration INTEGER NOT NULL,
    group_size INTEGER NOT NULL DEFAULT 1,
    pickup_location JSONB NOT NULL,
    dropoff_location JSONB,
    special_requests TEXT,
    total_amount DECIMAL(10,2) NOT NULL,
    commission DECIMAL(10,2) DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_id VARCHAR(100),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT,
    refund_amount DECIMAL(10,2) DEFAULT 0.00,
    rating INTEGER,
    review TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews table
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Community Updates table
CREATE TABLE community_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    location JSONB NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',

-- Guide Packages table
CREATE TABLE guide_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guide_id UUID NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('half_day', 'full_day', 'multi_day', 'custom')),
    duration INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    inclusions TEXT[] DEFAULT '{}',
    exclusions TEXT[] DEFAULT '{}',
    max_group_size INTEGER DEFAULT 10,
    available_days TEXT[] DEFAULT '{"monday","tuesday","wednesday","thursday","friday","saturday","sunday"}',
    is_active BOOLEAN DEFAULT TRUE,
    discount_percentage INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Community Updates table
    expires_at TIMESTAMP WITH TIME ZONE,
    images TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    location JSONB NOT NULL,
    category VARCHAR(50) NOT NULL,
    entry_fee DECIMAL(10,2) DEFAULT 0.00,
    max_attendees INTEGER,
    images TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'LKR',
    payment_method VARCHAR(50) NOT NULL,
    payment_intent_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    transaction_id VARCHAR(100),
    gateway_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- KYC Verifications table
CREATE TABLE kyc_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier INTEGER NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    document_number VARCHAR(100) NOT NULL,
    document_image TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reports table
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reported_booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    reported_poi_id UUID REFERENCES pois(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    handled_by UUID REFERENCES users(id),
    handled_at TIMESTAMP WITH TIME ZONE,
    resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_verification_tier ON users(verification_tier);

CREATE INDEX idx_guides_user_id ON guides(user_id);
CREATE INDEX idx_guides_location ON guides(current_lat, current_lng);
CREATE INDEX idx_guides_available ON guides(is_available);
CREATE INDEX idx_guides_rating ON guides(rating);

CREATE INDEX idx_drivers_user_id ON drivers(user_id);
CREATE INDEX idx_drivers_location ON drivers(current_lat, current_lng);
CREATE INDEX idx_drivers_online ON drivers(is_online);
CREATE INDEX idx_drivers_rating ON drivers(rating);

CREATE INDEX idx_pois_location ON pois(latitude, longitude);
CREATE INDEX idx_pois_category ON pois(category);
CREATE INDEX idx_pois_city ON pois(city);
CREATE INDEX idx_pois_rating ON pois(rating);

CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_guide_id ON bookings(guide_id);
CREATE INDEX idx_bookings_driver_id ON bookings(driver_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_dates ON bookings(start_date, end_date);

CREATE INDEX idx_reviews_booking_id ON reviews(booking_id);
CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);

CREATE INDEX idx_community_updates_type ON community_updates(type);
CREATE INDEX idx_community_updates_location ON community_updates USING gin(location);
CREATE INDEX idx_community_updates_status ON community_updates(status);

CREATE INDEX idx_events_dates ON events(start_date, end_date);
CREATE INDEX idx_events_category ON events(category);
CREATE INDEX idx_events_location ON events USING gin(location);

CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);

CREATE INDEX idx_kyc_user_id ON kyc_verifications(user_id);
CREATE INDEX idx_kyc_status ON kyc_verifications(status);

CREATE INDEX idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX idx_reports_status ON reports(status);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- Create functions for location-based queries
CREATE OR REPLACE FUNCTION find_guides_nearby(
    user_lat DECIMAL,
    user_lng DECIMAL,
    radius_km INTEGER
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    languages TEXT[],
    specializations TEXT[],
    hourly_rate DECIMAL,
    bio TEXT,
    experience INTEGER,
    rating DECIMAL,
    total_reviews INTEGER,
    is_available BOOLEAN,
    distance_km DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.user_id,
        g.languages,
        g.specializations,
        g.hourly_rate,
        g.bio,
        g.experience,
        g.rating,
        g.total_reviews,
        g.is_available,
        ROUND(
            6371 * acos(
                cos(radians(user_lat)) * 
                cos(radians(g.current_lat)) * 
                cos(radians(g.current_lng) - radians(user_lng)) + 
                sin(radians(user_lat)) * 
                sin(radians(g.current_lat))
            )::DECIMAL, 2
        ) AS distance_km
    FROM guides g
    WHERE g.current_lat IS NOT NULL 
        AND g.current_lng IS NOT NULL
        AND (
            6371 * acos(
                cos(radians(user_lat)) * 
                cos(radians(g.current_lat)) * 
                cos(radians(g.current_lng) - radians(user_lng)) + 
                sin(radians(user_lat)) * 
                sin(radians(g.current_lat))
            )
        ) <= radius_km
    ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION find_drivers_nearby(
    user_lat DECIMAL,
    user_lng DECIMAL,
    radius_km INTEGER
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    vehicle_type VARCHAR,
    vehicle_model VARCHAR,
    rating DECIMAL,
    total_reviews INTEGER,
    is_online BOOLEAN,
    distance_km DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.user_id,
        d.vehicle_type,
        d.vehicle_model,
        d.rating,
        d.total_reviews,
        d.is_online,
        ROUND(
            6371 * acos(
                cos(radians(user_lat)) * 
                cos(radians(d.current_lat)) * 
                cos(radians(d.current_lng) - radians(user_lng)) + 
                sin(radians(user_lat)) * 
                sin(radians(d.current_lat))
            )::DECIMAL, 2
        ) AS distance_km
    FROM drivers d
    WHERE d.current_lat IS NOT NULL 
        AND d.current_lng IS NOT NULL
        AND (
            6371 * acos(
                cos(radians(user_lat)) * 
                cos(radians(d.current_lat)) * 
                cos(radians(d.current_lng) - radians(user_lng)) + 
                sin(radians(user_lat)) * 
                sin(radians(d.current_lat))
            )
        ) <= radius_km
    ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION find_pois_nearby(
    user_lat DECIMAL,
    user_lng DECIMAL,
    radius_km INTEGER
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    description TEXT,
    category VARCHAR,
    latitude DECIMAL,
    longitude DECIMAL,
    address TEXT,
    city VARCHAR,
    entry_fee DECIMAL,
    rating DECIMAL,
    total_reviews INTEGER,
    distance_km DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.description,
        p.category,
        p.latitude,
        p.longitude,
        p.address,
        p.city,
        p.entry_fee,
        p.rating,
        p.total_reviews,
        ROUND(
            6371 * acos(
                cos(radians(user_lat)) * 
                cos(radians(p.latitude)) * 
                cos(radians(p.longitude) - radians(user_lng)) + 
                sin(radians(user_lat)) * 
                sin(radians(p.latitude))
            )::DECIMAL, 2
        ) AS distance_km
    FROM pois p
    WHERE p.status = 'active'
        AND (
            6371 * acos(
                cos(radians(user_lat)) * 
                cos(radians(p.latitude)) * 
                cos(radians(p.longitude) - radians(user_lng)) + 
                sin(radians(user_lat)) * 
                sin(radians(p.latitude))
            )
        ) <= radius_km
    ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guides_updated_at BEFORE UPDATE ON guides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pois_updated_at BEFORE UPDATE ON pois
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Location-based functions for nearby drivers and guides
CREATE OR REPLACE FUNCTION find_nearby_drivers(
    user_lat DECIMAL,
    user_lng DECIMAL,
    radius_km DECIMAL DEFAULT 10,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    vehicle_type VARCHAR,
    vehicle_number VARCHAR,
    base_rate DECIMAL,
    rating DECIMAL,
    distance_km DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.user_id,
        d.vehicle_type,
        d.vehicle_number,
        d.base_rate,
        d.rating,
        (
            6371 * acos(
                cos(radians(user_lat)) * 
                cos(radians(d.current_lat)) * 
                cos(radians(d.current_lng) - radians(user_lng)) + 
                sin(radians(user_lat)) * 
                sin(radians(d.current_lat))
            )
        )::DECIMAL(10,2) AS distance_km
    FROM drivers d
    WHERE d.is_online = TRUE
        AND d.current_lat IS NOT NULL
        AND d.current_lng IS NOT NULL
        AND (
            6371 * acos(
                cos(radians(user_lat)) * 
                cos(radians(d.current_lat)) * 
                cos(radians(d.current_lng) - radians(user_lng)) + 
                sin(radians(user_lat)) * 
                sin(radians(d.current_lat))
            )
        ) <= radius_km
    ORDER BY distance_km
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION find_nearby_guides(
    user_lat DECIMAL,
    user_lng DECIMAL,
    radius_km DECIMAL DEFAULT 10,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    languages TEXT[],
    hourly_rate DECIMAL,
    rating DECIMAL,
    distance_km DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.user_id,
        g.languages,
        g.hourly_rate,
        g.rating,
        (
            6371 * acos(
                cos(radians(user_lat)) * 
                cos(radians(g.current_lat)) * 
                cos(radians(g.current_lng) - radians(user_lng)) + 
                sin(radians(user_lat)) * 
                sin(radians(g.current_lat))
            )
        )::DECIMAL(10,2) AS distance_km
    FROM guides g
    WHERE g.is_available = TRUE
        AND g.current_lat IS NOT NULL
        AND g.current_lng IS NOT NULL
        AND (
            6371 * acos(
                cos(radians(user_lat)) * 
                cos(radians(g.current_lat)) * 
                cos(radians(g.current_lng) - radians(user_lng)) + 
                sin(radians(user_lat)) * 
                sin(radians(g.current_lat))
            )
        ) <= radius_km
    ORDER BY distance_km
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check if POI is similar to existing POIs (for admin approval)
CREATE OR REPLACE FUNCTION check_poi_similarity(
    poi_name VARCHAR,
    poi_lat DECIMAL,
    poi_lng DECIMAL,
    similarity_threshold DECIMAL DEFAULT 0.3, -- Location radius in km (300 meters)
    name_similarity_threshold DECIMAL DEFAULT 0.7 -- Name similarity ratio (70% similar)
)
RETURNS BOOLEAN AS $$
DECLARE
    similar_count INTEGER;
    normalized_new_name VARCHAR;
    normalized_existing_name VARCHAR;
BEGIN
    -- Normalize names: lowercase, trim, remove extra spaces
    normalized_new_name := LOWER(TRIM(REGEXP_REPLACE(poi_name, '\s+', ' ', 'g')));
    
    SELECT COUNT(*) INTO similar_count
    FROM pois p
    WHERE p.status IN ('active', 'approved')
        AND (
            -- Check location proximity (within 300 meters by default)
            (
                6371 * acos(
                    cos(radians(poi_lat)) * 
                    cos(radians(p.latitude)) * 
                    cos(radians(p.longitude) - radians(poi_lng)) + 
                    sin(radians(poi_lat)) * 
                    sin(radians(p.latitude))
                )
            ) <= similarity_threshold
            OR
            -- Check name similarity (normalized, case-insensitive)
            (
                LENGTH(normalized_new_name) > 0 
                AND LENGTH(p.name) > 0
                AND (
                    -- Exact match (case-insensitive)
                    normalized_new_name = LOWER(TRIM(REGEXP_REPLACE(p.name, '\s+', ' ', 'g')))
                    OR
                    -- Similarity check: normalized Levenshtein distance
                    (
                        ABS(LENGTH(normalized_new_name) - LENGTH(LOWER(TRIM(REGEXP_REPLACE(p.name, '\s+', ' ', 'g')))))::DECIMAL /
                        GREATEST(LENGTH(normalized_new_name), LENGTH(LOWER(TRIM(REGEXP_REPLACE(p.name, '\s+', ' ', 'g')))))::DECIMAL
                    ) <= (1 - name_similarity_threshold)
                )
            )
        );
    
    RETURN similar_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to check if names are similar (handles common variations)
CREATE OR REPLACE FUNCTION names_are_similar(
    name1 VARCHAR,
    name2 VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    norm_name1 VARCHAR;
    norm_name2 VARCHAR;
    similarity_ratio DECIMAL;
BEGIN
    -- Normalize both names
    norm_name1 := LOWER(TRIM(REGEXP_REPLACE(name1, '[^a-zA-Z0-9\s]', '', 'g')));
    norm_name2 := LOWER(TRIM(REGEXP_REPLACE(name2, '[^a-zA-Z0-9\s]', '', 'g')));
    
    -- Remove common words for comparison
    norm_name1 := REGEXP_REPLACE(norm_name1, '\b(temple|shrine|museum|park|beach|lake|mountain|hill|river|cave)\b', '', 'gi');
    norm_name2 := REGEXP_REPLACE(norm_name2, '\b(temple|shrine|museum|park|beach|lake|mountain|hill|river|cave)\b', '', 'gi');
    
    -- Trim extra spaces
    norm_name1 := TRIM(REGEXP_REPLACE(norm_name1, '\s+', ' ', 'g'));
    norm_name2 := TRIM(REGEXP_REPLACE(norm_name2, '\s+', ' ', 'g'));
    
    -- Calculate similarity based on common characters
    IF norm_name1 = norm_name2 THEN
        RETURN TRUE;
    END IF;
    
    -- If one is substring of another or vice versa
    IF POSITION(norm_name1 IN norm_name2) > 0 OR POSITION(norm_name2 IN norm_name1) > 0 THEN
        RETURN TRUE;
    END IF;
    
    -- Check length similarity (if close in length and share most chars)
    similarity_ratio := LEAST(LENGTH(norm_name1), LENGTH(norm_name2))::DECIMAL / 
                        GREATEST(LENGTH(norm_name1), LENGTH(norm_name2))::DECIMAL;
    
    IF similarity_ratio > 0.6 THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically approve or flag POIs
CREATE OR REPLACE FUNCTION auto_approve_poi()
RETURNS TRIGGER AS $$
DECLARE
    similar_count INTEGER;
    close_poi_count INTEGER;
BEGIN
    -- Check for POIs within 300 meters
    SELECT COUNT(*) INTO close_poi_count
    FROM pois p
    WHERE p.status IN ('active', 'approved')
        AND (
            6371 * acos(
                cos(radians(NEW.latitude)) * 
                cos(radians(p.latitude)) * 
                cos(radians(p.longitude) - radians(NEW.longitude)) + 
                sin(radians(NEW.latitude)) * 
                sin(radians(p.latitude))
            )
        ) <= 0.3;
    
    -- If there's a POI within 300 meters, check if names are similar
    IF close_poi_count > 0 THEN
        SELECT COUNT(*) INTO similar_count
        FROM pois p
        WHERE p.status IN ('active', 'approved')
            AND (
                6371 * acos(
                    cos(radians(NEW.latitude)) * 
                    cos(radians(p.latitude)) * 
                    cos(radians(p.longitude) - radians(NEW.longitude)) + 
                    sin(radians(NEW.latitude)) * 
                    sin(radians(p.latitude))
                )
            ) <= 0.3
            AND names_are_similar(NEW.name, p.name);
        
        IF similar_count > 0 THEN
            -- Flag for admin review if similar name and location
            NEW.approval_status := 'needs_review';
        ELSE
            -- Same location but different name - auto approve
            NEW.approval_status := 'approved';
        END IF;
    ELSE
        -- No POI nearby - auto approve
        NEW.approval_status := 'approved';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically set approval status on insert
DROP TRIGGER IF EXISTS auto_approve_poi_trigger ON pois;
CREATE TRIGGER auto_approve_poi_trigger
    BEFORE INSERT ON pois
    FOR EACH ROW
    EXECUTE FUNCTION auto_approve_poi();

-- Create index for location-based queries
CREATE INDEX idx_pois_approval_status ON pois(approval_status);
CREATE INDEX idx_pois_location ON pois(latitude, longitude);

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_updates_updated_at BEFORE UPDATE ON community_updates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kyc_verifications_updated_at BEFORE UPDATE ON kyc_verifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic examples)
CREATE POLICY "Users can view their own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public can view active POIs" ON pois
    FOR SELECT USING (status = 'active');

CREATE POLICY "Authenticated users can create POIs" ON pois
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Insert sample data (optional)
INSERT INTO users (email, password, first_name, last_name, phone, language, role, verification_tier, status, nationality) VALUES
('admin@pearlpath.lk', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4QZqK2O', 'Admin', 'User', '+94771234567', 'en', 'admin', 3, 'active', 'Sri Lankan'),
('guide@pearlpath.lk', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4QZqK2O', 'Nuwan', 'Perera', '+94771234568', 'en', 'guide', 3, 'active', 'Sri Lankan'),
('driver@pearlpath.lk', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4QZqK2O', 'Kasun', 'Silva', '+94771234569', 'en', 'driver', 3, 'active', 'Sri Lankan'),
('tourist@pearlpath.lk', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4QZqK2O', 'John', 'Smith', '+1234567890', 'en', 'tourist', 1, 'active', 'American');

-- Note: The password hash above is for 'password123' - change this in production!
