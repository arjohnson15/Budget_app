const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const dbPath = path.join(__dirname, 'data', 'expenses.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('checking', 'savings', 'credit_card')),
        current_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
        credit_limit DECIMAL(10,2) DEFAULT NULL,
        apr DECIMAL(5,2) DEFAULT NULL,
        minimum_payment DECIMAL(10,2) DEFAULT NULL,
        due_day INTEGER DEFAULT NULL,
        statement_day INTEGER DEFAULT NULL,
        priority_level INTEGER DEFAULT 5 CHECK(priority_level BETWEEN 1 AND 10),
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS income (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        frequency TEXT NOT NULL,
        deposit_day INTEGER,
        specific_date DATE,
        start_date DATE NOT NULL,
        end_date DATE,
        account_id INTEGER,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        frequency TEXT NOT NULL,
        payment_day INTEGER,
        specific_date DATE,
        category TEXT,
        account_id INTEGER,
        start_date DATE NOT NULL,
        end_date DATE,
        priority_level INTEGER DEFAULT 5 CHECK(priority_level BETWEEN 1 AND 10),
        is_recurring BOOLEAN DEFAULT 1,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS savings_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        target_amount DECIMAL(10,2) NOT NULL,
        current_amount DECIMAL(10,2) DEFAULT 0,
        target_date DATE,
        priority_level INTEGER DEFAULT 5 CHECK(priority_level BETWEEN 1 AND 10),
        goal_type TEXT DEFAULT 'flexible' CHECK(goal_type IN ('emergency', 'time_sensitive', 'flexible', 'long_term')),
        auto_contribution DECIMAL(10,2) DEFAULT 0,
        account_id INTEGER,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS budget_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL UNIQUE,
        budgeted_amount DECIMAL(10,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS account_balance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_name TEXT NOT NULL DEFAULT 'Main Account',
        current_balance DECIMAL(10,2) DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`INSERT OR IGNORE INTO accounts (id, name, type, current_balance, priority_level) 
            SELECT 1, 'Main Checking', 'checking', 
                   COALESCE((SELECT current_balance FROM account_balance WHERE id = 1), 0), 
                   1 
            WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE id = 1)`);

    db.run(`INSERT OR IGNORE INTO account_balance (id, account_name, current_balance) 
            VALUES (1, 'Main Account', 0)`);

    db.run(`INSERT OR IGNORE INTO savings_goals (name, target_amount, goal_type, priority_level, account_id) 
            VALUES ('Emergency Fund', 10000, 'emergency', 2, 1)`);
});

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

function generateCashFlow(income, expenses, currentBalance, callback) {
    const cashFlow = [];
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 30);
    
    let runningBalance = parseFloat(currentBalance) || 0;
    const allTransactions = [];
    
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
    
    allTransactions.sort((a, b) => a.date - b.date);
    
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

