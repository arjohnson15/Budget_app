// Enhanced Finance App JavaScript with Modern UX

// Tab functionality with smooth transitions
function showTab(tabName) {
    // Hide all tab contents with fade out
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab content with fade in
    setTimeout(() => {
        document.getElementById(tabName).classList.add('active');
    }, 150);
    
    // Add active class to clicked tab
    event.target.classList.add('active');
    
    // Load data for specific tabs with loading states
    if (tabName === 'cashflow') {
        showLoading('cashFlowList');
        setTimeout(() => {
            loadCashFlow();
            hideLoading('cashFlowList');
        }, 300);
    }
    
    // Add haptic feedback (if supported)
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
}

// Show/hide loading states
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('loading');
    }
}

function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove('loading');
    }
}

// Toggle frequency-specific options with smooth animations
function toggleIncomeOptions() {
    const frequency = document.getElementById('incomeFrequency').value;
    const options = document.getElementById('incomeOptions');
    
    if (frequency !== '') {
        options.classList.add('show');
    } else {
        options.classList.remove('show');
    }
}

function toggleExpenseOptions() {
    const frequency = document.getElementById('expenseFrequency').value;
    const options = document.getElementById('expenseOptions');
    
    if (frequency !== '') {
        options.classList.add('show');
    } else {
        options.classList.remove('show');
    }
}

// Enhanced API helper functions with better error handling
async function apiCall(url, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        showNotification('Network error. Please try again.', 'error');
        throw error;
    }
}

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Add notification styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--bg-card);
        color: var(--text-primary);
        padding: 15px 20px;
        border-radius: var(--border-radius);
        box-shadow: 0 10px 30px var(--shadow);
        border-left: 4px solid var(--${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'accent-primary'});
        z-index: 1000;
        animation: slideInRight 0.3s ease-out;
        max-width: 400px;
        border: 1px solid var(--border);
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return '?';
        case 'error': return '?';
        case 'warning': return '!';
        default: return 'i';
    }
}

// Add notification animations to CSS dynamically
const notificationCSS = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        margin-left: auto;
    }
    
    .notification-close:hover {
        color: var(--text-primary);
    }
