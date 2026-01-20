// orders-service/index.js
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3002;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres-service',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ecommerce',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const PRODUCTS_SERVICE = process.env.PRODUCTS_SERVICE || 'http://products-service:3001';

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'orders' });
});

// Get all orders
app.get('/orders', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM orders ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single order with items
app.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const itemsResult = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [id]
    );
    
    res.json({
      ...orderResult.rows[0],
      items: itemsResult.rows
    });
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create order
app.post('/orders', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { items } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain items' });
    }
    
    await client.query('BEGIN');
    
    // Calculate total
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Create order
    const orderResult = await client.query(
      'INSERT INTO orders (total_amount, status) VALUES ($1, $2) RETURNING *',
      [total, 'pending']
    );
    
    const order = orderResult.rows[0];
    
    // Create order items and update product stock
    for (const item of items) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [order.id, item.product_id, item.quantity, item.price]
      );
      
      // Update product stock via products service
      try {
        await axios.patch(
          `${PRODUCTS_SERVICE}/products/${item.product_id}/stock`,
          { quantity: item.quantity }
        );
      } catch (err) {
        console.error('Error updating stock:', err.message);
      }
    }
    
    await client.query('COMMIT');
    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Update order status
app.patch('/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating order:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initialize database
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        total_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price DECIMAL(10, 2) NOT NULL
      )
    `);
    
    console.log('Orders database initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

app.listen(port, async () => {
  await initDB();
  console.log(`Orders service running on port ${port}`);
});
