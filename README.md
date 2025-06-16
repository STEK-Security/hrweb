# Attendance Evaluation System

A comprehensive web-based attendance and performance evaluation system built with React, Node.js, and PostgreSQL.

## 📋 Features

- **Dashboard**: Real-time overview of employee performance metrics
- **Employee Management**: Add, edit, and manage employee data
- **Violation Tracking**: Record and monitor employee violations
- **Excel Import**: Bulk import employees from Excel files
- **Automated Scoring**: Rule-based violation scoring system
- **Detailed Reports**: Comprehensive reporting and analytics
- **Clickable Metrics**: Drill-down into specific employee lists and violation details

## 🚀 Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed
- Git

### Setup Instructions

1. **Clone the repository**
```bash
git clone https://github.com/your-username/attendance-evaluation-system.git
cd attendance-evaluation-system
```

2. **Environment Configuration**
```bash
cp .env.example .env
# Edit .env file with your configuration
```

3. **Start the application**
```bash
docker-compose up -d
```

4. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Database: localhost:5432

### Default Admin Credentials
- Email: admin@company.com
- Password: admin123!

## 📁 Project Structure

```
attendance-evaluation-system/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom hooks
│   │   ├── services/        # API services
│   │   └── utils/           # Utility functions
│   ├── public/
│   ├── package.json
│   └── Dockerfile
├── backend/                  # Node.js backend API
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Express middleware
│   │   ├── services/        # Business logic
│   │   └── utils/           # Utility functions
│   ├── migrations/          # Database migrations
│   ├── seeds/               # Database seeds
│   ├── package.json
│   └── Dockerfile
├── database/                 # Database scripts and migrations
│   ├── init.sql
│   └── migrations/
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🐳 Docker Configuration

### Services
- **frontend**: React application (Port 3000)
- **backend**: Node.js API server (Port 5000)
- **postgres**: PostgreSQL database (Port 5432)
- **redis**: Redis cache (Port 6379)

## 📊 Key Features Detail

### 1. Clickable Dashboard Metrics
- **Excellent Employees**: Click to view list of A-grade employees
- **Monthly Violations**: Click to view detailed violation records
- **Department Stats**: Drill-down into department-specific data

### 2. Employee Management
- **Manual Addition**: Form-based employee creation
- **Excel Import**: Bulk import from Excel files
- **Employee Profiles**: Detailed employee information and history

### 3. Violation Rules Engine
- **Configurable Rules**: Define violation types and penalty scores
- **Time-based Penalties**: Automatic scoring for late submissions
- **Escalation System**: Progressive penalties for repeat violations

### 4. Automated Scoring
- **Real-time Calculation**: Automatic score updates
- **Weighted Metrics**: Configurable weight for different criteria
- **Historical Tracking**: Performance trends over time

## 🔧 Configuration

### Environment Variables
```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=attendance_db
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h

# Server
NODE_ENV=production
BACKEND_PORT=5000
FRONTEND_PORT=3000

# File Upload
MAX_FILE_SIZE=10MB
UPLOAD_DIR=uploads
```

## 📈 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Employees
- `GET /api/employees` - List employees
- `POST /api/employees` - Create employee
- `GET /api/employees/:id` - Get employee details
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee
- `POST /api/employees/import` - Excel import

### Violations
- `GET /api/violations` - List violations
- `POST /api/violations` - Create violation
- `GET /api/violations/:id` - Get violation details
- `PUT /api/violations/:id` - Update violation

### Dashboard
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/excellent-employees` - Excellent employees list
- `GET /api/dashboard/violations-detail` - Detailed violations

### Rules
- `GET /api/rules` - List violation rules
- `POST /api/rules` - Create rule
- `PUT /api/rules/:id` - Update rule
- `DELETE /api/rules/:id` - Delete rule

## 🗄️ Database Schema

### Key Tables
- **employees**: Employee information
- **violations**: Violation records
- **violation_rules**: Configurable violation rules
- **evaluations**: Monthly evaluation results
- **departments**: Department information

## 🚀 Deployment

### Production Deployment
1. Set up environment variables for production
2. Configure SSL certificates
3. Set up monitoring and logging
4. Configure backup strategies

### Environment-specific Configurations
- **Development**: `docker-compose.dev.yml`
- **Production**: `docker-compose.prod.yml`
- **Testing**: `docker-compose.test.yml`

## 🔍 Monitoring

### Health Checks
- Application health endpoint: `/health`
- Database connectivity check
- Redis connectivity check

### Logging
- Application logs in `logs/` directory
- Database query logs
- Error tracking and alerting

## 🧪 Testing

```bash
# Run backend tests
cd backend && npm test

# Run frontend tests
cd frontend && npm test

# Integration tests
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team

## 🔄 Version History

- **v1.0.0**: Initial release with basic features
- **v1.1.0**: Added Excel import functionality
- **v1.2.0**: Implemented violation rules engine
- **v1.3.0**: Enhanced dashboard with clickable metrics
```
