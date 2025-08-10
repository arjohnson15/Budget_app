const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Database setup - SQLite file will be created in /app/data directory
const dbPath = path.join(__dirname, 'data', 'expenses.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
    // Income table - enhanced with deposit dates
    db.run(`CREATE TABLE IF NOT EXISTS income (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        frequency TEXT NOT NULL,
        deposit_day INTEGER,
        specific_date DATE,
        start_date DATE NOT NULL,
        end_date DATE,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Expenses table - enhanced with payment dates and one-time payments
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        frequency TEXT NOT NULL,
        payment_day INTEGER,
        specific_date DATE,
        category TEXT,
        start_date DATE NOT NULL,
        end_date DATE,
        is_recurring BOOLEAN DEFAULT 1,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Budget categories table
    db.run(`CREATE TABLE IF NOT EXISTS budget_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL UNIQUE,
        budgeted_amount DECIMAL(10,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Savings goals table
    db.run(`CREATE TABLE IF NOT EXISTS savings_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        target_amount DECIMAL(10,2) NOT NULL,
        current_amount DECIMAL(10,2) DEFAULT 0,
        target_date DATE,
        monthly_contribution DECIMAL(10,2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Account balances table (for tracking current balance)
    db.run(`CREATE TABLE IF NOT EXISTS account_balance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_name TEXT NOT NULL DEFAULT 'Main Account',
        current_balance DECIMAL(10,2) DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insert default account if not exists
    db.run(`INSERT OR IGNORE INTO account_balance (id, account_name, current_balance) 
            VALUES (1, 'Main Account', 0)`);
});

// Helper function to calculate next occurrence of a recurring item
function getNextOccurrence(startDate, frequency, dayOfMonth, specificDate) {
    const today = new Date();
    const start = new Date(startDate);
    
    if (specificDate) {
        const specDate = new Date(specificDate);
        return specDate >= today ? specDate : null;
    }
    
    let nextDate = new Date(start);
    
    while (nextDate < today) {
        switch (frequency) {
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case 'bi-weekly':
                nextDate.setDate(nextDate.getDate() + 14);
                break;
            case 'monthly':
                if (dayOfMonth) {
                    nextDate.setMonth(nextDate.getMonth() + 1);
                    nextDate.setDate(Math.min(dayOfMonth, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()));
                } else {
                    nextDate.setMonth(nextDate.getMonth() + 1);
                }
                break;
            case 'yearly':
                nextDate.setFullYear(nextDate.getFullYear() + 1);
                break;
        }
    }
    
    return nextDate;
}

// Helper function to generate cash flow for next 30 days
function generateCashFlow(income, expenses, currentBalance, callback) {
    const cashFlow = [];
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 30);
    
    let runningBalance = parseFloat(currentBalance) || 0;
    
    // Generate all transactions for next 30 days
    const allTransactions = [];
    
    // Add income transactions
    income.forEach(inc => {
        if (!inc.is_active) return;
        
        let currentDate = getNextOccurrence(inc.start_date, inc.frequency, inc.deposit_day, inc.specific_date);
        let occurrences = 0;
        
        while (currentDate && currentDate <= endDate && occurrences < 50) {
            allTransactions.push({
                date: new Date(currentDate),
                type: 'income',
                description: inc.source,
                amount: parseFloat(inc.amount),
                category: 'Income'
            });
            
            if (inc.frequency === 'one-time' || inc.specific_date) break;
            
            // Calculate next occurrence
            switch (inc.frequency) {
                case 'weekly':
                    currentDate.setDate(currentDate.getDate() + 7);
                    break;
                case 'bi-weekly':
                    currentDate.setDate(currentDate.getDate() + 14);
                    break;
                case 'monthly':
                    currentDate.setMonth(currentDate.getMonth() + 1);
                    if (inc.deposit_day) {
                        currentDate.setDate(Math.min(inc.deposit_day, new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()));
                    }
                    break;
                case 'yearly':
                    currentDate.setFullYear(currentDate.getFullYear() + 1);
                    break;
            }
            occurrences++;
        }
    });
    
    // Add expense transactions
    expenses.forEach(exp => {
        if (!exp.is_active) return;
        
        let currentDate = getNextOccurrence(exp.start_date, exp.frequency, exp.payment_day, exp.specific_date);
        let occurrences = 0;
        
        while (currentDate && currentDate <= endDate && occurrences < 50) {
            allTransactions.push({
                date: new Date(currentDate),
                type: 'expense',
                description: exp.name,
                amount: -parseFloat(exp.amount),
                category: exp.category || 'Expense'
            });
            
            if (exp.frequency === 'one-time' || exp.specific_date || !exp.is_recurring) break;
            
            // Calculate next occurrence
            switch (exp.frequency) {
                case 'weekly':
                    currentDate.setDate(currentDate.getDate() + 7);
                    break;
                case 'bi-weekly':
                    currentDate.setDate(currentDate.getDate() + 14);
                    break;
                case 'monthly':
                    currentDate.setMonth(currentDate.getMonth() + 1);
                    if (exp.payment_day) {
                        currentDate.setDate(Math.min(exp.payment_day, new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()));
                    }
                    break;
                case 'yearly':
                    currentDate.setFullYear(currentDate.getFullYear() + 1);
                    break;
            }
            occurrences++;
        }
    });
    
    // Sort transactions by date
    allTransactions.sort((a, b) => a.date - b.date);
    
    // Calculate daily balances
    for (let d = new Date(today); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayTransactions = allTransactions.filter(t => 
            t.date.toDateString() === d.toDateString()
        );
        
        const dayTotal = dayTransactions.reduce((sum, t) => sum + t.amount, 0);
        runningBalance += dayTotal;
        
        cashFlow.push({
            date: new Date(d).toISOString().split('T')[0],
            transactions: dayTransactions,
            dailyTotal: dayTotal,
            runningBalance: runningBalance,
            isNegative: runningBalance < 0
        });
    }
    
    callback(cashFlow);
}

// Routes

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Account balance routes
app.get('/api/balance', (req, res) => {
    db.get("SELECT current_balance FROM account_balance WHERE id = 1", (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ balance: row ? row.current_balance : 0 });
    });
});

