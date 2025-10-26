const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Please check your environment variables.');
}

// Client for regular operations (uses anon key)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side operations (uses service role key)
const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

const connectSupabase = async () => {
  try {
    // Test connection
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist yet
      throw error;
    }
    
    logger.info('Supabase connection established successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect to Supabase:', error.message);
    throw error;
  }
};

// Database helper functions
const db = {
  // User operations
  users: {
    async create(userData) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .insert(userData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async findById(id) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    async findByEmail(email) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    async findByPhone(phone) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    async update(id, updates) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    }
  },

  // Guide operations
  guides: {
    async create(guideData) {
      const { data, error } = await supabaseAdmin
        .from('guides')
        .insert(guideData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async findById(id) {
      const { data, error } = await supabase
        .from('guides')
        .select(`
          *,
          user:users(*)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    async findNearby(lat, lng, radius = 10) {
      const { data, error } = await supabase
        .rpc('find_guides_nearby', {
          user_lat: lat,
          user_lng: lng,
          radius_km: radius
        });
      if (error) throw error;
      return data;
    },

    async update(id, updates) {
      const { data, error } = await supabaseAdmin
        .from('guides')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  // Driver operations
  drivers: {
    async create(driverData) {
      const { data, error } = await supabaseAdmin
        .from('drivers')
        .insert(driverData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async findById(id) {
      const { data, error } = await supabase
        .from('drivers')
        .select(`
          *,
          user:users(*)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    async findNearby(lat, lng, radius = 5) {
      const { data, error } = await supabase
        .rpc('find_drivers_nearby', {
          user_lat: lat,
          user_lng: lng,
          radius_km: radius
        });
      if (error) throw error;
      return data;
    },

    async updateLocation(id, lat, lng) {
      const { data, error } = await supabaseAdmin
        .from('drivers')
        .update({
          current_lat: lat,
          current_lng: lng,
          last_location_update: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  // POI operations
  pois: {
    async create(poiData) {
      const { data, error } = await supabaseAdmin
        .from('pois')
        .insert(poiData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async findById(id) {
      const { data, error } = await supabase
        .from('pois')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    async findNearby(lat, lng, radius = 10, category = null) {
      let query = supabase
        .rpc('find_pois_nearby', {
          user_lat: lat,
          user_lng: lng,
          radius_km: radius
        });
      
      if (category) {
        query = query.eq('category', category);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    async search(query, filters = {}) {
      let dbQuery = supabase
        .from('pois')
        .select('*')
        .textSearch('name', query);
      
      if (filters.category) {
        dbQuery = dbQuery.eq('category', filters.category);
      }
      
      if (filters.city) {
        dbQuery = dbQuery.eq('city', filters.city);
      }
      
      const { data, error } = await dbQuery;
      if (error) throw error;
      return data;
    }
  },

  // Booking operations
  bookings: {
    async create(bookingData) {
      const { data, error } = await supabaseAdmin
        .from('bookings')
        .insert(bookingData)
        .select(`
          *,
          guide:guides(*),
          driver:drivers(*),
          user:users(*)
        `)
        .single();
      if (error) throw error;
      return data;
    },

    async findById(id) {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          guide:guides(*),
          driver:drivers(*),
          user:users(*)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    async findByUser(userId) {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          guide:guides(*),
          driver:drivers(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async update(id, updates) {
      const { data, error } = await supabaseAdmin
        .from('bookings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }
};

module.exports = {
  supabase,
  supabaseAdmin,
  connectSupabase,
  db
};