function calculateOptimalPayments(debts, goals, extraAmount, strategyType) {
    const totalMinimumPayments = debts.reduce((sum, debt) => sum + (parseFloat(debt.minimum_payment) || 0), 0);
    let remainingExtra = extraAmount;
    const recommendations = [];
    
    debts.forEach(debt => {
        if (debt.minimum_payment > 0) {
            recommendations.push({
                account_id: debt.id,
                account_name: debt.name,
                payment_amount: parseFloat(debt.minimum_payment),
                payment_type: 'minimum',
                reasoning: 'Required minimum payment'
            });
        }
    });
    
    const sortedDebts = [...debts].sort((a, b) => {
        if (strategyType === 'avalanche') {
            return parseFloat(b.apr || 0) - parseFloat(a.apr || 0);
        } else if (strategyType === 'snowball') {
            return parseFloat(a.current_balance) - parseFloat(b.current_balance);
        } else if (strategyType === 'custom') {
            return a.priority_level - b.priority_level;
        }
        return 0;
    });
    
    for (const debt of sortedDebts) {
        if (remainingExtra <= 0) break;
        
        const maxPayment = Math.min(remainingExtra, parseFloat(debt.current_balance));
        if (maxPayment > 0) {
            let reasoning;
            if (strategyType === 'avalanche') reasoning = `Highest APR (${debt.apr}%)`;
            else if (strategyType === 'snowball') reasoning = 'Lowest balance';
            else reasoning = `Priority level ${debt.priority_level}`;
            
            recommendations.push({
                account_id: debt.id,
                account_name: debt.name,
                payment_amount: maxPayment,
                payment_type: 'extra',
                reasoning: reasoning
            });
            remainingExtra -= maxPayment;
        }
    }
    
    if (remainingExtra > 0 && goals.length > 0) {
        const priorityGoals = goals
            .filter(g => parseFloat(g.current_amount) < parseFloat(g.target_amount))
            .sort((a, b) => a.priority_level - b.priority_level);
        
        for (const goal of priorityGoals) {
            if (remainingExtra <= 0) break;
            
            const needed = parseFloat(goal.target_amount) - parseFloat(goal.current_amount);
            const allocation = Math.min(remainingExtra, needed, remainingExtra * 0.4);
            
            if (allocation > 0) {
                recommendations.push({
                    goal_id: goal.id,
                    goal_name: goal.name,
                    payment_amount: allocation,
                    payment_type: 'savings',
                    reasoning: `${goal.goal_type} goal (Priority ${goal.priority_level})`
                });
                remainingExtra -= allocation;
            }
        }
    }
    
    const totalInterestSaved = debts.reduce((sum, debt) => {
        const extraPayment = recommendations
            .filter(r => r.account_id === debt.id && r.payment_type === 'extra')
            .reduce((sum, r) => sum + r.payment_amount, 0);
        
        if (extraPayment > 0 && debt.apr > 0) {
            const monthlyInterest = (parseFloat(debt.current_balance) * (parseFloat(debt.apr) / 100)) / 12;
            return sum + (monthlyInterest * 6);
        }
        return sum;
    }, 0);
    
    const totalDebt = debts.reduce((sum, debt) => sum + parseFloat(debt.current_balance), 0);
    const totalMonthlyPayments = recommendations
        .filter(r => r.account_id)
        .reduce((sum, r) => sum + r.payment_amount, 0);
    
    const payoffTimeline = totalMonthlyPayments === 0 || totalDebt === 0 ? 0 : Math.ceil(totalDebt / totalMonthlyPayments);
    
    return {
        recommendations,
        total_extra_allocated: extraAmount - remainingExtra,
        remaining_extra: remainingExtra,
        projected_interest_saved: totalInterestSaved,
        estimated_payoff_months: payoffTimeline,
        strategy_used: strategyType
    };
}

function generatePaymentCalendar(accounts, expenses, days) {
    const calendar = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        const dayPayments = [];
        
        accounts.forEach(account => {
            if (account.type === 'credit_card' && account.due_day && account.minimum_payment > 0) {
                if (date.getDate() === account.due_day) {
                    dayPayments.push({
                        type: 'minimum_payment',
                        account_name: account.name,
                        amount: account.minimum_payment,
                        is_critical: true
                    });
                }
            }
        });
        
        expenses.forEach(expense => {
            if (expense.payment_day && date.getDate() === expense.payment_day) {
                dayPayments.push({
                    type: 'expense',
                    name: expense.name,
                    amount: expense.amount,
                    category: expense.category,
                    account_id: expense.account_id
                });
            }
        });
        
        if (dayPayments.length > 0) {
            calendar.push({
                date: date.toISOString().split('T')[0],
                payments: dayPayments,
                total_amount: dayPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
            });
        }
    }
    
    return calendar;
}

