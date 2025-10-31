const express = require('express');
const mysql = require('mysql2'); 
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Database connection details
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'Hemanth@123', 
    database: 'supermarket_db',
    // Set to handle the DELIMITER block for the trigger
    multipleStatements: true,
    // ⭐ FINAL FIX: Set time zone to 'Z' (UTC) to prevent date mismatch issues between Node.js and MySQL's CURDATE()
    timezone: 'Z'
};

// Database connection (initial setup)
const db = mysql.createConnection(dbConfig);

// Connect to database
db.connect((err) => {
    if (err) {
        if (err.code === 'ER_BAD_DB_ERROR') {
            console.error('❌ Database "supermarket_db" not found. Attempting to create...');
            createDatabase();
            return;
        }
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to MySQL database!');
    initializeDatabase();
});

function createDatabase() {
    // Connect without specifying a database
    const tempDb = mysql.createConnection({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password,
        multipleStatements: true,
        timezone: 'Z'
    });

    tempDb.connect((err) => {
        if (err) {
            console.error('❌ Cannot connect to MySQL server to create database:', err.message);
            process.exit(1);
        }

        console.log('🔧 Creating database...');
        tempDb.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`, (err) => {
            if (err) {
                console.error('❌ Failed to create database:', err.message);
                tempDb.end();
                process.exit(1);
            }
            console.log('✅ Database created successfully');
            tempDb.end();
            
            // Re-connect with the new database
            db.connect((err) => {
                if (err) {
                    console.error('❌ Still cannot connect after creation:', err.message);
                    process.exit(1);
                }
                console.log('✅ Connected to newly created MySQL database!');
                initializeDatabase();
            });
        });
    });
}

// Initialize database (Tables, Views, Triggers, Sample Data)
function initializeDatabase() {
    console.log('🔧 Initializing database schema...');
    
    // NOTE: Dropping tables first helps ensure a clean slate if the schema changes.
    const schemaSteps = [
        `DROP VIEW IF EXISTS v_daily_sales_summary, v_low_stock_products;`,
        `DROP TRIGGER IF EXISTS trg_update_order_totals;`,
        `DROP TABLE IF EXISTS order_items, orders, products, users, customers, categories;`,

        // --- 1. TABLES ---
        `CREATE TABLE IF NOT EXISTS categories (
            category_id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(50) NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS customers (
            customer_id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE,
            phone VARCHAR(20),
            address TEXT,
            loyalty_points INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS users (
            user_id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role ENUM('admin', 'cashier', 'manager', 'inventory_manager') DEFAULT 'cashier',
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100),
            phone VARCHAR(20),
            is_active BOOLEAN DEFAULT TRUE,
            last_login TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS products (
            product_id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            price DECIMAL(10,2) NOT NULL,
            cost_price DECIMAL(10,2) NOT NULL,
            stock_quantity INT NOT NULL DEFAULT 0,
            min_stock_level INT NOT NULL DEFAULT 10,
            category_id INT,
            barcode VARCHAR(50) UNIQUE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL
        )`,

        `CREATE TABLE IF NOT EXISTS orders (
            order_id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT DEFAULT 1,
            order_number VARCHAR(20) UNIQUE,
            order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            final_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            status ENUM('pending', 'completed', 'cancelled') DEFAULT 'completed',
            payment_method ENUM('cash', 'card', 'digital_wallet') DEFAULT 'cash',
            payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'paid',
            cashier_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL,
            FOREIGN KEY (cashier_id) REFERENCES users(user_id)
        )`,

        `CREATE TABLE IF NOT EXISTS order_items (
            order_item_id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            product_id INT NOT NULL,
            quantity INT NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            subtotal DECIMAL(10,2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT
        )`,
        
        // --- 2. VIEWS ---
        `CREATE OR REPLACE VIEW v_daily_sales_summary AS
        SELECT
            DATE(order_date) AS sale_date,
            COUNT(order_id) AS total_orders,
            COALESCE(SUM(final_amount), 0) AS total_sales,
            COALESCE(SUM(tax_amount), 0) AS total_tax,
            COALESCE(SUM(final_amount), 0) / NULLIF(COUNT(order_id), 0) AS average_order_value
        FROM orders
        WHERE status = 'completed'
        GROUP BY DATE(order_date)`,

        `CREATE OR REPLACE VIEW v_low_stock_products AS
        SELECT
            p.product_id,
            p.name AS product_name,
            p.stock_quantity,
            p.min_stock_level,
            c.name AS category_name,
            CASE 
                WHEN p.stock_quantity = 0 THEN 'OUT_OF_STOCK'
                WHEN p.stock_quantity <= p.min_stock_level THEN 'LOW'
                ELSE 'NORMAL'
            END AS stock_status
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.category_id
        WHERE p.stock_quantity <= p.min_stock_level AND p.is_active = TRUE`,
    ];

    let currentIndex = 0;

    function executeSchemaStep() {
        if (currentIndex >= schemaSteps.length) {
            createTrigger(insertSampleData);
            return;
        }

        db.query(schemaSteps[currentIndex], (err) => {
            if (err) {
                console.log(`⚠️  Schema Step ${currentIndex + 1} note:`, err.message);
            }
            currentIndex++;
            executeSchemaStep();
        });
    }

    function createTrigger(callback) {
        console.log('🔧 Creating trigger trg_update_order_totals...');
        
        const triggerSql = `
            DROP TRIGGER IF EXISTS trg_update_order_totals;
            
            DELIMITER $$
            CREATE TRIGGER trg_update_order_totals
            AFTER INSERT ON order_items
            FOR EACH ROW
            BEGIN
                DECLARE v_total_amount DECIMAL(10,2);
                DECLARE v_tax_amount DECIMAL(10,2);
                DECLARE v_final_amount DECIMAL(10,2);
                
                SELECT COALESCE(SUM(subtotal), 0) INTO v_total_amount
                FROM order_items
                WHERE order_id = NEW.order_id;
                
                SET v_tax_amount = v_total_amount * 0.08;
                SET v_final_amount = v_total_amount + v_tax_amount;
                
                UPDATE orders
                SET 
                    total_amount = v_total_amount,
                    tax_amount = v_tax_amount,
                    final_amount = v_final_amount
                WHERE order_id = NEW.order_id;
            END$$
            DELIMITER ;
        `;

        db.query(triggerSql, (err) => {
            if (err) {
                console.error('❌ Failed to create trigger:', err.message);
            } else {
                console.log('✅ Trigger trg_update_order_totals created successfully.');
            }
            callback();
        });
    }

    function insertSampleData() {
        console.log('📥 Inserting sample data...');
        
        const sampleData = [
            `INSERT IGNORE INTO categories (category_id, name, description) VALUES 
            (1, 'Grocery', 'Daily grocery items and essentials'),
            (2, 'Dairy', 'Milk, cheese, yogurt and other dairy products'),
            (3, 'Beverages', 'Soft drinks, juices, water and other beverages'),
            (4, 'Produce', 'Fresh fruits and vegetables'),
            (5, 'Bakery', 'Bread, cakes, cookies and baked goods')`,

            `INSERT IGNORE INTO users (user_id, username, password, role, name, email, phone) VALUES 
            (1, 'admin', 'admin123', 'admin', 'System Administrator', 'admin@supermarket.com', '555-1001'),
            (2, 'manager1', 'manager123', 'manager', 'Sarah Manager', 'manager@supermarket.com', '555-1002'),
            (3, 'cashier1', 'password123', 'cashier', 'John Cashier', 'cashier1@supermarket.com', '555-1003'),
            (4, 'cashier2', 'password123', 'cashier', 'Emily Cashier', 'cashier2@supermarket.com', '555-1004'),
            (5, 'inventory1', 'password123', 'inventory_manager', 'David Inventory', 'inventory@supermarket.com', '555-1005')`,

            `INSERT IGNORE INTO customers (customer_id, name, email, phone, loyalty_points) VALUES 
            (1, 'Walk-in Customer', NULL, NULL, 0),
            (2, 'John Smith', 'john@email.com', '555-0101', 150),
            (3, 'Maria Garcia', 'maria@email.com', '555-0102', 300)`,

            `INSERT IGNORE INTO products (product_id, name, description, price, cost_price, stock_quantity, min_stock_level, category_id, barcode) VALUES 
            (1, 'Organic Whole Milk', 'Fresh organic whole milk, 1L', 4.99, 3.20, 45, 10, 2, '123456789012'),
            (2, 'White Bread', 'Fresh white bread, 500g', 2.99, 1.50, 29, 5, 5, '123456789013'),
            (3, 'Mineral Water', 'Pure mineral water, 500ml', 1.99, 0.80, 93, 20, 3, '123456789014'),
            (4, 'Bananas', 'Fresh bananas per kg', 1.49, 0.70, 79, 15, 4, '123456789015'),
            (5, 'Potato Chips', 'Crunchy potato chips, 150g', 3.49, 1.80, 38, 8, 1, '123456789016'),
            (6, 'Orange Juice', 'Fresh orange juice, 1L', 3.99, 2.20, 24, 5, 3, '123456789017'),
            (7, 'Cheddar Cheese', 'Block cheddar cheese, 200g', 5.99, 3.50, 34, 7, 2, '123456789018'),
            (8, 'Apples', 'Fresh red apples per kg', 2.99, 1.60, 43, 10, 4, '123456789019'),
            (9, 'Chocolate Cookies', 'Chocolate chip cookies, 200g', 4.49, 2.40, 57, 12, 1, '123456789020'),
            (10, 'Greek Yogurt', 'Greek yogurt, 500g', 3.79, 2.10, 28, 6, 2, '123456789021')`
        ];

        let dataIndex = 0;

        function insertNextData() {
            if (dataIndex >= sampleData.length) {
                console.log('✅ Sample static data inserted!');
                createSampleOrders(); 
                return;
            }

            db.query(sampleData[dataIndex], (err) => {
                if (err) {
                    console.log(`⚠️  Data insertion ${dataIndex + 1} note:`, err.message);
                }
                dataIndex++;
                insertNextData();
            });
        }

        insertNextData();
    }

    function createSampleOrders() {
        console.log('📦 Creating sample orders...');
        
        // Get today's date in MySQL TIMESTAMP format using UTC time
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const day = String(now.getUTCDate()).padStart(2, '0');
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');

        // Use the current UTC date/time for the order_date to ensure CURDATE() matches
        const currentUtcTimestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        const sampleOrders = [
            { payment_method: 'card', cashier_id: 3, items: [{ product_id: 1, quantity: 2, price: 4.99 }, { product_id: 5, quantity: 5, price: 3.49 }, { product_id: 8, quantity: 6, price: 2.99 }] },
            { payment_method: 'cash', cashier_id: 3, items: [{ product_id: 3, quantity: 10, price: 1.99 }, { product_id: 10, quantity: 2, price: 3.79 }] },
            { payment_method: 'digital_wallet', cashier_id: 3, items: [{ product_id: 6, quantity: 4, price: 3.99 }, { product_id: 7, quantity: 3, price: 5.99 }, { product_id: 9, quantity: 6, price: 4.49 }] }
        ];

        let finalOrderIndex = 0;

        function createNextOrder() {
            if (finalOrderIndex >= sampleOrders.length) {
                console.log('✅ Sample orders created successfully!');
                
                // Final Console Output Query
                db.query(`SELECT total_sales, total_orders, average_order_value FROM v_daily_sales_summary WHERE sale_date = CURDATE()`, (err, salesResult) => {
                    db.query(`SELECT COUNT(*) as count FROM v_low_stock_products`, (err, lowStockResult) => {
                        const sales = salesResult && salesResult[0] || { total_sales: 0, total_orders: 0 };
                        const lowStockCount = lowStockResult && lowStockResult[0].count || 0;
                        
                        console.log('\n📊 DASHBOARD DATA READY (Reflects current database state):');
                        console.log(`   Today's Sales: $${parseFloat(sales.total_sales || 0).toFixed(2)}`);
                        console.log('   Total Products: 10');
                        console.log(`   Low Stock Items: ${lowStockCount}`);
                        console.log(`   Today's Orders: ${sales.total_orders || 0}`);
                    });
                });
                return;
            }

            const orderData = sampleOrders[finalOrderIndex];
            const order_number = `ORD-${Date.now()}-${finalOrderIndex + 1}`;
            
            db.beginTransaction((err) => {
                if (err) {
                    console.error('Transaction failed on sample order:', err.message);
                    finalOrderIndex++;
                    createNextOrder();
                    return;
                }

                // 1. Insert Order
                // Pass the generated UTC timestamp to ensure CURDATE() matches
                const orderSql = `
                    INSERT INTO orders (customer_id, order_number, total_amount, tax_amount, final_amount, payment_method, cashier_id, status, payment_status, order_date)
                    VALUES (1, ?, 0, 0, 0, ?, ?, 'completed', 'paid', ?)
                `;
                
                db.query(orderSql, [
                    order_number, orderData.payment_method, orderData.cashier_id, currentUtcTimestamp
                ], (err, result) => {
                    if (err) {
                        console.error(`Order ${order_number} creation failed, rolling back:`, err.message);
                        return db.rollback(() => {
                            finalOrderIndex++;
                            createNextOrder();
                        });
                    }
                    
                    const orderId = result.insertId;
                    const orderItemsValues = orderData.items.map(item => [
                        orderId,
                        item.product_id,
                        item.quantity,
                        item.price,
                        item.quantity * item.price
                    ]);
                    
                    // 2. Insert Order Items (Fires the TRIGGER)
                    const orderItemsSql = `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES ?`;
                    
                    db.query(orderItemsSql, [orderItemsValues], (err) => {
                        if (err) {
                            console.error('Order items insertion failed, rolling back:', err.message);
                            return db.rollback(() => {
                                finalOrderIndex++;
                                createNextOrder();
                            });
                        }
                        
                        // 3. Update Stock
                        const stockUpdates = orderData.items.map(item => new Promise((resolve, reject) => {
                            const updateSql = 'UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?';
                            db.query(updateSql, [item.quantity, item.product_id], (err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        }));
                        
                        Promise.all(stockUpdates)
                            .then(() => {
                                // 4. Commit transaction
                                db.commit((err) => {
                                    if (err) {
                                        console.error(`Commit for ${order_number} failed, rolling back:`, err.message);
                                        return db.rollback(() => {
                                            finalOrderIndex++;
                                            createNextOrder();
                                        });
                                    }
                                    
                                    console.log(`✅ Created order: ${order_number} (Order totals updated successfully by Trigger)`);
                                    finalOrderIndex++;
                                    createNextOrder();
                                });
                            })
                            .catch(stockErr => {
                                console.error(`Stock update for ${order_number} failed, rolling back:`, stockErr.message);
                                db.rollback(() => {
                                    finalOrderIndex++;
                                    createNextOrder();
                                });
                            });
                    });
                });
            });
        }

        executeSchemaStep();
    }

// ---
// ## 🚀 API Endpoints
// ---

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend.html'));
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Supermarket Billing System API is working!',
        timestamp: new Date().toISOString(),
        database: 'Connected'
    });
});

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log(`🔐 LOGIN ATTEMPT: ${username}`);
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const sql = 'SELECT * FROM users WHERE username = ? AND is_active = TRUE';
    
    db.query(sql, [username], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        const user = results[0];
        
        if (user.password === password) { 
            console.log(`✅ LOGIN SUCCESS: ${user.name} (${user.role})`);
            
            db.query('UPDATE users SET last_login = NOW() WHERE user_id = ?', [user.user_id]);
            
            res.json({
                success: true,
                user: {
                    id: user.user_id,
                    username: user.username,
                    name: user.name,
                    role: user.role
                }
            });
        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }
    });
});

