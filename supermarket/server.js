const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv'); // Import dotenv

// Load environment variables from .env file
dotenv.config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
// Serve static files (assuming index.html is in the same directory for simplicity)
app.use(express.static('public')); 

// Database configuration (Uses environment variables from .env)
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

// Database connection pool
let pool;

// --- Database Initialization ---

async function initializeDatabase() {
    try {
        // Create the pool
        pool = mysql.createPool(dbConfig);
        
        // Test connection
        const testConn = await pool.getConnection();
        console.log('✅ Database connection pool created successfully');
        testConn.release();
        
        // Check if tables exist, if not create them (Robust check)
        await checkAndCreateTables();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// 💥 FIX: This robust function ensures the schema is always checked and fixed 💥
async function checkAndCreateTables() {
    const connection = await pool.getConnection();
    try {
        console.log('🔄 Ensuring all database tables and schema are correct...');
        
        // Always run createAllTables. The IF NOT EXISTS clause makes this safe.
        await createAllTables(connection);
        
        // Fix: Add employee_id column to inventory_transactions if it doesn't exist
        try {
            await connection.execute(
                `ALTER TABLE inventory_transactions 
                 ADD COLUMN employee_id INT,
                 ADD FOREIGN KEY (employee_id) REFERENCES employees(employee_id)`
            );
            console.log('✅ Added employee_id column to inventory_transactions');
        } catch (err) {
            // Column already exists or other error - ignore
            if (!err.message.includes('Duplicate column name')) {
                console.log('ℹ️  inventory_transactions schema already up to date');
            }
        }
        
        // Check if sample data is needed (e.g., check for employee_id 1)
        const [employees] = await connection.execute("SELECT COUNT(*) as count FROM employees");
        if (employees[0].count === 0) {
            console.log('📦 Inserting sample data...');
            await insertSampleData(connection);
        }
        
        console.log('✅ Database schema verified.');
        
    } catch (error) {
        console.error('❌ Error checking or creating tables:', error.message);
    } finally {
        connection.release();
    }
}


// Create all tables
async function createAllTables(connection) {
    const tableQueries = [
        `CREATE TABLE IF NOT EXISTS categories (
            category_id INT PRIMARY KEY AUTO_INCREMENT,
            category_name VARCHAR(100) NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        
        `CREATE TABLE IF NOT EXISTS products (
            product_id INT PRIMARY KEY AUTO_INCREMENT,
            product_name VARCHAR(255) NOT NULL,
            category_id INT,
            price DECIMAL(10,2) NOT NULL,
            stock_quantity INT NOT NULL DEFAULT 0,
            barcode VARCHAR(50) UNIQUE,
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL
        )`,
        
        `CREATE TABLE IF NOT EXISTS customers (
            customer_id INT PRIMARY KEY AUTO_INCREMENT,
            customer_name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(20),
            address TEXT,
            loyalty_points INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        
        `CREATE TABLE IF NOT EXISTS employees (
            employee_id INT PRIMARY KEY AUTO_INCREMENT,
            employee_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE,
            phone VARCHAR(20),
            role VARCHAR(100) NOT NULL,
            salary DECIMAL(10,2),
            hire_date DATE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        
        `CREATE TABLE IF NOT EXISTS bills (
            bill_id INT PRIMARY KEY AUTO_INCREMENT,
            bill_number VARCHAR(50) UNIQUE NOT NULL,
            customer_id INT,
            employee_id INT NOT NULL, -- This is the crucial field
            total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            discount DECIMAL(10,2) DEFAULT 0,
            tax_amount DECIMAL(10,2) DEFAULT 0,
            final_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            payment_method ENUM('cash', 'card', 'upi', 'wallet') DEFAULT 'cash',
            bill_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        )`,
        
        `CREATE TABLE IF NOT EXISTS bill_items (
            bill_item_id INT PRIMARY KEY AUTO_INCREMENT,
            bill_id INT NOT NULL,
            product_id INT NOT NULL,
            quantity INT NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            total_price DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (bill_id) REFERENCES bills(bill_id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(product_id)
        )`,
        
        `CREATE TABLE IF NOT EXISTS inventory_transactions (
            transaction_id INT PRIMARY KEY AUTO_INCREMENT,
            product_id INT NOT NULL,
            transaction_type ENUM('IN', 'OUT', 'ADJUST') NOT NULL,
            quantity INT NOT NULL,
            employee_id INT,
            transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            FOREIGN KEY (product_id) REFERENCES products(product_id),
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        )`
    ];
    
    for (const query of tableQueries) {
        await connection.execute(query);
    }
}

// Insert sample data
async function insertSampleData(connection) {
    // 1. Employee
    await connection.execute(
        `INSERT INTO employees (employee_name, email, phone, role) 
         VALUES ('Admin User', 'admin@supermarket.com', '9876543210', 'Manager')`
    );

    // 2. Categories
    await connection.execute(
        `INSERT INTO categories (category_name) VALUES ('Groceries'), ('Beverages'), ('Snacks')`
    );

    // 3. Products
    await connection.execute(
        `INSERT INTO products (product_name, category_id, price, stock_quantity, barcode) 
         VALUES ('Apple', 1, 100.00, 50, '1234567890')`
    );
    await connection.execute(
        `INSERT INTO products (product_name, category_id, price, stock_quantity, barcode) 
         VALUES ('Coke 2L', 2, 85.00, 15, '1234567891')`
    );
    await connection.execute(
        `INSERT INTO products (product_name, category_id, price, stock_quantity, barcode) 
         VALUES ('Potato Chips', 3, 20.00, 5, '1234567892')`
    ); // Low Stock item

    // 4. Customer
    await connection.execute(
        `INSERT INTO customers (customer_name, email, phone) 
         VALUES ('John Doe', 'john.doe@email.com', '9988776655')`
    );
}

// Helper function to execute queries
async function executeQuery(sql, params = []) {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute(sql, params);
        return rows;
    } catch (error) {
        console.error('Query Error:', error.message);
        throw error;
    } finally {
        connection.release();
    }
}

// --- API Routes ---

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running' });
});

// Get all products (with stock status)
app.get('/api/products', async (req, res) => {
    try {
        const rows = await executeQuery(`
             SELECT 
                p.product_id, 
                p.product_name, 
                p.category_id,
                c.category_name, 
                p.price, 
                p.stock_quantity, 
                p.barcode, 
                p.description,
                CASE 
                    WHEN p.stock_quantity <= 0 THEN 'Out of Stock' 
                    WHEN p.stock_quantity < 10 THEN 'Low Stock' 
                    ELSE 'In Stock' 
                END as stock_status
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.is_active = TRUE
        `);
        res.json(rows);
    } catch (error) {
        console.error('API Error (/api/products):', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get all categories
app.get('/api/categories', async (req, res) => {
    try {
        const rows = await executeQuery('SELECT * FROM categories');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Get all customers
app.get('/api/customers', async (req, res) => {
    try {
        const rows = await executeQuery('SELECT customer_id, customer_name, email, phone, loyalty_points FROM customers');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});


// --- CRITICAL BILLING ROUTE (CART CHECKOUT) ---
app.post('/api/bills', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Destructure and Validate input data
        const { customer_id, employee_id, payment_method, discount, items } = req.body;

        if (!employee_id || !items || items.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Missing required bill information (employee_id, items).' });
        }
        
        let total_amount = 0; // Pre-discount/Pre-tax total (Sum of item_total_price)
        const itemsToInsert = [];

        // 2. Validate stock, enforce server-side pricing, and calculate total_amount
        for (const item of items) {
            const [productRows] = await connection.execute(
                `SELECT price, stock_quantity, product_name FROM products WHERE product_id = ?`,
                [item.product_id]
            );

            if (productRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ error: `Product with ID ${item.product_id} not found.` });
            }

            const product = productRows[0];
            const requestedQuantity = parseInt(item.quantity);
            
            if (requestedQuantity <= 0 || isNaN(requestedQuantity)) {
                continue; // Skip invalid quantities
            }
            
            // Stock Validation
            if (requestedQuantity > product.stock_quantity) {
                await connection.rollback();
                return res.status(409).json({ error: `Insufficient stock for ${product.product_name}. Available: ${product.stock_quantity}, Requested: ${requestedQuantity}` });
            }
            
            // Server-side price calculation (Security)
            const unit_price = parseFloat(product.price);
            const item_total = unit_price * requestedQuantity;
            total_amount += item_total;
            
            itemsToInsert.push({
                product_id: item.product_id,
                quantity: requestedQuantity,
                unit_price: unit_price,
                total_price: item_total
            });
        }
        
        // Final Total Calculation
        const finalDiscount = Math.min(parseFloat(discount) || 0, total_amount); // Cap discount at total amount
        const tax_rate = 0.05; // 5% Tax
        const subtotal_after_discount = total_amount - finalDiscount;
        const tax_amount = subtotal_after_discount * tax_rate;
        const final_amount = subtotal_after_discount + tax_amount;
        
        // 3. Create Bill Header
        const billNumber = `BILL-${Date.now()}`;
        const [billResult] = await connection.execute(
            `INSERT INTO bills 
             (bill_number, customer_id, employee_id, total_amount, discount, tax_amount, final_amount, payment_method) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [billNumber, customer_id || null, employee_id, total_amount, finalDiscount, tax_amount, final_amount, payment_method]
        );
        const billId = billResult.insertId;

        // 4. Insert Bill Items and Update Stock (and Inventory)
        for (const item of itemsToInsert) {
            // Insert into bill_items
            await connection.execute(
                `INSERT INTO bill_items 
                 (bill_id, product_id, quantity, unit_price, total_price) 
                 VALUES (?, ?, ?, ?, ?)`,
                [billId, item.product_id, item.quantity, item.unit_price, item.total_price]
            );

            // Update product stock quantity (Decrement)
            await connection.execute(
                `UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?`,
                [item.quantity, item.product_id]
            );
            
            // Insert Inventory Transaction (OUT)
            await connection.execute(
                `INSERT INTO inventory_transactions (product_id, transaction_type, quantity, employee_id, notes) 
                 VALUES (?, 'OUT', ?, ?, 'Sale via Bill ${billNumber}')`,
                [item.product_id, item.quantity, employee_id]
            );
        }

        // 5. Commit Transaction and Respond
        // Fetch full bill details for receipt printing on the client
        const [billDetails] = await connection.execute(
            `SELECT b.*, c.customer_name, e.employee_name FROM bills b 
             LEFT JOIN customers c ON b.customer_id = c.customer_id
             JOIN employees e ON b.employee_id = e.employee_id WHERE b.bill_id = ?`,
            [billId]
        );
        const [billItemsDetails] = await connection.execute(
            `SELECT bi.*, p.product_name, p.barcode FROM bill_items bi 
             JOIN products p ON bi.product_id = p.product_id WHERE bi.bill_id = ?`,
            [billId]
        );
        
        await connection.commit();
        res.json({ bill: billDetails[0], items: billItemsDetails, message: 'Bill created successfully' });

    } catch (error) {
        await connection.rollback();
        console.error('API Error (/api/bills):', error);
        // Catch specific SQL errors or general exceptions
        res.status(500).json({ error: 'Failed to create bill: ' + error.message });
    } finally {
        connection.release();
    }
});


// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize and start server
async function startServer() {
    console.log('🚀 Starting Supermarket Billing System...\n');
    
    try {
        // Initialize database connection
        const dbConnected = await initializeDatabase();
        
        if (!dbConnected) {
            console.log('❌ Database connection failed. Starting in limited mode.');
        }
        
        // Start the server
        app.listen(PORT, () => {
            console.log(`\n✨ Supermarket Billing System running on port ${PORT}`);
            console.log(`🌐 Access the application at: http://localhost:${PORT}`);
            console.log(`🔍 API Health check: http://localhost:${PORT}/api/health`);
            console.log('\n🎉 System is ready! All features are available.');
        });
    } catch (error) {
        console.error('💥 Failed to start server:', error);
        process.exit(1);
    }
}

startServer();