const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const db = require('./database');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'SL_PROD_SECURE_KEY_2026';

app.use(helmet());
app.use(cors());
app.use(bodyParser.json());

// Timezone Setup for Sri Lanka
process.env.TZ = 'Asia/Colombo';

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access Denied' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid Token' });
        req.user = user;
        next();
    });
};

// --- AUTHENTICATION ENDPOINTS ---

// Admin Register
app.post('/api/auth/register', async (req, res) => {
    const { fullName, companyName, phone, email, username, password } = req.body;
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const companyCode = 'SLB' + Math.floor(1000 + Math.random() * 9000);

        const query = `INSERT INTO companies (company_code, full_name, company_name, phone, email, username, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(query, [companyCode, fullName, companyName, phone, email, username, passwordHash], function(err) {
            if (err) return res.status(400).json({ error: 'Username or Email already exists.' });
            res.json({ success: true, companyCode });
        });
    } catch (e) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// Admin & Employee Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    // Check in Admin Table
    db.get(`SELECT * FROM companies WHERE username = ?`, [username], async (err, admin) => {
        if (admin && await bcrypt.compare(password, admin.password_hash)) {
            const token = jwt.sign({ companyCode: admin.company_code, role: 'ADMIN', name: admin.full_name }, JWT_SECRET);
            return res.json({ token, role: 'ADMIN', name: admin.full_name, companyCode: admin.company_code });
        }

        // Check in Employee Table
        db.get(`SELECT * FROM employees WHERE username = ?`, [username], async (err, emp) => {
            if (emp && await bcrypt.compare(password, emp.password_hash)) {
                const token = jwt.sign({ companyCode: emp.company_code, role: 'EMPLOYEE', name: emp.full_name }, JWT_SECRET);
                return res.json({ token, role: 'EMPLOYEE', name: emp.full_name, companyCode: emp.company_code });
            }
            res.status(400).json({ error: 'Invalid Credentials' });
        });
    });
});

// --- CUSTOMER MANAGEMENT ---
app.post('/api/customers', authenticateToken, (req, res) => {
    const { name, phone, email, address, notes, outstanding } = req.body;
    db.run(`INSERT INTO customers (company_code, name, phone, email, address, notes, outstanding_balance) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.user.companyCode, name, phone, email, address, notes, outstanding], function(err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        });
});

app.get('/api/customers', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM customers WHERE company_code = ?`, [req.user.companyCode], (err, rows) => {
        res.json(rows);
    });
});

app.delete('/api/customers/:id', authenticateToken, (req, res) => {
    db.run(`DELETE FROM customers WHERE id = ? AND company_code = ?`, [req.params.id, req.user.companyCode], () => {
        res.json({ success: true });
    });
});

// --- PRODUCT MANAGEMENT ---
app.post('/api/products', authenticateToken, (req, res) => {
    const { itemName, itemCode, category, costPrice, sellingPrice, quantity, barcode, lowStock } = req.body;
    db.run(`INSERT INTO products (company_code, item_name, item_code, category, cost_price, selling_price, quantity, barcode, low_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.companyCode, itemName, itemCode, category, costPrice, sellingPrice, quantity, barcode, lowStock], function(err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ success: true });
        });
});

app.get('/api/products', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM products WHERE company_code = ?`, [req.user.companyCode], (err, rows) => {
        res.json(rows);
    });
});

// --- ORDER SYSTEM & WORKFLOW ---
app.post('/api/orders', authenticateToken, (req, res) => {
    const { customerId, customerName, itemId, itemName, quantity, unitPrice, paymentMethod } = req.body;
    const orderNumber = 'ORD-' + Date.now();
    const totalAmount = quantity * unitPrice;

    db.run(`INSERT INTO orders (company_code, order_number, customer_id, customer_name, item_id, item_name, quantity, unit_price, total_amount, employee_name, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
        [req.user.companyCode, orderNumber, customerId, customerName, itemId, itemName, quantity, unitPrice, totalAmount, req.user.name, paymentMethod], function(err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ success: true, orderNumber });
        });
});

app.get('/api/orders', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM orders WHERE company_code = ?`, [req.user.companyCode], (err, rows) => {
        res.json(rows);
    });
});

// Admin Order Status Update Workflow
app.put('/api/orders/:id/status', authenticateToken, (req, res) => {
    const { status } = req.body;
    const orderId = req.params.id;

    db.get(`SELECT * FROM orders WHERE id = ? AND company_code = ?`, [orderId, req.user.companyCode], (err, order) => {
        if (!order) return res.status(444).json({ error: 'Order not found' });

        if (status === 'Approved') {
            // Deduct Stock Quantity Automatically
            db.run(`UPDATE products SET quantity = quantity - ? WHERE id = ? AND company_code = ?`, [order.quantity, order.item_id, req.user.companyCode], (err) => {
                db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, orderId], () => {
                    res.json({ success: true, message: 'Approved and stock deducted.' });
                });
            });
        } else {
            db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, orderId], () => {
                res.json({ success: true, message: `Status updated to ${status}.` });
            });
        }
    });
});

// --- EMPLOYEE MANAGEMENT ---
app.post('/api/employees', authenticateToken, async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Unauthorized' });
    const { fullName, username, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    db.run(`INSERT INTO employees (company_code, full_name, username, password_hash) VALUES (?, ?, ?, ?)`,
        [req.user.companyCode, fullName, username, passwordHash], (err) => {
            if (err) return res.status(400).json({ error: 'Username already exists.' });
            res.json({ success: true });
        });
});

app.get('/api/employees', authenticateToken, (req, res) => {
    db.all(`SELECT id, full_name, username, role FROM employees WHERE company_code = ?`, [req.user.companyCode], (err, rows) => {
        res.json(rows);
    });
});

app.listen(PORT, () => console.log(`Secure Server running on port ${PORT}`));