`;

// Inject notification CSS
const style = document.createElement('style');
style.textContent = notificationCSS;
document.head.appendChild(style);

// Enhanced formatting functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateLong(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Enhanced balance management with animations
async function updateBalance() {
    const balanceInput = document.getElementById('currentBalance');
    const balance = parseFloat(balanceInput.value);
    
    if (isNaN(balance)) {
        showNotification('Please enter a valid balance amount', 'error');
        balanceInput.focus();
        return;
    }

    try {
        showLoading('balanceDisplay');
        await apiCall('/api/balance', 'POST', { balance });
        await loadBalance();
        await loadSummary();
        showNotification('Balance updated successfully! ??', 'success');
    } catch (error) {
        console.error('Error updating balance:', error);
        showNotification('Failed to update balance. Please try again.', 'error');
    } finally {
        hideLoading('balanceDisplay');
    }
}

async function loadBalance() {
    try {
        const data = await apiCall('/api/balance');
        const balanceDisplay = document.getElementById('balanceDisplay');
        const currentBalanceInput = document.getElementById('currentBalance');
        
        // Animate balance change
        balanceDisplay.style.transform = 'scale(1.1)';
        setTimeout(() => {
            balanceDisplay.textContent = formatCurrency(data.balance);
            balanceDisplay.style.transform = 'scale(1)';
        }, 150);
        
        currentBalanceInput.value = data.balance;
    } catch (error) {
        console.error('Error loading balance:', error);
        showNotification('Failed to load balance', 'error');
    }
}

// Enhanced summary with better visual feedback
async function loadSummary() {
    try {
        showLoading('summaryGrid');
        const summary = await apiCall('/api/summary');
        const summaryGrid = document.getElementById('summaryGrid');
        
        const netIncomeClass = parseFloat(summary.netIncome) > 0 ? 'positive' : 
                             parseFloat(summary.netIncome) < 0 ? 'negative' : 'neutral';
        
        const balanceClass = parseFloat(summary.endOfMonthBalance) > 0 ? 'positive' :
                           parseFloat(summary.endOfMonthBalance) < 0 ? 'negative' : 'neutral';

        const warningDays = summary.daysUntilNegative > 0 && summary.daysUntilNegative < 30 ? 
                          summary.daysUntilNegative : null;
        
        let summaryHTML = `
            <div class="summary-card">
                <h3>Current Balance</h3>
                <div class="amount positive">${formatCurrency(summary.currentBalance)}</div>
            </div>
            <div class="summary-card">
                <h3>Monthly Income</h3>
                <div class="amount positive">${formatCurrency(summary.monthlyIncome)}</div>
            </div>
            <div class="summary-card">
                <h3>Monthly Expenses</h3>
                <div class="amount negative">${formatCurrency(summary.monthlyExpenses)}</div>
            </div>
            <div class="summary-card">
                <h3>Net Monthly</h3>
                <div class="amount ${netIncomeClass}">${formatCurrency(summary.netIncome)}</div>
            </div>
            <div class="summary-card">
                <h3>End of Month</h3>
                <div class="amount ${balanceClass}">${formatCurrency(summary.endOfMonthBalance)}</div>
            </div>
            <div class="summary-card">
                <h3>Lowest Balance</h3>
                <div class="amount ${parseFloat(summary.lowestBalance) < 0 ? 'negative' : 'neutral'}">${formatCurrency(summary.lowestBalance)}</div>
            </div>
        `;
        
        if (warningDays) {
            summaryHTML += `
                <div class="summary-card">
                    <h3>?? Balance Warning</h3>
                    <div class="amount warning">${warningDays} days until negative</div>
                </div>
            `;
        }
        
        summaryGrid.innerHTML = summaryHTML;
        
        // Animate cards
        setTimeout(() => {
            document.querySelectorAll('.summary-card').forEach((card, index) => {
                setTimeout(() => {
                    card.style.animation = 'fadeInUp 0.4s ease-out';
                }, index * 100);
            });
        }, 100);
        
    } catch (error) {
        console.error('Error loading summary:', error);
        showNotification('Failed to load financial summary', 'error');
    } finally {
        hideLoading('summaryGrid');
    }
}

// Enhanced data loading with better UX
async function loadIncome() {
    try {
        showLoading('incomeList');
        const income = await apiCall('/api/income');
        const incomeList = document.getElementById('incomeList');
        
        if (income.length === 0) {
            incomeList.innerHTML = `
                <div class="empty-state">
                    ?? No income sources added yet
                    <br><small>Add your first income source above to get started!</small>
                </div>
            `;
            return;
        }
        
        incomeList.innerHTML = income.map(item => {
            let details = `${capitalize(item.frequency)}`;
            if (item.deposit_day && item.frequency === 'monthly') {
                details += ` • ${getOrdinal(item.deposit_day)} of month`;
            }
            if (item.specific_date) {
                details += ` • ${formatDate(item.specific_date)}`;
            }
            details += ` • Started ${formatDate(item.start_date)}`;
            if (item.end_date) {
                details += ` • Ends ${formatDate(item.end_date)}`;
            }

            return `
                <div class="item">
                    <div class="item-info">
                        <div class="item-name">?? ${item.source}</div>
                        <div class="item-details">${details}</div>
                    </div>
                    <div class="item-actions">
                        <div class="item-amount positive">${formatCurrency(item.amount)}</div>
                        <button class="btn btn-delete" onclick="deleteIncome(${item.id})">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading income:', error);
        showNotification('Failed to load income sources', 'error');
    } finally {
        hideLoading('incomeList');
    }
}

