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

// Middleware Configuration
app.use(cors({
    origin: '*', // සියලුම Origins වලට අවසර ලබා දීම (CORS Error මඟහැරීමට)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet({
    contentSecurityPolicy: false // Development වලදී CDNs බ්ලොක් වීම වැළැක්වීමට
}));
app.use(bodyParser.json());

process.env.TZ = 'Asia/Colombo';

// Testing Endpoint
app.get('/api/test', (req, res) => {
    res.json({ status: "Backend Server is Running Nicely!" });
});

// Admin Register Endpoint (Fixed & Verified)
app.post('/api/auth/register', async (req, res) => {
    console.log("Registration Request Received:", req.body);
    const { fullName, companyName, phone, email, username, password } = req.body;
    
    if (!fullName || !companyName || !username || !password) {
        return res.status(400).json({ error: 'Required fields are missing.' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const companyCode = 'SLB' + Math.floor(1000 + Math.random() * 9000);

        const query = `INSERT INTO companies (company_code, full_name, company_name, phone, email, username, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        db.run(query, [companyCode, fullName, companyName, phone || '', email || '', username, passwordHash], function(err) {
            if (err) {
                console.error("Database Insert Error:", err.message);
                return res.status(400).json({ error: 'Username or Email already exists in Database.' });
            }
            console.log(`Successfully Registered: ${companyCode}`);
            return res.json({ success: true, companyCode });
        });
    } catch (e) {
        console.error("Server Error during Hashing:", e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Admin & Employee Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    db.get(`SELECT * FROM companies WHERE username = ?`, [username], async (err, admin) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (admin && await bcrypt.compare(password, admin.password_hash)) {
            const token = jwt.sign({ companyCode: admin.company_code, role: 'ADMIN', name: admin.full_name }, JWT_SECRET);
            return res.json({ token, role: 'ADMIN', name: admin.full_name, companyCode: admin.company_code });
        }

        db.get(`SELECT * FROM employees WHERE username = ?`, [username], async (err, emp) => {
            if (emp && await bcrypt.compare(password, emp.password_hash)) {
                const token = jwt.sign({ companyCode: emp.company_code, role: 'EMPLOYEE', name: emp.full_name }, JWT_SECRET);
                return res.json({ token, role: 'EMPLOYEE', name: emp.full_name, companyCode: emp.company_code });
            }
            res.status(400).json({ error: 'Invalid Username or Password' });
        });
    });
});

app.listen(PORT, () => console.log(`🚀 Secure Server successfully running on http://localhost:${PORT}`));