app.post('/api/balance', (req, res) => {
    const { balance } = req.body;
    db.run(
        "UPDATE account_balance SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
        [balance],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ balance: balance });
        }
    );
});

// Income routes
app.get('/api/income', (req, res) => {
    db.all("SELECT * FROM income WHERE is_active = 1 ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/income', (req, res) => {
    const { source, amount, frequency, deposit_day, specific_date, start_date, end_date } = req.body;
    db.run(
        `INSERT INTO income (source, amount, frequency, deposit_day, specific_date, start_date, end_date) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [source, amount, frequency, deposit_day, specific_date, start_date, end_date],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

app.delete('/api/income/:id', (req, res) => {
    db.run("UPDATE income SET is_active = 0 WHERE id = ?", req.params.id, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ deleted: this.changes });
    });
});

// Expense routes
app.get('/api/expenses', (req, res) => {
    db.all("SELECT * FROM expenses WHERE is_active = 1 ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/expenses', (req, res) => {
    const { name, amount, frequency, payment_day, specific_date, category, start_date, end_date, is_recurring } = req.body;
    db.run(
        `INSERT INTO expenses (name, amount, frequency, payment_day, specific_date, category, start_date, end_date, is_recurring) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, amount, frequency, payment_day, specific_date, category, start_date, end_date, is_recurring !== false],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

app.delete('/api/expenses/:id', (req, res) => {
    db.run("UPDATE expenses SET is_active = 0 WHERE id = ?", req.params.id, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ deleted: this.changes });
    });
});

// Budget routes
app.get('/api/budget', (req, res) => {
    db.all("SELECT * FROM budget_categories ORDER BY category", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/budget', (req, res) => {
    const { category, budgeted_amount } = req.body;
    db.run(
        "INSERT OR REPLACE INTO budget_categories (category, budgeted_amount) VALUES (?, ?)",
        [category, budgeted_amount],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID, category, budgeted_amount });
        }
    );
});