function generateFinancialSummary(accounts, goals, income, expenses) {
    const checking = accounts.filter(a => a.type === 'checking');
    const savings = accounts.filter(a => a.type === 'savings');
    const creditCards = accounts.filter(a => a.type === 'credit_card');
    
    const totalChecking = checking.reduce((sum, a) => sum + parseFloat(a.current_balance), 0);
    const totalSavings = savings.reduce((sum, a) => sum + parseFloat(a.current_balance), 0);
    const totalDebt = creditCards.reduce((sum, a) => sum + parseFloat(a.current_balance), 0);
    const totalCreditLimit = creditCards.reduce((sum, a) => sum + parseFloat(a.credit_limit || 0), 0);
    const totalMinimumPayments = creditCards.reduce((sum, a) => sum + parseFloat(a.minimum_payment || 0), 0);
    
    const weightedAPR = creditCards.length > 0 && totalDebt > 0 ? 
        creditCards.reduce((sum, a) => sum + (parseFloat(a.current_balance) * parseFloat(a.apr || 0)), 0) / totalDebt : 0;
    
    const totalGoalsTarget = goals.reduce((sum, g) => sum + parseFloat(g.target_amount), 0);
    const totalGoalsCurrent = goals.reduce((sum, g) => sum + parseFloat(g.current_amount), 0);
    
    const monthlyIncome = income.reduce((sum, inc) => {
        const multiplier = { 'weekly': 4.33, 'bi-weekly': 2.17, 'monthly': 1, 'yearly': 1/12, 'one-time': 0 };
        return sum + (parseFloat(inc.amount) * (multiplier[inc.frequency] || 0));
    }, 0);
    
    const monthlyExpenses = expenses.reduce((sum, exp) => {
        if (!exp.is_recurring) return sum;
        const multiplier = { 'weekly': 4.33, 'bi-weekly': 2.17, 'monthly': 1, 'yearly': 1/12, 'one-time': 0 };
        return sum + (parseFloat(exp.amount) * (multiplier[exp.frequency] || 0));
    }, 0);
    
    return {
        liquid_cash: totalChecking + totalSavings,
        total_checking: totalChecking,
        total_savings: totalSavings,
        total_debt: totalDebt,
        total_credit_limit: totalCreditLimit,
        credit_utilization: totalCreditLimit > 0 ? (totalDebt / totalCreditLimit * 100) : 0,
        total_minimum_payments: totalMinimumPayments,
        weighted_apr: weightedAPR,
        net_worth: totalChecking + totalSavings - totalDebt,
        monthly_income: monthlyIncome,
        monthly_expenses: monthlyExpenses + totalMinimumPayments,
        available_for_extra_payments: monthlyIncome - monthlyExpenses - totalMinimumPayments,
        savings_goals_progress: totalGoalsTarget > 0 ? (totalGoalsCurrent / totalGoalsTarget * 100) : 0,
        total_goals_remaining: totalGoalsTarget - totalGoalsCurrent,
        accounts_summary: {
            checking_accounts: checking.length,
            savings_accounts: savings.length,
            credit_cards: creditCards.length
        }
    };
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/balance', (req, res) => {
    db.get(`SELECT current_balance FROM accounts WHERE type = 'checking' ORDER BY id ASC LIMIT 1`, (err, row) => {
        if (err || !row) {
            db.get("SELECT current_balance FROM account_balance WHERE id = 1", (err2, row2) => {
                if (err2) {
                    res.status(500).json({ error: err2.message });
                    return;
                }
                res.json({ balance: row2 ? row2.current_balance : 0 });
            });
            return;
        }
        res.json({ balance: row.current_balance });
    });
});

app.post('/api/balance', (req, res) => {
    const { balance } = req.body;
    db.run(
        "UPDATE accounts SET current_balance = ? WHERE type = 'checking' AND id = 1",
        [balance],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            db.run(
                "UPDATE account_balance SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
                [balance],
                function(err2) {
                    if (err2) console.log('Legacy table update failed:', err2.message);
                }
            );
            res.json({ balance: balance });
        }
    );
});

