# Personal Expense Tracker

A self-hosted web application for tracking income, expenses, and budgets. Built with Node.js, Express, and SQLite - perfect for running in Docker containers.

## Features

- **Income Tracking**: Add multiple income sources with different frequencies (weekly, bi-weekly, monthly, yearly)
- **Recurring Expenses**: Track all your regular expenses with categories
- **Budget Management**: Set monthly budgets for different categories
- **Financial Summary**: Real-time overview of monthly income, expenses, and net income
- **Responsive Design**: Works on desktop and mobile devices
- **Self-Hosted**: Complete control over your financial data
- **Docker Ready**: Easy deployment with Docker and docker-compose

## Quick Start

### Option 1: Using Docker Compose (Recommended)

1. Create a new directory for your expense tracker:
```bash
mkdir expense-tracker
cd expense-tracker
```

2. Save all the provided files in this directory:
   - `Dockerfile`
   - `docker-compose.yml`
   - `package.json`
   - `server.js`
   - Create a `public` folder and save `index.html` inside it

3. Build and run with docker-compose:
```bash
docker-compose up -d
```

4. Access the application at: `http://localhost:3000`

### Option 2: Manual Docker Build

1. Build the Docker image:
```bash
docker build -t expense-tracker .
```

2. Run the container:
```bash
docker run -d -p 3000:3000 -v expense-data:/app/data --name expense-tracker expense-tracker
```

### Option 3: Local Development (Windows)

1. Install Node.js (version 18 or higher)
2. Install dependencies:
```bash
npm install
```

3. Run the application:
```bash
npm start
```

## File Structure

```
expense-tracker/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── server.js
├── public/
│   └── index.html
└── data/
    └── expenses.db (created automatically)
```

## How to Use

### Adding Income
1. Go to the "Income Sources" section
2. Enter your income source name (e.g., "Salary", "Freelance")
3. Enter the amount and select frequency
4. Set the start date
5. Click "Add Income"

### Adding Expenses
1. Go to the "Recurring Expenses" section
2. Enter expense name (e.g., "Rent", "Groceries")
3. Enter amount and frequency
4. Optionally add a category for organization
5. Set the start date
6. Click "Add Expense"

### Setting Budgets
1. Go to the "Budget Categories" section
2. Enter a category name (e.g., "Entertainment", "Dining Out")
3. Set your monthly budget amount
4. Click "Set Budget"

### Understanding the Summary
- **Monthly Income**: Total income converted to monthly amount
- **Monthly Expenses**: Total expenses converted to monthly amount
- **Total Budget**: Sum of all budget categories
- **Net Income**: Income minus expenses (green=positive, red=negative)

## Data Persistence

Your data is stored in a SQLite database that persists in the Docker volume `expense-data`. This means:
- Your data survives container restarts
- You can backup the volume if needed
- Easy to migrate between different hosts

## Frequency Calculations

The app automatically converts different frequencies to monthly amounts:
- **Weekly**: Amount × 4.33
- **Bi-weekly**: Amount × 2.17
- **Monthly**: Amount × 1
- **Yearly**: Amount ÷ 12

## Backup Your Data

To backup your SQLite database:

```bash
# Find the volume location
docker volume inspect expense-data

# Copy the database file
docker cp expense-tracker:/app/data/expenses.db ./backup-expenses.db
```

## Updating the Application

1. Stop the current container:
```bash
docker-compose down
```

2. Rebuild with any changes:
```bash
docker-compose up -d --build
```

Your data will be preserved in the volume.

## Troubleshooting

### Container won't start
- Check if port 3000 is already in use: `netstat -an | findstr 3000`
- Check Docker logs: `docker logs expense-tracker`

### Database issues
- The SQLite database is created automatically on first run
- Check volume permissions if running on Linux

### Can't access the application
- Ensure you're accessing `http://localhost:3000`
- Check Windows Firewall settings
- Verify the container is running: `docker ps`

## Customization

The application is designed to be easily readable and modifiable:

- **Database schema**: Check the table creation in `server.js`
- **API endpoints**: All routes are defined in `server.js`
- **Frontend styling**: CSS is embedded in `index.html`
- **Calculations**: Frequency conversions are in the `/api/summary` endpoint

## Security Notes

- This application is designed for personal use on your local network
- No authentication is built-in (add reverse proxy with auth if exposing to internet)
- Database contains your financial information - keep backups secure
- Consider using HTTPS if accessing over network

## Support

This is a self-contained application with no external dependencies except Node.js and SQLite. All code is included and documented for easy understanding and modification.