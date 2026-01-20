// products-service/index.js
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres-service',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ecommerce',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'products' });
});

// Get all products
app.get('/products', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM products ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single product
app.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create product
app.post('/products', async (req, res) => {
  try {
    const { name, description, price, stock } = req.body;
    const result = await pool.query(
      'INSERT INTO products (name, description, price, stock) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, price, stock]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update product stock
app.patch('/products/:id/stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    
    const result = await pool.query(
      'UPDATE products SET stock = stock - $1 WHERE id = $2 RETURNING *',
      [quantity, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating stock:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initialize database
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        stock INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if we need to seed data
    const count = await pool.query('SELECT COUNT(*) FROM products');
    if (parseInt(count.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO products (name, description, price, stock) VALUES
        ('Laptop', 'High-performance laptop', 1299.99, 50),
        ('Smartphone', 'Latest smartphone model', 899.99, 100),
        ('Headphones', 'Noise-cancelling headphones', 299.99, 75),
        ('Smartwatch', 'Fitness tracking smartwatch', 399.99, 60),
        ('Tablet', '10-inch tablet', 599.99, 40),
        ('Camera', 'Digital camera 24MP', 799.99, 30)
      `);
      console.log('Database seeded with initial products');
    }
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

app.listen(port, async () => {
  await initDB();
  console.log(`Products service running on port ${port}`);
});