// Savings goals routes
app.get('/api/savings', (req, res) => {
    db.all("SELECT * FROM savings_goals ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/savings', (req, res) => {
    const { name, target_amount, current_amount, target_date, monthly_contribution } = req.body;
    db.run(
        `INSERT INTO savings_goals (name, target_amount, current_amount, target_date, monthly_contribution) 
         VALUES (?, ?, ?, ?, ?)`,
        [name, target_amount, current_amount || 0, target_date, monthly_contribution || 0],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

app.put('/api/savings/:id', (req, res) => {
    const { current_amount } = req.body;
    db.run(
        "UPDATE savings_goals SET current_amount = ? WHERE id = ?",
        [current_amount, req.params.id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ updated: this.changes });
        }
    );
});

// Cash flow projection endpoint
app.get('/api/cashflow', (req, res) => {
    const days = parseInt(req.query.days) || 30;
    
    Promise.all([
        new Promise((resolve, reject) => {
            db.all("SELECT * FROM income WHERE is_active = 1", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }),
        new Promise((resolve, reject) => {
            db.all("SELECT * FROM expenses WHERE is_active = 1", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }),
        new Promise((resolve, reject) => {
            db.get("SELECT current_balance FROM account_balance WHERE id = 1", (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.current_balance : 0);
            });
        })
    ]).then(([income, expenses, currentBalance]) => {
        generateCashFlow(income, expenses, currentBalance, (cashFlow) => {
            res.json(cashFlow.slice(0, days));
        });
    }).catch(err => {
        res.status(500).json({ error: err.message });
    });
});

// Enhanced summary endpoint
app.get('/api/summary', (req, res) => {
    Promise.all([
        new Promise((resolve, reject) => {
            db.all("SELECT * FROM income WHERE is_active = 1", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }),
        new Promise((resolve, reject) => {
            db.all("SELECT * FROM expenses WHERE is_active = 1", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }),
        new Promise((resolve, reject) => {
            db.get("SELECT current_balance FROM account_balance WHERE id = 1", (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.current_balance : 0);
            });
        }),
        new Promise((resolve, reject) => {
            db.get("SELECT SUM(budgeted_amount) as total FROM budget_categories", (err, row) => {
                if (err) reject(err);
                else resolve(row.total || 0);
            });
        })
    ]).then(([income, expenses, currentBalance, totalBudget]) => {
        generateCashFlow(income, expenses, currentBalance, (cashFlow) => {
            const endOfMonth = new Date();
            endOfMonth.setMonth(endOfMonth.getMonth() + 1);
            endOfMonth.setDate(0); // Last day of current month
            
            const endOfMonthFlow = cashFlow.find(day => {
                const dayDate = new Date(day.date);
                return dayDate.toDateString() === endOfMonth.toDateString();
            });
            
            const monthlyIncome = income.reduce((sum, inc) => {
                const multiplier = {
                    'weekly': 4.33,
                    'bi-weekly': 2.17,
                    'monthly': 1,
                    'yearly': 1/12,
                    'one-time': 0
                };
                return sum + (parseFloat(inc.amount) * (multiplier[inc.frequency] || 0));
            }, 0);
            
            const monthlyExpenses = expenses.reduce((sum, exp) => {
                if (!exp.is_recurring) return sum;
                const multiplier = {
                    'weekly': 4.33,
                    'bi-weekly': 2.17,
                    'monthly': 1,
                    'yearly': 1/12,
                    'one-time': 0
                };
                return sum + (parseFloat(exp.amount) * (multiplier[exp.frequency] || 0));
            }, 0);
            
            res.json({
                currentBalance: parseFloat(currentBalance).toFixed(2),
                monthlyIncome: monthlyIncome.toFixed(2),
                monthlyExpenses: monthlyExpenses.toFixed(2),
                totalBudget: parseFloat(totalBudget).toFixed(2),
                netIncome: (monthlyIncome - monthlyExpenses).toFixed(2),
                endOfMonthBalance: endOfMonthFlow ? endOfMonthFlow.runningBalance.toFixed(2) : currentBalance,
                lowestBalance: Math.min(...cashFlow.map(day => day.runningBalance)).toFixed(2),
                daysUntilNegative: cashFlow.findIndex(day => day.runningBalance < 0)
            });
        });
    }).catch(err => {
        res.status(500).json({ error: err.message });
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Enhanced Expense Tracker running on port ${PORT}`);
    console.log(`Database location: ${dbPath}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});