app.get('/api/accounts', (req, res) => {
    db.all("SELECT * FROM accounts WHERE is_active = 1 ORDER BY priority_level ASC, type ASC", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/accounts', (req, res) => {
    const { name, type, current_balance, credit_limit, apr, minimum_payment, due_day, statement_day, priority_level } = req.body;
    
    db.run(
        `INSERT INTO accounts (name, type, current_balance, credit_limit, apr, minimum_payment, due_day, statement_day, priority_level) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, type, current_balance || 0, credit_limit, apr, minimum_payment, due_day, statement_day, priority_level || 5],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

app.put('/api/accounts/:id', (req, res) => {
    const { name, type, current_balance, credit_limit, apr, minimum_payment, due_day, statement_day, priority_level } = req.body;
    
    db.run(
        `UPDATE accounts SET name = ?, type = ?, current_balance = ?, credit_limit = ?, apr = ?, 
         minimum_payment = ?, due_day = ?, statement_day = ?, priority_level = ? WHERE id = ?`,
        [name, type, current_balance, credit_limit, apr, minimum_payment, due_day, statement_day, priority_level, req.params.id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ updated: this.changes });
        }
    );
});

app.delete('/api/accounts/:id', (req, res) => {
    db.run("UPDATE accounts SET is_active = 0 WHERE id = ?", req.params.id, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ deleted: this.changes });
    });
});

app.get('/api/income', (req, res) => {
    db.all(`SELECT i.*, a.name as account_name FROM income i 
            LEFT JOIN accounts a ON i.account_id = a.id 
            WHERE i.is_active = 1 ORDER BY i.created_at DESC`, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/income', (req, res) => {
    const { source, amount, frequency, deposit_day, specific_date, start_date, end_date, account_id } = req.body;
    db.run(
        `INSERT INTO income (source, amount, frequency, deposit_day, specific_date, start_date, end_date, account_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [source, amount, frequency, deposit_day, specific_date, start_date, end_date, account_id],
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

app.get('/api/expenses', (req, res) => {
    db.all(`SELECT e.*, a.name as account_name FROM expenses e 
            LEFT JOIN accounts a ON e.account_id = a.id 
            WHERE e.is_active = 1 ORDER BY e.created_at DESC`, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/expenses', (req, res) => {
    const { name, amount, frequency, payment_day, specific_date, category, start_date, end_date, is_recurring, account_id, priority_level } = req.body;
    db.run(
        `INSERT INTO expenses (name, amount, frequency, payment_day, specific_date, category, start_date, end_date, is_recurring, account_id, priority_level) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, amount, frequency, payment_day, specific_date, category, start_date, end_date, is_recurring !== false, account_id, priority_level || 5],
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

app.get('/api/savings', (req, res) => {
    db.all(`SELECT s.*, a.name as account_name FROM savings_goals s 
            LEFT JOIN accounts a ON s.account_id = a.id 
            WHERE s.is_active = 1 ORDER BY s.priority_level ASC, s.created_at DESC`, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/savings', (req, res) => {
    const { name, target_amount, current_amount, target_date, priority_level, goal_type, auto_contribution, account_id } = req.body;
    
    db.run(
        `INSERT INTO savings_goals (name, target_amount, current_amount, target_date, priority_level, goal_type, auto_contribution, account_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, target_amount, current_amount || 0, target_date, priority_level || 5, goal_type || 'flexible', auto_contribution || 0, account_id],
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

app.post('/api/optimize-payments', (req, res) => {
    const { extra_amount, strategy_type, include_savings } = req.body;
    
    db.all(`SELECT * FROM accounts WHERE type = 'credit_card' AND current_balance > 0 AND is_active = 1 
            ORDER BY ${strategy_type === 'avalanche' ? 'apr DESC' : strategy_type === 'snowball' ? 'current_balance ASC' : 'priority_level ASC'}`, (err, debts) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (include_savings) {
            db.all("SELECT * FROM savings_goals WHERE is_active = 1 ORDER BY priority_level ASC", (err, goals) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                
                const optimization = calculateOptimalPayments(debts, goals, extra_amount || 0, strategy_type);
                res.json(optimization);
            });
        } else {
            const optimization = calculateOptimalPayments(debts, [], extra_amount || 0, strategy_type);
            res.json(optimization);
        }
    });
});

app.get('/api/payment-calendar', (req, res) => {
    const days = parseInt(req.query.days) || 30;
    
    Promise.all([
        new Promise((resolve, reject) => {
            db.all("SELECT * FROM accounts WHERE is_active = 1", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }),
        new Promise((resolve, reject) => {
            db.all("SELECT * FROM expenses WHERE is_active = 1", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        })
    ]).then(([accounts, expenses]) => {
        const calendar = generatePaymentCalendar(accounts, expenses, days);
        res.json(calendar);
    }).catch(err => {
        res.status(500).json({ error: err.message });
    });
});

app.get('/api/financial-summary', (req, res) => {
    Promise.all([
        new Promise((resolve, reject) => {
            db.all("SELECT * FROM accounts WHERE is_active = 1", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }),
        new Promise((resolve, reject) => {
            db.all("SELECT * FROM savings_goals WHERE is_active = 1", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }),
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
        })
    ]).then(([accounts, goals, income, expenses]) => {
        const summary = generateFinancialSummary(accounts, goals, income, expenses);
        res.json(summary);
    }).catch(err => {
        res.status(500).json({ error: err.message });
    });
});

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
            db.get(`SELECT current_balance FROM accounts WHERE type = 'checking' ORDER BY id ASC LIMIT 1`, (err, row) => {
                if (err || !row) {
                    db.get("SELECT current_balance FROM account_balance WHERE id = 1", (err2, row2) => {
                        if (err2) reject(err2);
                        else resolve(row2 ? row2.current_balance : 0);
                    });
                } else {
                    resolve(row.current_balance);
                }
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
            db.get(`SELECT current_balance FROM accounts WHERE type = 'checking' ORDER BY id ASC LIMIT 1`, (err, row) => {
                if (err || !row) {
                    db.get("SELECT current_balance FROM account_balance WHERE id = 1", (err2, row2) => {
                        if (err2) reject(err2);
                        else resolve(row2 ? row2.current_balance : 0);
                    });
                } else {
                    resolve(row.current_balance);
                }
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
            endOfMonth.setDate(0);
            
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Financial Optimization Manager running on port ${PORT}`);
    console.log(`Database location: ${dbPath}`);
    console.log('Server started successfully!');
});

process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});