DROP DATABASE IF EXISTS megastore;
CREATE DATABASE megastore;
\c megastore

-- Create tables
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_category_id INT REFERENCES categories(category_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    country VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category_id INT REFERENCES categories(category_id),
    stock_quantity INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id),
    status VARCHAR(50), -- 'PENDING', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED'
    total_amount DECIMAL(12, 2) DEFAULT 0,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(order_id),
    product_id INT REFERENCES products(product_id),
    quantity INT,
    unit_price DECIMAL(10, 2),
    subtotal DECIMAL(12, 2)
);

CREATE TABLE reviews (
    review_id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(product_id),
    user_id INT REFERENCES users(user_id),
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Data

-- Categories
INSERT INTO categories (name) VALUES 
('Electronics'), ('Clothing'), ('Home & Garden'), ('Sports'), ('Books'), ('Toys'), ('Beauty'), ('Automotive');

-- Insert 10,000 Users
INSERT INTO users (first_name, last_name, email, country, created_at)
SELECT 
    'UserFirst' || id,
    'UserLast' || id,
    'user' || id || '@example.com',
    (ARRAY['USA', 'UK', 'Canada', 'Australia', 'India', 'Germany', 'France', 'Japan'])[floor(random() * 8 + 1)],
    NOW() - (random() * interval '3 years')
FROM generate_series(1, 10000) as id;

-- Insert 1,000 Products
INSERT INTO products (name, description, price, category_id, stock_quantity)
SELECT 
    'Product ' || id,
    'This is an amazing product number ' || id,
    (random() * 900 + 10)::numeric(10,2),
    floor(random() * 8 + 1)::int,
    floor(random() * 500)::int
FROM generate_series(1, 1000) as id;

-- Insert 50,000 Orders
INSERT INTO orders (user_id, status, order_date)
SELECT 
    floor(random() * 10000 + 1)::int,
    (ARRAY['PENDING', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED'])[floor(random() * 5 + 1)],
    NOW() - (random() * interval '2 years')
FROM generate_series(1, 50000) as id;

-- Insert 150,000 Order Items
INSERT INTO order_items (order_id, product_id, quantity, unit_price)
SELECT 
    floor(random() * 50000 + 1)::int,
    floor(random() * 1000 + 1)::int,
    floor(random() * 5 + 1)::int,
    0
FROM generate_series(1, 150000) as id;

-- Update Order Items with actual product prices and calculate subtotals
UPDATE order_items 
SET unit_price = p.price,
    subtotal = order_items.quantity * p.price
FROM products p
WHERE order_items.product_id = p.product_id;

-- Update Order totals based on Items
UPDATE orders
SET total_amount = sub.total
FROM (
    SELECT order_id, sum(subtotal) as total
    FROM order_items
    GROUP BY order_id
) sub
WHERE orders.order_id = sub.order_id;

-- Insert 20,000 Reviews
INSERT INTO reviews (product_id, user_id, rating, comment, review_date)
SELECT 
    floor(random() * 1000 + 1)::int,
    floor(random() * 10000 + 1)::int,
    floor(random() * 5 + 1)::int,
    'This is an automated review comment for testing purposes.',
    NOW() - (random() * interval '1 year')
FROM generate_series(1, 20000) as id;
