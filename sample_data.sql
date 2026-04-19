-- Sample data for ReportFlow testing
-- Run this in pgAdmin: Tools > Query Tool, paste this, click Execute (F5)

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    city VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(50),
    stock INTEGER DEFAULT 0
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    order_date TIMESTAMP DEFAULT NOW()
);

-- Insert sample customers
INSERT INTO customers (name, email, city) VALUES
('John Smith', 'john@example.com', 'New York'),
('Sarah Johnson', 'sarah@example.com', 'Los Angeles'),
('Mike Brown', 'mike@example.com', 'Chicago'),
('Emily Davis', 'emily@example.com', 'Houston'),
('David Wilson', 'david@example.com', 'Phoenix');

-- Insert sample products
INSERT INTO products (name, price, category, stock) VALUES
('Laptop Pro', 1299.99, 'Electronics', 50),
('Wireless Mouse', 49.99, 'Accessories', 200),
('USB-C Hub', 79.99, 'Accessories', 150),
('Monitor 27"', 399.99, 'Electronics', 30),
('Keyboard', 129.99, 'Accessories', 100),
('Webcam HD', 89.99, 'Electronics', 75);

-- Insert sample orders
INSERT INTO orders (customer_id, product_id, quantity, total_amount, status) VALUES
(1, 1, 1, 1299.99, 'completed'),
(2, 2, 2, 99.98, 'completed'),
(1, 3, 1, 79.99, 'shipped'),
(3, 4, 1, 399.99, 'pending'),
(4, 5, 1, 129.99, 'completed'),
(5, 6, 2, 179.98, 'shipped'),
(2, 1, 1, 1299.99, 'completed'),
(3, 2, 3, 149.97, 'pending');

SELECT 'Sample data created successfully!' AS result;