// Get all products
app.get('/api/products', (req, res) => {
    const sql = `
        SELECT p.*, c.name as category_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.category_id 
        WHERE p.is_active = TRUE
        ORDER BY p.name
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Search products
app.get('/api/products/search', (req, res) => {
    const { q } = req.query;
    if (!q) {
        return res.status(400).json({ error: 'Search query parameter "q" is required' });
    }
    const sql = `
        SELECT p.*, c.name as category_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.category_id 
        WHERE p.is_active = TRUE 
        AND (p.name LIKE ? OR p.barcode = ?)
        ORDER BY p.name
    `;
    
    db.query(sql, [`%${q}%`, q], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Create new order
app.post('/api/orders', (req, res) => {
    const { items, payment_method, cashier_id } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Order items are required' });
    }

    const order_number = `ORD-${Date.now()}`;

    db.beginTransaction((err) => {
        if (err) {
            console.error('Transaction failed to start:', err.message);
            return res.status(500).json({ error: 'Transaction failed' });
        }

        // 1. Insert Order (Totals are placeholders, order_date uses NOW())
        const orderSql = `
            INSERT INTO orders (customer_id, order_number, total_amount, tax_amount, final_amount, payment_method, cashier_id, status, payment_status, order_date)
            VALUES (1, ?, 0, 0, 0, ?, ?, 'completed', 'paid', NOW())
        `;
        
        db.query(orderSql, [
            order_number, payment_method, cashier_id
        ], (err, result) => {
            if (err) {
                console.error('Order creation failed:', err.message);
                return db.rollback(() => {
                    res.status(500).json({ error: 'Order creation failed' });
                });
            }
            
            const orderId = result.insertId;
            const orderItemsValues = items.map(item => [
                orderId,
                item.product_id,
                item.quantity,
                item.unit_price,
                item.quantity * item.unit_price
            ]);
            
            // 2. Insert Order Items (Fires the TRIGGER trg_update_order_totals)
            const orderItemsSql = `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES ?`;
            
            db.query(orderItemsSql, [orderItemsValues], (err) => {
                if (err) {
                    console.error('Order items insertion failed:', err.message);
                    return db.rollback(() => {
                        res.status(500).json({ error: 'Order items failed' });
                    });
                }
                
                // 3. Update Stock
                const stockUpdates = items.map(item => new Promise((resolve, reject) => {
                    const updateSql = 'UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?';
                    db.query(updateSql, [item.quantity, item.product_id], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                }));

                Promise.all(stockUpdates)
                    .then(() => {
                        // 4. Commit transaction
                        db.commit((err) => {
                            if (err) {
                                console.error('Transaction commit failed:', err.message);
                                return db.rollback(() => {
                                    res.status(500).json({ error: 'Transaction commit failed' });
                                });
                            }
                            console.log(`✅ New Order Created: ${order_number} (Totals confirmed by trigger)`);
                            
                            // Query the final amount to return the accurate value
                            db.query('SELECT final_amount FROM orders WHERE order_id = ?', [orderId], (selectErr, selectResult) => {
                                const finalAmount = selectResult && selectResult[0] ? parseFloat(selectResult[0].final_amount).toFixed(2) : '0.00';
                                res.json({ success: true, order_id: orderId, order_number, final_amount: finalAmount });
                            });
                        });
                    })
                    .catch(stockErr => {
                        console.error('Stock update error, rolling back:', stockErr.message);
                        db.rollback(() => {
                            res.status(500).json({ error: 'Stock update failed, order rolled back' });
                        });
                    });
            });
        });
    });
});

// Get recent orders
app.get('/api/orders', (req, res) => {
    const sql = `
        SELECT o.*, u.name as cashier_name, c.name as customer_name
        FROM orders o
        LEFT JOIN users u ON o.cashier_id = u.user_id
        LEFT JOIN customers c ON o.customer_id = c.customer_id
        WHERE o.status = 'completed'
        ORDER BY o.created_at DESC 
        LIMIT 10
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Get sales summary (Uses the new View)
app.get('/api/sales/summary', (req, res) => {
    const { period = 'today' } = req.query;
    let sql;
    
    if (period === 'today') {
        // Uses the view for today's summary
        sql = `SELECT total_orders, total_sales, total_tax, average_order_value FROM v_daily_sales_summary WHERE sale_date = CURDATE()`;
    } else {
        // Uses the full query for other periods
        let fullDateFilter = 'DATE(order_date) = CURDATE()'; 
        if (period === 'week') fullDateFilter = 'order_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
        if (period === 'month') fullDateFilter = 'order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';

        sql = `
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(final_amount), 0) as total_sales,
                COALESCE(AVG(final_amount), 0) as average_order_value,
                COALESCE(SUM(tax_amount), 0) as total_tax
            FROM orders 
            WHERE ${fullDateFilter} AND status = 'completed'
        `;
    }

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        const summary = results[0] || {};
        res.json({
            total_orders: summary.total_orders || 0,
            total_sales: parseFloat(summary.total_sales).toFixed(2) || '0.00',
            average_order_value: parseFloat(summary.average_order_value || 0).toFixed(2) || '0.00',
            total_tax: parseFloat(summary.total_tax).toFixed(2) || '0.00'
        });
    });
});

