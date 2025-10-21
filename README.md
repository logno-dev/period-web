# Period Tracker Web App

A comprehensive web-based period tracking application built with SolidStart, featuring calendar visualization, cycle predictions, and statistical analysis. This is a web port of the React Native period tracker app with enhanced features and cloud storage.

## Features

- **📅 Interactive Calendar**: Visual period tracking with cycle phase indicators
- **🔮 Smart Predictions**: AI-powered next period predictions with confidence levels
- **📊 Detailed Statistics**: Period length, cycle duration, and historical data analysis
- **🎨 Cycle Phase Visualization**: Color-coded calendar showing menstrual, follicular, ovulation, and luteal phases
- **🔐 User Authentication**: Secure email/password and OAuth login
- **☁️ Cloud Storage**: Data stored securely in Turso database
- **📱 Responsive Design**: Works perfectly on mobile and desktop

## Tech Stack

- **Frontend**: SolidJS with SolidStart
- **Database**: Turso (SQLite in the cloud)
- **ORM**: Drizzle ORM
- **Authentication**: Built-in SolidStart auth with OAuth support
- **Styling**: TailwindCSS
- **TypeScript**: Full type safety

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Add your Turso database credentials
   - Optionally add Discord OAuth credentials for social login

3. Set up the database:
   ```bash
   # Generate database migration
   npm run db:generate
   
   # Push schema to Turso
   npm run db:push
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Configuration

### Required Variables

```env
# Session Security
SESSION_SECRET=your-session-secret

# Turso Database
TURSO_DATABASE_URL=your-turso-database-url
TURSO_AUTH_TOKEN=your-turso-auth-token
```

### Optional Variables (for OAuth)

```env
# Discord OAuth (optional)
DISCORD_ID=your-discord-client-id
DISCORD_SECRET=your-discord-client-secret
```

## Database Setup

1. **Create a Turso Database**:
   - Sign up at [turso.tech](https://turso.tech)
   - Create a new database
   - Get your database URL and auth token

2. **Configure Environment**:
   - Add the URL and token to your `.env` file

3. **Initialize Schema**:
   ```bash
   npm run db:push
   ```

## Features Overview

### Calendar Interface
- **Period Marking**: Dark pink highlighting for menstrual days
- **Cycle Phases**: Color-coded indicators for follicular (light pink), ovulation (blue), and luteal (purple) phases
- **Interactive**: Click any date to start/end periods or view existing data
- **Predictions**: Light pink highlighting for predicted period start dates

### Statistics Dashboard
- **Average Calculations**: Automatic computation of average period length and cycle duration
- **Historical Data**: Complete history of all tracked periods
- **Cycle Analysis**: Detailed breakdown of cycle lengths and variations
- **Data Insights**: Visual cards showing trends and patterns

### Smart Predictions
- **Confidence Levels**: High, medium, and low confidence ratings based on data consistency
- **Multiple Factors**: Considers cycle regularity, historical patterns, and data quality
- **Real-time Updates**: Predictions update automatically as new data is added

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Calendar.tsx     # Custom calendar component
│   ├── Modal.tsx        # Modal dialog component
│   └── CyclePhaseLegend.tsx
├── db/                  # Database layer
│   ├── schema.ts        # Drizzle schema definitions
│   ├── index.ts         # Database connection
│   └── periods.ts       # Period CRUD operations
├── routes/              # SolidStart routes
│   ├── api/             # API endpoints
│   ├── index.tsx        # Home page
│   └── stats.tsx        # Statistics page
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
└── auth/                # Authentication logic
```

## API Endpoints

- `GET /api/periods` - Fetch user's periods
- `POST /api/periods` - Create new period
- `PUT /api/periods` - Update existing period
- `DELETE /api/periods` - Delete period

## Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run db:generate  # Generate database migrations
npm run db:push      # Push schema to database
```

## Authentication

The app supports multiple authentication methods:
- **Email/Password**: Traditional account creation and login
- **OAuth**: Discord OAuth (configurable for other providers)
- **Session Management**: Secure session handling with HTTP-only cookies

## Responsive Design

The application is fully responsive and optimized for:
- **Mobile Devices**: Touch-friendly interface, optimized layouts
- **Tablets**: Adaptive sizing and navigation
- **Desktop**: Full-featured experience with enhanced layouts

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).
