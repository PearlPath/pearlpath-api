# PearlPath API - Sri Lanka Smart Travel Platform

A backend API for the Sri Lanka Smart Travel Platform, built with Node.js, Express, and Supabase.

## Features

### Core Modules
- **Interactive Map & Points of Interest** - Trilingual POI database with real-time updates
- **Verified Guide Marketplace** - Location-based guide discovery with KYC verification
- **Transparent Transportation** - Tuk-tuk discovery with dynamic pricing
- **Community News & Events** - Time-sensitive updates and event calendar
- **Safety & Trust Framework** - Multi-tier verification and safety features

### Key Features
- JWT-based authentication with role-based access control
- Trilingual support (English/Sinhala/Tamil)
- Location-based services with geospatial queries
- Payment integration with PayHere
- Real-time notifications
- Security and validation
- Analytics and reporting
- Offline functionality support

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Cache**: In-memory (no external dependencies)
- **Authentication**: JWT
- **Payments**: PayHere
- **File Upload**: Multer + Sharp
- **Validation**: Joi
- **Logging**: Winston
- **Testing**: Jest

## Project Structure

```
src/
├── app.js                 # Main application entry point
├── config/                # Configuration files
│   ├── database.js        # Database configuration
│   ├── cache.js          # In-memory cache configuration
│   └── supabase.js       # Supabase configuration
├── controllers/           # Route controllers
│   └── authController.js  # Authentication controller
├── database/              # Database related files
│   └── schema.sql        # Database schema
├── middleware/            # Custom middleware
│   ├── authMiddleware.js  # Authentication middleware
│   ├── errorMiddleware.js # Error handling middleware
│   └── validationMiddleware.js # Validation middleware
├── models/                # Data models
│   ├── User.js           # User model
│   ├── Guide.js          # Guide model
│   ├── Driver.js         # Driver model
│   ├── POI.js            # Point of Interest model
│   └── Booking.js        # Booking model
├── routes/                # API routes
│   ├── authRoutes.js     # Authentication routes
│   ├── userRoutes.js     # User routes
│   ├── guideRoutes.js    # Guide routes
│   ├── driverRoutes.js   # Driver routes
│   ├── poiRoutes.js      # POI routes
│   ├── bookingRoutes.js  # Booking routes
│   ├── communityRoutes.js # Community routes
│   ├── paymentRoutes.js  # Payment routes
│   └── adminRoutes.js    # Admin routes
└── utils/                 # Utility functions
    ├── helpers.js        # Helper functions
    ├── logger.js         # Logging utility
    └── validation.js     # Validation schemas
```

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pearlpath-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Supabase Configuration
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # JWT Configuration
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRES_IN=7d
   REFRESH_TOKEN_SECRET=your_refresh_token_secret
   REFRESH_TOKEN_EXPIRES_IN=30d

   # PayHere Configuration
   PAYHERE_MERCHANT_ID=your_payhere_merchant_id
   PAYHERE_MERCHANT_SECRET=your_payhere_merchant_secret
   PAYHERE_NOTIFY_URL=https://your-domain.com/api/payments/notify
   PAYHERE_RETURN_URL=https://your-domain.com/payment/success
   PAYHERE_CANCEL_URL=https://your-domain.com/payment/cancel
   BASE_URL=https://your-domain.com
   FRONTEND_URL=https://your-frontend-domain.com

   # Add other required environment variables...
   ```

4. **Database Setup**
   - Create a new Supabase project at https://supabase.com
   - Open SQL Editor in your Supabase dashboard
   - If starting fresh: Run `src/database/schema.sql` to create all tables
   - If resetting: Run `src/database/drop_all.sql` first, then `src/database/schema.sql`
   - Update your Supabase credentials in the `.env` file

5. **Start the development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

## API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication
Most endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Main Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh-token` - Refresh access token
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/logout` - Logout user

#### Guides
- `GET /api/guides/search` - Search guides nearby
- `POST /api/guides` - Create guide profile
- `GET /api/guides/:id` - Get guide details
- `PUT /api/guides/:id` - Update guide profile

#### Drivers
- `GET /api/drivers/nearby` - Find nearby drivers
- `POST /api/drivers` - Create driver profile
- `GET /api/drivers/:id` - Get driver details
- `PUT /api/drivers/:id` - Update driver profile

#### Points of Interest
- `GET /api/pois/search` - Search POIs
- `GET /api/pois/nearby` - Find nearby POIs
- `POST /api/pois` - Create POI
- `GET /api/pois/:id` - Get POI details

#### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/:id` - Get booking details
- `PUT /api/bookings/:id` - Update booking
- `POST /api/bookings/:id/cancel` - Cancel booking

#### Community
- `GET /api/community/updates` - Get community updates
- `POST /api/community/updates` - Create community update
- `GET /api/community/events` - Get events
- `POST /api/community/events` - Create event

#### Payments
- `POST /api/payments/create-request` - Create PayHere payment request
- `POST /api/payments/notify` - PayHere notification webhook
- `GET /api/payments/status/:orderId` - Get payment status
- `GET /api/payments/methods` - Get available payment methods
- `GET /api/payments/history` - Get payment history
- `POST /api/payments/refund` - Request payment refund

## Development

### Available Scripts

```bash
# Start development server
npm run dev

# Start production server
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run database migrations
npm run migrate

# Seed database
npm run seed
```

### Code Structure

The project follows MVC (Model-View-Controller) architecture:

- **Models**: Data models with business logic
- **Controllers**: Handle HTTP requests and responses
- **Routes**: Define API endpoints
- **Middleware**: Handle cross-cutting concerns
- **Services**: Business logic services
- **Utils**: Helper functions and utilities

### Database Models

- **User**: User accounts with role-based access
- **Guide**: Professional tour guides
- **Driver**: Transportation providers
- **POI**: Points of Interest
- **Booking**: Service bookings
- **Review**: User reviews and ratings
- **CommunityUpdate**: Community-sourced updates
- **Event**: Local events and festivals
- **Payment**: Payment transactions
- **KYCVerification**: Identity verification

## Security

- JWT-based authentication
- Role-based access control (RBAC)
- Input validation and sanitization
- Rate limiting
- CORS protection
- Helmet.js security headers
- Password hashing with bcrypt
- SQL injection prevention
- XSS protection

## Monitoring & Logging

- Winston for structured logging
- Error tracking and reporting
- Performance monitoring
- Health check endpoints

## Deployment

### Environment Variables

Ensure all required environment variables are set in production:

```env
NODE_ENV=production
PORT=3000
SUPABASE_URL=your_production_supabase_url
SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
JWT_SECRET=your_production_jwt_secret
PAYHERE_MERCHANT_ID=your_production_payhere_merchant_id
PAYHERE_MERCHANT_SECRET=your_production_payhere_merchant_secret
# ... other production variables
```

### Production Checklist

- [ ] Set up production Supabase database
- [ ] Set up monitoring and logging
- [ ] Configure SSL/TLS
- [ ] Set up backup strategies
- [ ] Configure rate limiting
- [ ] Set up error tracking
- [ ] Test all endpoints
- [ ] Performance testing
- [ ] Security audit

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## Roadmap

- [ ] Mobile app integration
- [ ] Real-time chat system
- [ ] Advanced analytics dashboard
- [ ] Multi-language support expansion
- [ ] AI-powered recommendations
- [ ] Offline functionality
- [ ] Social features
- [ ] Loyalty program
- [ ] Corporate partnerships
- [ ] Regional expansion

---

**PearlPath API** - Connecting travelers with authentic Sri Lankan experiences