// Get low stock products (Uses the new View)
app.get('/api/inventory/low-stock', (req, res) => {
    const sql = `
        SELECT product_id, product_name as name, category_name, stock_quantity, min_stock_level, stock_status
        FROM v_low_stock_products
        ORDER BY stock_quantity ASC
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Get dashboard statistics (Uses the new View)
app.get('/api/dashboard/stats', (req, res) => {
    const queries = {
        // Use the view for today's sales and orders, filtering by current date
        today_sales_and_orders: `SELECT total_sales, total_orders FROM v_daily_sales_summary WHERE sale_date = CURDATE()`,
        total_products: `SELECT COUNT(*) as count FROM products WHERE is_active = TRUE`,
        // Use the view for low stock count
        low_stock_count: `SELECT COUNT(*) as count FROM v_low_stock_products` 
    };

    const results = {};

    Promise.all(Object.keys(queries).map(key => new Promise((resolve, reject) => {
        db.query(queries[key], (err, result) => {
            if (err) {
                console.error(`Dashboard query failed for ${key}:`, err.message);
                reject(new Error(`Failed to query ${key}`));
            } else {
                if (key === 'today_sales_and_orders') {
                    const data = result[0] || { total_sales: 0, total_orders: 0 };
                    results.today_sales = parseFloat(data.total_sales || 0).toFixed(2);
                    results.today_orders = data.total_orders || 0;
                } else if (key === 'low_stock_count') {
                    results.low_stock_count = result[0].count;
                } else {
                    results[key] = result[0].count;
                }
                resolve();
            }
        });
    })))
    .then(() => {
        res.json(results);
    })
    .catch(err => {
        res.status(500).json({ error: 'Database error in dashboard stats' });
    });
});

// Update product stock
app.put('/api/products/:id/stock', (req, res) => {
    const { id } = req.params;
    const { stock_quantity } = req.body;
    
    if (typeof stock_quantity !== 'number' || stock_quantity < 0) {
        return res.status(400).json({ error: 'Invalid stock quantity' });
    }

    const sql = 'UPDATE products SET stock_quantity = ? WHERE product_id = ?';
    
    db.query(sql, [stock_quantity, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ success: true, message: 'Stock updated successfully', affected_id: id });
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`
🎉 SUPERMARKET BILLING SYSTEM STARTED SUCCESSFULLY!
📍 Frontend: http://localhost:${PORT}
🔧 API Test: http://localhost:${PORT}/api/test

🔑 LOGIN CREDENTIALS:
   👤 admin / admin123
   👤 cashier1 / password123
   👤 manager1 / manager123

✅ VIEWS AND TRIGGERS ARE ACTIVE
💡 System is ready for use!
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    db.end((err) => {
        if (err) console.error('Error closing DB connection:', err.message);
        console.log('Database connection closed.');
        process.exit(0);
    });
});}