async function loadExpenses() {
    try {
        showLoading('expenseList');
        const expenses = await apiCall('/api/expenses');
        const expenseList = document.getElementById('expenseList');
        
        if (expenses.length === 0) {
            expenseList.innerHTML = `
                <div class="empty-state">
                    ?? No expenses added yet
                    <br><small>Add your first expense above to start tracking!</small>
                </div>
            `;
            return;
        }
        
        expenseList.innerHTML = expenses.map(item => {
            let details = `${capitalize(item.frequency)}`;
            if (item.payment_day && item.frequency === 'monthly') {
                details += ` • ${getOrdinal(item.payment_day)} of month`;
            }
            if (item.specific_date) {
                details += ` • ${formatDate(item.specific_date)}`;
            }
            details += ` • ${item.category || 'No category'}`;
            details += ` • Started ${formatDate(item.start_date)}`;
            if (item.end_date) {
                details += ` • Ends ${formatDate(item.end_date)}`;
            }
            if (!item.is_recurring) {
                details += ' • One-time';
            }

            const categoryIcon = getCategoryIcon(item.category);

            return `
                <div class="item">
                    <div class="item-info">
                        <div class="item-name">${categoryIcon} ${item.name}</div>
                        <div class="item-details">${details}</div>
                    </div>
                    <div class="item-actions">
                        <div class="item-amount negative">${formatCurrency(item.amount)}</div>
                        <button class="btn btn-delete" onclick="deleteExpense(${item.id})">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading expenses:', error);
        showNotification('Failed to load expenses', 'error');
    } finally {
        hideLoading('expenseList');
    }
}

function getCategoryIcon(category) {
    if (!category) return '[EXPENSE]';
    
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('housing') || categoryLower.includes('rent')) return '[HOME]';
    if (categoryLower.includes('food') || categoryLower.includes('grocery')) return '[FOOD]';
    if (categoryLower.includes('transport') || categoryLower.includes('car')) return '[TRANSPORT]';
    if (categoryLower.includes('utilities') || categoryLower.includes('electric')) return '[UTILITIES]';
    if (categoryLower.includes('entertainment')) return '[ENTERTAINMENT]';
    if (categoryLower.includes('health') || categoryLower.includes('medical')) return '[HEALTH]';
    if (categoryLower.includes('shopping') || categoryLower.includes('clothes')) return '[SHOPPING]';
    return '[EXPENSE]';
}

async function loadBudget() {
    try {
        showLoading('budgetList');
        const budget = await apiCall('/api/budget');
        const budgetList = document.getElementById('budgetList');
        
        if (budget.length === 0) {
            budgetList.innerHTML = `
                <div class="empty-state">
                    ?? No budget categories set yet
                    <br><small>Set your first budget category above to track spending!</small>
                </div>
            `;
            return;
        }
        
        budgetList.innerHTML = budget.map(item => {
            const categoryIcon = getCategoryIcon(item.category);
            return `
                <div class="item">
                    <div class="item-info">
                        <div class="item-name">${categoryIcon} ${item.category}</div>
                        <div class="item-details">Monthly budget limit</div>
                    </div>
                    <div class="item-amount neutral">${formatCurrency(item.budgeted_amount)}</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading budget:', error);
        showNotification('Failed to load budget categories', 'error');
    } finally {
        hideLoading('budgetList');
    }
}

async function loadSavings() {
    try {
        showLoading('savingsList');
        const savings = await apiCall('/api/savings');
        const savingsList = document.getElementById('savingsList');
        
        if (savings.length === 0) {
            savingsList.innerHTML = `
                <div class="empty-state">
                    ?? No savings goals set yet
                    <br><small>Create your first savings goal above to start building wealth!</small>
                </div>
            `;
            return;
        }
        
        savingsList.innerHTML = savings.map(item => {
            const progress = (parseFloat(item.current_amount) / parseFloat(item.target_amount)) * 100;
            const remaining = parseFloat(item.target_amount) - parseFloat(item.current_amount);
            const progressClass = progress >= 100 ? 'success' : progress >= 75 ? 'warning' : 'info';
            
            return `
                <div class="savings-goal">
                    <div class="item-name">?? ${item.name}</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(progress, 100)}%; background: var(--gradient-${progressClass});"></div>
                    </div>
                    <div class="savings-progress">
                        <span>${formatCurrency(item.current_amount)} / ${formatCurrency(item.target_amount)}</span>
                        <span>${progress.toFixed(1)}% complete</span>
                    </div>
                    ${remaining > 0 ? `<div style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">?? ${formatCurrency(remaining)} remaining</div>` : ''}
                    ${item.target_date ? `<div style="font-size: 13px; color: var(--text-muted); margin-top: 5px;">??? Target: ${formatDateLong(item.target_date)}</div>` : ''}
                    ${item.monthly_contribution > 0 ? `<div style="font-size: 13px; color: var(--success); margin-top: 5px;">?? ${formatCurrency(item.monthly_contribution)}/month</div>` : ''}
                    <div class="savings-update">
                        <input type="number" step="0.01" placeholder="Update amount" id="update_${item.id}" class="form-input">
                        <button class="btn btn-update" onclick="updateSavings(${item.id})">Update</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading savings:', error);
        showNotification('Failed to load savings goals', 'error');
    } finally {
        hideLoading('savingsList');
    }
}

async function loadCashFlow() {
    try {
        const days = document.getElementById('cashflowDays').value;
        const cashFlow = await apiCall(`/api/cashflow?days=${days}`);
        const cashFlowList = document.getElementById('cashFlowList');
        
        if (cashFlow.length === 0) {
            cashFlowList.innerHTML = `
                <div class="empty-state">
                    ?? No cash flow data available
                    <br><small>Add income and expenses to see your financial forecast!</small>
                </div>
            `;
            return;
        }
        
        cashFlowList.innerHTML = cashFlow.map((day, index) => {
            const dayClass = day.runningBalance < 0 ? 'negative' : 
                           day.runningBalance < 100 ? 'warning' : '';
            
            const transactionText = day.transactions.length > 0 ? 
                day.transactions.map(t => {
                    const icon = t.type === 'income' ? '??' : getCategoryIcon(t.category);
                    return `${icon} ${t.description}: ${formatCurrency(t.amount)}`;
                }).join('<br>') :
                '?? No transactions';
            
            const isToday = new Date(day.date).toDateString() === new Date().toDateString();
            const dateLabel = isToday ? '??? Today' : formatDate(day.date);
            
            return `
                <div class="cash-flow-day ${dayClass}" style="animation-delay: ${index * 50}ms;">
                    <div>
                        <div class="cash-flow-date">${dateLabel}</div>
                        <div class="cash-flow-transactions">${transactionText}</div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 5px;">
                            ?? Daily change: <span class="${day.dailyTotal >= 0 ? 'positive' : 'negative'}">${formatCurrency(day.dailyTotal)}</span>
                        </div>
                    </div>
                    <div class="cash-flow-balance ${day.runningBalance < 0 ? 'negative' : 'positive'}">
                        ${formatCurrency(day.runningBalance)}
                    </div>
                </div>
            `;
        }).join('');
        
        // Add staggered animation
        setTimeout(() => {
            document.querySelectorAll('.cash-flow-day').forEach((day, index) => {
                setTimeout(() => {
                    day.style.animation = 'fadeInUp 0.4s ease-out';
                    day.style.opacity = '1';
                }, index * 50);
            });
        }, 100);
        
    } catch (error) {
        console.error('Error loading cash flow:', error);
        showNotification('Failed to load cash flow projection', 'error');
    }
}

async function loadUpcomingPayments() {
    try {
        const cashFlow = await apiCall('/api/cashflow?days=7');
        const upcomingPayments = document.getElementById('upcomingPayments');
        
        const payments = [];
        cashFlow.forEach(day => {
            day.transactions.forEach(transaction => {
                if (transaction.type === 'expense') {
                    payments.push({
                        date: day.date,
                        ...transaction
                    });
                }
            });
        });
        
        if (payments.length === 0) {
            upcomingPayments.innerHTML = `
                <div class="empty-state">
                    ?? No payments due in next 7 days
                    <br><small>You're all caught up!</small>
                </div>
            `;
            return;
        }
        
        upcomingPayments.innerHTML = payments.map(payment => {
            const daysUntil = Math.ceil((new Date(payment.date) - new Date()) / (1000 * 60 * 60 * 24));
            const urgencyClass = daysUntil <= 1 ? 'overdue' : daysUntil <= 3 ? 'upcoming' : '';
            const urgencyText = daysUntil === 0 ? 'Due today!' : daysUntil === 1 ? 'Due tomorrow' : `Due in ${daysUntil} days`;
            const categoryIcon = getCategoryIcon(payment.category);
            
            return `
                <div class="item ${urgencyClass}">
                    <div class="item-info">
                        <div class="item-name">${categoryIcon} ${payment.description}</div>
                        <div class="item-details">? ${urgencyText} • ${payment.category || 'Uncategorized'}</div>
                    </div>
                    <div class="item-amount negative">${formatCurrency(Math.abs(payment.amount))}</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading upcoming payments:', error);
        showNotification('Failed to load upcoming payments', 'error');
    }
}

// Enhanced form submissions with better UX
document.addEventListener('DOMContentLoaded', () => {
    // Quick transaction form
    document.getElementById('quickTransactionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Adding...';
        submitBtn.disabled = true;
        
        try {
            const type = document.getElementById('quickType').value;
            const description = document.getElementById('quickDescription').value;
            const amount = parseFloat(document.getElementById('quickAmount').value);
            const date = document.getElementById('quickDate').value;
            
            const endpoint = type === 'income' ? '/api/income' : '/api/expenses';
            const formData = type === 'income' ? {
                source: description,
                amount: amount,
                frequency: 'one-time',
                specific_date: date,
                start_date: date
            } : {
                name: description,
                amount: amount,
                frequency: 'one-time',
                specific_date: date,
                start_date: date,
                is_recurring: false
            };
            
            await apiCall(endpoint, 'POST', formData);
            e.target.reset();
            
            // Set default date to today
            document.getElementById('quickDate').value = new Date().toISOString().split('T')[0];
            
            await Promise.all([loadSummary(), loadUpcomingPayments()]);
            
            const emoji = type === 'income' ? '??' : '??';
            showNotification(`${emoji} Transaction added successfully!`, 'success');
            
        } catch (error) {
            console.error('Error adding transaction:', error);
            showNotification('Failed to add transaction. Please try again.', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    // Income form
    document.getElementById('incomeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Adding...';
        submitBtn.disabled = true;
        
        try {
            const formData = {
                source: document.getElementById('incomeSource').value,
                amount: parseFloat(document.getElementById('incomeAmount').value),
                frequency: document.getElementById('incomeFrequency').value,
                deposit_day: document.getElementById('incomeDepositDay').value || null,
                specific_date: document.getElementById('incomeSpecificDate').value || null,
                start_date: document.getElementById('incomeStartDate').value,
                end_date: document.getElementById('incomeEndDate').value || null
            };
            
            await apiCall('/api/income', 'POST', formData);
            e.target.reset();
            toggleIncomeOptions();
            
            // Set default date to today
            document.getElementById('incomeStartDate').value = new Date().toISOString().split('T')[0];
            
            await Promise.all([loadIncome(), loadSummary()]);
            showNotification('?? Income source added successfully!', 'success');
            
        } catch (error) {
            console.error('Error adding income:', error);
            showNotification('Failed to add income source. Please try again.', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    // Expense form
    document.getElementById('expenseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Adding...';
        submitBtn.disabled = true;
        
        try {
            const formData = {
                name: document.getElementById('expenseName').value,
                amount: parseFloat(document.getElementById('expenseAmount').value),
                frequency: document.getElementById('expenseFrequency').value,
                payment_day: document.getElementById('expensePaymentDay').value || null,
                specific_date: document.getElementById('expenseSpecificDate').value || null,
                category: document.getElementById('expenseCategory').value || null,
                start_date: document.getElementById('expenseStartDate').value,
                end_date: document.getElementById('expenseEndDate').value || null,
                is_recurring: document.getElementById('expenseRecurring').checked
            };
            
            await apiCall('/api/expenses', 'POST', formData);
            e.target.reset();
            toggleExpenseOptions();
            
            // Reset checkbox and set default date
            document.getElementById('expenseRecurring').checked = true;
            document.getElementById('expenseStartDate').value = new Date().toISOString().split('T')[0];
            
            await Promise.all([loadExpenses(), loadSummary()]);
            showNotification('?? Expense added successfully!', 'success');
            
        } catch (error) {
            console.error('Error adding expense:', error);
            showNotification('Failed to add expense. Please try again.', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    // Budget form
    document.getElementById('budgetForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Setting...';
        submitBtn.disabled = true;
        
        try {
            const formData = {
                category: document.getElementById('budgetCategory').value,
                budgeted_amount: parseFloat(document.getElementById('budgetAmount').value)
            };
            
            await apiCall('/api/budget', 'POST', formData);
            e.target.reset();
            
            await Promise.all([loadBudget(), loadSummary()]);
            showNotification('?? Budget category set successfully!', 'success');
            
        } catch (error) {
            console.error('Error setting budget:', error);
            showNotification('Failed to set budget. Please try again.', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    // Savings form
    document.getElementById('savingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Adding...';
        submitBtn.disabled = true;
        
        try {
            const formData = {
                name: document.getElementById('savingsName').value,
                target_amount: parseFloat(document.getElementById('savingsTarget').value),
                current_amount: parseFloat(document.getElementById('savingsCurrent').value) || 0,
                target_date: document.getElementById('savingsTargetDate').value || null,
                monthly_contribution: parseFloat(document.getElementById('savingsMonthly').value) || 0
            };
            
            await apiCall('/api/savings', 'POST', formData);
            e.target.reset();
            
            await loadSavings();
            showNotification('?? Savings goal added successfully!', 'success');
            
        } catch (error) {
            console.error('Error adding savings goal:', error);
            showNotification('Failed to add savings goal. Please try again.', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
});

// Enhanced delete functions with confirmation
async function deleteIncome(id) {
    if (!confirm('??? Are you sure you want to delete this income source?\n\nThis action cannot be undone.')) {
        return;
    }
    
    try {
        await apiCall(`/api/income/${id}`, 'DELETE');
        await Promise.all([loadIncome(), loadSummary(), loadUpcomingPayments()]);
        showNotification('Income source deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting income:', error);
        showNotification('Failed to delete income source', 'error');
    }
}

async function deleteExpense(id) {
    if (!confirm('??? Are you sure you want to delete this expense?\n\nThis action cannot be undone.')) {
        return;
    }
    
    try {
        await apiCall(`/api/expenses/${id}`, 'DELETE');
        await Promise.all([loadExpenses(), loadSummary(), loadUpcomingPayments()]);
        showNotification('Expense deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting expense:', error);
        showNotification('Failed to delete expense', 'error');
    }
}

async function updateSavings(id) {
    const input = document.getElementById(`update_${id}`);
    const newAmount = parseFloat(input.value);
    
    if (isNaN(newAmount) || newAmount < 0) {
        showNotification('Please enter a valid amount', 'error');
        input.focus();
        return;
    }

    try {
        await apiCall(`/api/savings/${id}`, 'PUT', { current_amount: newAmount });
        await loadSavings();
        input.value = '';
        showNotification(`?? Savings updated to ${formatCurrency(newAmount)}!`, 'success');
    } catch (error) {
        console.error('Error updating savings:', error);
        showNotification('Failed to update savings', 'error');
    }
}

// Initialize the app with loading states
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Set default dates to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('incomeStartDate').value = today;
        document.getElementById('expenseStartDate').value = today;
        document.getElementById('quickDate').value = today;
        
        // Show loading states
        showLoading('summaryGrid');
        
        // Load all data with proper error handling
        const loadPromises = [
            loadBalance(),
            loadSummary(),
            loadIncome(),
            loadExpenses(),
            loadBudget(),
            loadSavings(),
            loadUpcomingPayments()
        ];
        
        await Promise.allSettled(loadPromises);
        
        // Show welcome notification for first-time users
        setTimeout(() => {
            const hasData = document.querySelectorAll('.empty-state').length < 6;
            if (!hasData) {
                showNotification('Welcome! ?? Start by adding your current balance above.', 'info');
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Failed to load application data', 'error');
    } finally {
        hideLoading('summaryGrid');
    }
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case '1':
                    e.preventDefault();
                    showTab('overview');
                    break;
                case '2':
                    e.preventDefault();
                    showTab('income');
                    break;
                case '3':
                    e.preventDefault();
                    showTab('expenses');
                    break;
                case '4':
                    e.preventDefault();
                    showTab('budget');
                    break;
                case '5':
                    e.preventDefault();
                    showTab('cashflow');
                    break;
                case '6':
                    e.preventDefault();
                    showTab('savings');
                    break;
            }
        }
    });
});

// Add smooth scrolling for better UX
document.documentElement.style.scrollBehavior = 'smooth';