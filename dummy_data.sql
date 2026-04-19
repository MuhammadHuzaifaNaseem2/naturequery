-- ReportFlow Test Database
-- E-commerce dummy data for PostgreSQL

-- Drop existing tables
DROP TABLE IF EXISTS order_items, orders, reviews, products, categories, customers CASCADE;

-- Categories
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

INSERT INTO categories (name, description) VALUES
('Electronics', 'Phones, laptops, gadgets'),
('Clothing', 'Apparel and accessories'),
('Home & Garden', 'Furniture and decor'),
('Sports', 'Sports equipment'),
('Books', 'Books and magazines');

-- Customers (100 records)
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    city VARCHAR(100),
    country VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    is_premium BOOLEAN DEFAULT FALSE
);

INSERT INTO customers (name, email, city, country, phone, is_premium) 
SELECT 
    'Customer ' || i,
    'customer' || i || '@email.com',
    (ARRAY['New York', 'London', 'Paris', 'Tokyo', 'Sydney', 'Berlin', 'Dubai', 'Singapore', 'Toronto', 'Mumbai'])[1 + (i % 10)],
    (ARRAY['USA', 'UK', 'France', 'Japan', 'Australia', 'Germany', 'UAE', 'Singapore', 'Canada', 'India'])[1 + (i % 10)],
    '+1-555-' || LPAD(i::text, 4, '0'),
    (i % 5 = 0)
FROM generate_series(1, 100) AS i;

-- Products (50 records)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category_id INT REFERENCES categories(id),
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2),
    stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO products (name, category_id, price, cost, stock)
SELECT 
    (ARRAY['Laptop', 'Phone', 'Tablet', 'Watch', 'Headphones', 'Camera', 'Speaker', 'Monitor', 'Keyboard', 'Mouse'])[1 + (i % 10)] || ' Pro ' || i,
    1 + (i % 5),
    ROUND((50 + RANDOM() * 950)::numeric, 2),
    ROUND((20 + RANDOM() * 400)::numeric, 2),
    (10 + (i * 7) % 200)
FROM generate_series(1, 50) AS i;

-- Orders (500 records)
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    order_date TIMESTAMP,
    status VARCHAR(20),
    total_amount DECIMAL(12,2),
    shipping_address TEXT
);

INSERT INTO orders (customer_id, order_date, status, total_amount, shipping_address)
SELECT 
    1 + (i % 100),
    NOW() - (RANDOM() * 365 || ' days')::interval,
    (ARRAY['pending', 'processing', 'shipped', 'delivered', 'cancelled'])[1 + (i % 5)],
    ROUND((50 + RANDOM() * 2000)::numeric, 2),
    'Address ' || i || ', City ' || (i % 50)
FROM generate_series(1, 500) AS i;

-- Order Items (1500 records)
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id),
    product_id INT REFERENCES products(id),
    quantity INT,
    unit_price DECIMAL(10,2)
);

INSERT INTO order_items (order_id, product_id, quantity, unit_price)
SELECT 
    1 + (i % 500),
    1 + (i % 50),
    1 + (i % 5),
    ROUND((25 + RANDOM() * 500)::numeric, 2)
FROM generate_series(1, 1500) AS i;

-- Reviews (300 records)
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id),
    customer_id INT REFERENCES customers(id),
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO reviews (product_id, customer_id, rating, comment, created_at)
SELECT 
    1 + (i % 50),
    1 + (i % 100),
    1 + (i % 5),
    'Review comment ' || i,
    NOW() - (RANDOM() * 180 || ' days')::interval
FROM generate_series(1, 300) AS i;

-- Update order totals based on items
UPDATE orders o SET total_amount = (
    SELECT COALESCE(SUM(quantity * unit_price), 0) 
    FROM order_items oi WHERE oi.order_id = o.id
);

-- Sample Complex Queries to Test:
-- 1. Top customers by spending
-- 2. Best selling products  
-- 3. Revenue by category
-- 4. Monthly sales trends
-- 5. Average order value by country
