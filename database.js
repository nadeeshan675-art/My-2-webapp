const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./sl_business_mgmt.db');
const bcrypt = require('bcrypt');

db.serialize(() => {
    // 1. Companies / Admin Users Table
    db.run(`CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_code TEXT UNIQUE,
        full_name TEXT NOT NULL,
        company_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT UNIQUE,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )`);

    // 2. Employees Table
    db.run(`CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_code TEXT,
        full_name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'EMPLOYEE',
        FOREIGN KEY(company_code) REFERENCES companies(company_code)
    )`);

    // 3. Customers Table
    db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_code TEXT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        notes TEXT,
        outstanding_balance REAL DEFAULT 0.0,
        FOREIGN KEY(company_code) REFERENCES companies(company_code)
    )`);

    // 4. Products / Items Table
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_code TEXT,
        item_name TEXT NOT NULL,
        item_code TEXT UNIQUE,
        category TEXT,
        cost_price REAL DEFAULT 0.0,
        selling_price REAL DEFAULT 0.0,
        quantity INTEGER DEFAULT 0,
        barcode TEXT,
        low_stock_level INTEGER DEFAULT 5,
        FOREIGN KEY(company_code) REFERENCES companies(company_code)
    )`);

    // 5. Orders Table
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_code TEXT,
        order_number TEXT UNIQUE,
        customer_id INTEGER,
        customer_name TEXT,
        item_id INTEGER,
        item_name TEXT,
        quantity INTEGER,
        unit_price REAL,
        total_amount REAL,
        employee_name TEXT,
        payment_method TEXT,
        status TEXT DEFAULT 'Pending',
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(company_code) REFERENCES companies(company_code),
        FOREIGN KEY(customer_id) REFERENCES customers(id),
        FOREIGN KEY(item_id) REFERENCES products(id)
    )`);

    // 6. Activity Logs Table
    db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_code TEXT,
        user_name TEXT,
        action TEXT,
        timestamp DATETIME DEFAULT (datetime('now', 'localtime'))
    )`);
});

module.exports = db;
