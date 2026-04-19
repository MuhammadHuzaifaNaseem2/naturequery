-- =============================================================================
-- NatureQuery Load Test Dataset
-- Generates ~2 million rows of realistic e-commerce + restaurant data
-- =============================================================================

-- Clean up if re-running
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS restaurants CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS inventory_logs CASCADE;

-- ─── Departments (20 rows) ──────────────────────────────────────────────────

CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  budget DECIMAL(12,2) NOT NULL,
  location VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO departments (name, budget, location)
SELECT
  (ARRAY['Engineering','Marketing','Sales','Finance','HR','Operations','Legal','Support','Product','Design',
         'Data Science','DevOps','Security','QA','Research','Analytics','Partnerships','Content','Growth','Infrastructure'])[i],
  ROUND((RANDOM() * 500000 + 50000)::numeric, 2),
  (ARRAY['New York','San Francisco','London','Berlin','Tokyo','Singapore','Dubai','Sydney','Toronto','Austin'])[1 + (i % 10)]
FROM generate_series(1, 20) AS i;

-- ─── Employees (10,000 rows) ────────────────────────────────────────────────

CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  department_id INT REFERENCES departments(id),
  salary DECIMAL(10,2) NOT NULL,
  hire_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  performance_score DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO employees (first_name, last_name, email, department_id, salary, hire_date, is_active, performance_score)
SELECT
  (ARRAY['James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda','David','Elizabeth',
         'William','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen',
         'Christopher','Lisa','Daniel','Nancy','Matthew','Betty','Anthony','Margaret','Mark','Sandra',
         'Ahmed','Fatima','Wei','Yuki','Carlos','Maria','Raj','Priya','Omar','Aisha'])[1 + (i % 40)],
  (ARRAY['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
         'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin',
         'Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson',
         'Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores'])[1 + ((i * 7) % 40)],
  'emp' || i || '@company.com',
  1 + (i % 20),
  ROUND((RANDOM() * 150000 + 35000)::numeric, 2),
  DATE '2015-01-01' + (RANDOM() * 3650)::int,
  RANDOM() > 0.1,
  ROUND((RANDOM() * 4 + 1)::numeric, 2)
FROM generate_series(1, 10000) AS i;

-- ─── Customers (200,000 rows) ───────────────────────────────────────────────

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  city VARCHAR(100),
  country VARCHAR(50),
  signup_date DATE NOT NULL,
  lifetime_value DECIMAL(10,2) DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  age INT,
  gender VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO customers (first_name, last_name, email, phone, city, country, signup_date, lifetime_value, is_premium, age, gender)
SELECT
  (ARRAY['James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda','David','Elizabeth',
         'Emma','Liam','Olivia','Noah','Ava','Ethan','Sophia','Mason','Isabella','Logan',
         'Mia','Lucas','Charlotte','Alexander','Amelia','Benjamin','Harper','Jacob','Evelyn','Daniel',
         'Ahmed','Fatima','Wei','Yuki','Carlos','Maria','Raj','Priya','Omar','Aisha'])[1 + (i % 40)],
  (ARRAY['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
         'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin',
         'Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson'])[1 + ((i * 3) % 30)],
  'customer' || i || '@email.com',
  '+1-' || (200 + (i % 800)) || '-' || LPAD((i % 10000)::text, 4, '0'),
  (ARRAY['New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio','San Diego',
         'Dallas','San Jose','Austin','Jacksonville','London','Paris','Berlin','Tokyo','Mumbai','Sydney',
         'Toronto','Dubai','Singapore','Seoul','Bangkok','Istanbul','Moscow','Cairo','Lagos','Nairobi',
         'Sao Paulo','Mexico City'])[1 + (i % 30)],
  (ARRAY['USA','USA','USA','USA','USA','USA','USA','USA','USA','USA',
         'USA','USA','UK','France','Germany','Japan','India','Australia',
         'Canada','UAE','Singapore','South Korea','Thailand','Turkey','Russia','Egypt','Nigeria','Kenya',
         'Brazil','Mexico'])[1 + (i % 30)],
  DATE '2020-01-01' + (RANDOM() * 2000)::int,
  ROUND((RANDOM() * 5000)::numeric, 2),
  RANDOM() > 0.8,
  18 + (RANDOM() * 62)::int,
  (ARRAY['Male','Female','Non-binary'])[1 + (i % 3)]
FROM generate_series(1, 200000) AS i;

-- ─── Restaurants (500 rows) ─────────────────────────────────────────────────

CREATE TABLE restaurants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  cuisine VARCHAR(50) NOT NULL,
  city VARCHAR(100) NOT NULL,
  country VARCHAR(50) NOT NULL,
  rating DECIMAL(2,1),
  price_range INT CHECK (price_range BETWEEN 1 AND 4),
  total_orders INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  opened_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO restaurants (name, cuisine, city, country, rating, price_range, opened_date)
SELECT
  (ARRAY['The Golden','Blue Ocean','Red Dragon','Green Garden','Silver Spoon','Royal','Imperial','Grand',
         'Little','Big'])[1 + (i % 10)] || ' ' ||
  (ARRAY['Kitchen','Grill','Bistro','Cafe','Diner','House','Palace','Table','Corner','Place'])[1 + ((i * 3) % 10)],
  (ARRAY['Italian','Mexican','Japanese','Chinese','Indian','Thai','French','American','Mediterranean','Korean',
         'Vietnamese','Turkish','Greek','Ethiopian','Peruvian','Brazilian','Spanish','Lebanese','Moroccan','German'])[1 + (i % 20)],
  (ARRAY['New York','Los Angeles','Chicago','Houston','London','Paris','Tokyo','Mumbai','Sydney','Toronto',
         'Dubai','Berlin','Seoul','Bangkok','Singapore','Istanbul','San Francisco','Seattle','Boston','Miami'])[1 + (i % 20)],
  (ARRAY['USA','USA','USA','USA','UK','France','Japan','India','Australia','Canada',
         'UAE','Germany','South Korea','Thailand','Singapore','Turkey','USA','USA','USA','USA'])[1 + (i % 20)],
  ROUND((RANDOM() * 2 + 3)::numeric, 1),
  1 + (i % 4),
  DATE '2010-01-01' + (RANDOM() * 5000)::int
FROM generate_series(1, 500) AS i;

-- ─── Menu Items (10,000 rows) ───────────────────────────────────────────────

CREATE TABLE menu_items (
  id SERIAL PRIMARY KEY,
  restaurant_id INT REFERENCES restaurants(id),
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  price DECIMAL(8,2) NOT NULL,
  is_vegetarian BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  calories INT,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO menu_items (restaurant_id, name, category, price, is_vegetarian, is_available, calories)
SELECT
  1 + (i % 500),
  (ARRAY['Grilled','Fried','Baked','Steamed','Roasted','Pan-seared','Braised','Smoked','Sauteed','Raw'])[1 + (i % 10)] || ' ' ||
  (ARRAY['Chicken','Salmon','Steak','Tofu','Shrimp','Lamb','Duck','Mushroom','Eggplant','Lobster',
         'Tuna','Pork','Beef','Cod','Halibut','Crab','Quinoa','Risotto','Pasta','Burger'])[1 + ((i * 7) % 20)] || ' ' ||
  (ARRAY['Bowl','Plate','Wrap','Salad','Soup','Sandwich','Tacos','Pizza','Curry','Stew'])[1 + ((i * 11) % 10)],
  (ARRAY['Appetizer','Main Course','Dessert','Side','Beverage','Soup','Salad','Special'])[1 + (i % 8)],
  ROUND((RANDOM() * 45 + 5)::numeric, 2),
  RANDOM() > 0.7,
  RANDOM() > 0.05,
  100 + (RANDOM() * 1200)::int
FROM generate_series(1, 10000) AS i;

-- ─── Products (5,000 rows) ──────────────────────────────────────────────────

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL,
  subcategory VARCHAR(50),
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2) NOT NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  sku VARCHAR(20) UNIQUE NOT NULL,
  brand VARCHAR(100),
  weight_kg DECIMAL(6,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO products (name, category, subcategory, price, cost, stock_quantity, sku, brand, weight_kg)
SELECT
  (ARRAY['Premium','Classic','Ultra','Pro','Elite','Eco','Smart','Turbo','Flex','Max'])[1 + (i % 10)] || ' ' ||
  (ARRAY['Widget','Gadget','Device','Tool','Sensor','Module','Board','Unit','Kit','Pack'])[1 + ((i * 3) % 10)] || ' ' ||
  (ARRAY['X1','X2','S','M','L','XL','Mini','Plus','Air','Lite'])[1 + ((i * 7) % 10)],
  (ARRAY['Electronics','Clothing','Home','Sports','Books','Toys','Food','Beauty','Auto','Garden'])[1 + (i % 10)],
  (ARRAY['Phones','Shirts','Furniture','Running','Fiction','Board Games','Snacks','Skincare','Parts','Tools',
         'Laptops','Pants','Decor','Cycling','Non-Fiction','Puzzles','Drinks','Makeup','Accessories','Seeds'])[1 + (i % 20)],
  ROUND((RANDOM() * 500 + 5)::numeric, 2),
  ROUND((RANDOM() * 200 + 2)::numeric, 2),
  (RANDOM() * 1000)::int,
  'SKU-' || LPAD(i::text, 6, '0'),
  (ARRAY['TechCorp','StyleCo','HomeBrand','SportMax','ReadMore','FunTime','TasteBest','GlowUp','AutoParts','GreenThumb'])[1 + (i % 10)],
  ROUND((RANDOM() * 20 + 0.1)::numeric, 2)
FROM generate_series(1, 5000) AS i;

-- ─── Orders (500,000 rows) — this is the big one ───────────────────────────

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  restaurant_id INT REFERENCES restaurants(id),
  order_date TIMESTAMP NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) NOT NULL,
  payment_method VARCHAR(30),
  delivery_address TEXT,
  delivery_fee DECIMAL(6,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO orders (customer_id, restaurant_id, order_date, total_amount, discount_amount, tax_amount, status, payment_method, delivery_fee)
SELECT
  1 + (i % 200000),
  1 + (i % 500),
  TIMESTAMP '2022-01-01' + (RANDOM() * 1200)::int * INTERVAL '1 day' + (RANDOM() * 86400)::int * INTERVAL '1 second',
  ROUND((RANDOM() * 200 + 10)::numeric, 2),
  ROUND((RANDOM() * 20)::numeric, 2),
  ROUND((RANDOM() * 15 + 1)::numeric, 2),
  (ARRAY['completed','completed','completed','completed','completed','pending','processing','cancelled','refunded','delivered'])[1 + (i % 10)],
  (ARRAY['credit_card','debit_card','cash','paypal','apple_pay','google_pay'])[1 + (i % 6)],
  ROUND((RANDOM() * 8 + 2)::numeric, 2)
FROM generate_series(1, 500000) AS i;

-- ─── Order Items (1,000,000 rows) ───────────────────────────────────────────

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id),
  product_id INT,
  menu_item_id INT REFERENCES menu_items(id),
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Split into batches of 250k to avoid memory issues
INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price)
SELECT
  1 + (i % 500000),
  1 + (i % 10000),
  1 + (i % 5),
  ROUND((RANDOM() * 50 + 5)::numeric, 2),
  ROUND(((1 + (i % 5)) * (RANDOM() * 50 + 5))::numeric, 2)
FROM generate_series(1, 250000) AS i;

INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price)
SELECT
  1 + ((i + 250000) % 500000),
  1 + ((i + 3) % 10000),
  1 + (i % 4),
  ROUND((RANDOM() * 50 + 5)::numeric, 2),
  ROUND(((1 + (i % 4)) * (RANDOM() * 50 + 5))::numeric, 2)
FROM generate_series(1, 250000) AS i;

INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price)
SELECT
  1 + ((i + 500000) % 500000),
  1 + ((i + 7) % 10000),
  1 + (i % 3),
  ROUND((RANDOM() * 50 + 5)::numeric, 2),
  ROUND(((1 + (i % 3)) * (RANDOM() * 50 + 5))::numeric, 2)
FROM generate_series(1, 250000) AS i;

INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price)
SELECT
  1 + ((i + 750000) % 500000),
  1 + ((i + 11) % 10000),
  1 + (i % 6),
  ROUND((RANDOM() * 50 + 5)::numeric, 2),
  ROUND(((1 + (i % 6)) * (RANDOM() * 50 + 5))::numeric, 2)
FROM generate_series(1, 250000) AS i;

-- ─── Reviews (200,000 rows) ─────────────────────────────────────────────────

CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  restaurant_id INT REFERENCES restaurants(id),
  order_id INT REFERENCES orders(id),
  rating INT CHECK (rating BETWEEN 1 AND 5),
  title VARCHAR(200),
  comment TEXT,
  is_verified BOOLEAN DEFAULT true,
  helpful_votes INT DEFAULT 0,
  review_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO reviews (customer_id, restaurant_id, order_id, rating, title, comment, is_verified, helpful_votes, review_date)
SELECT
  1 + (i % 200000),
  1 + (i % 500),
  1 + (i % 500000),
  1 + (i % 5),
  (ARRAY['Great experience!','Could be better','Amazing food','Disappointing','Worth every penny',
         'Not bad','Excellent service','Will come again','Average','Best in town',
         'Loved it','Meh','Fantastic','Never again','Highly recommend',
         'Perfect dinner','Good value','Overpriced','Fresh ingredients','Quick delivery'])[1 + (i % 20)],
  (ARRAY[
    'The food was absolutely delicious and the service was top-notch. Would definitely recommend to friends and family.',
    'Waited too long for our order but the quality of food made up for it. The ambiance was nice though.',
    'Best meal I have had in a long time. The chef clearly knows what they are doing. Every dish was perfect.',
    'Unfortunately the food was cold when it arrived and the portions were smaller than expected for the price.',
    'Incredible dining experience from start to finish. The sommelier recommended an excellent wine pairing.',
    'Decent food at a reasonable price. Nothing spectacular but consistently good. Good for a casual night out.',
    'The staff went above and beyond to accommodate our dietary restrictions. Very impressed with their attention to detail.',
    'This is now our go-to spot for date nights. The atmosphere is romantic and the food never disappoints us.',
    'It was okay. The appetizers were better than the main course. Dessert was forgettable unfortunately.',
    'Outstanding! Every bite was a flavor explosion. The presentation was Instagram-worthy and tasted even better.'
  ])[1 + (i % 10)],
  RANDOM() > 0.1,
  (RANDOM() * 50)::int,
  TIMESTAMP '2022-01-01' + (RANDOM() * 1200)::int * INTERVAL '1 day'
FROM generate_series(1, 200000) AS i;

-- ─── Inventory Logs (300,000 rows) ──────────────────────────────────────────

CREATE TABLE inventory_logs (
  id SERIAL PRIMARY KEY,
  product_id INT REFERENCES products(id),
  change_type VARCHAR(20) NOT NULL,
  quantity_change INT NOT NULL,
  previous_stock INT NOT NULL,
  new_stock INT NOT NULL,
  reason VARCHAR(100),
  logged_by INT REFERENCES employees(id),
  logged_at TIMESTAMP NOT NULL
);

INSERT INTO inventory_logs (product_id, change_type, quantity_change, previous_stock, new_stock, reason, logged_by, logged_at)
SELECT
  1 + (i % 5000),
  (ARRAY['restock','sale','return','adjustment','damage','transfer'])[1 + (i % 6)],
  CASE WHEN i % 6 IN (0, 2) THEN (RANDOM() * 100 + 1)::int ELSE -(RANDOM() * 20 + 1)::int END,
  (RANDOM() * 500 + 10)::int,
  (RANDOM() * 500 + 10)::int,
  (ARRAY['Regular restock','Customer purchase','Customer return','Inventory audit','Damaged in warehouse','Moved to branch'])[1 + (i % 6)],
  1 + (i % 10000),
  TIMESTAMP '2022-01-01' + (RANDOM() * 1200)::int * INTERVAL '1 day' + (RANDOM() * 86400)::int * INTERVAL '1 second'
FROM generate_series(1, 300000) AS i;

-- ─── Indexes for performance ────────────────────────────────────────────────

CREATE INDEX idx_customers_city ON customers(city);
CREATE INDEX idx_customers_country ON customers(country);
CREATE INDEX idx_customers_signup ON customers(signup_date);
CREATE INDEX idx_customers_premium ON customers(is_premium);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_orders_status ON orders(status);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_menu ON order_items(menu_item_id);

CREATE INDEX idx_reviews_customer ON reviews(customer_id);
CREATE INDEX idx_reviews_restaurant ON reviews(restaurant_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

CREATE INDEX idx_employees_dept ON employees(department_id);
CREATE INDEX idx_employees_active ON employees(is_active);

CREATE INDEX idx_inventory_product ON inventory_logs(product_id);
CREATE INDEX idx_inventory_date ON inventory_logs(logged_at);

CREATE INDEX idx_menu_items_restaurant ON menu_items(restaurant_id);

-- ─── Update restaurant order counts ────────────────────────────────────────

UPDATE restaurants r SET total_orders = (
  SELECT COUNT(*) FROM orders o WHERE o.restaurant_id = r.id
);

-- ─── Update customer lifetime value ────────────────────────────────────────

UPDATE customers c SET lifetime_value = COALESCE((
  SELECT SUM(o.total_amount) FROM orders o WHERE o.customer_id = c.id
), 0);

-- ─── Summary ────────────────────────────────────────────────────────────────

SELECT 'departments' AS table_name, COUNT(*) AS row_count FROM departments
UNION ALL SELECT 'employees', COUNT(*) FROM employees
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'restaurants', COUNT(*) FROM restaurants
UNION ALL SELECT 'menu_items', COUNT(*) FROM menu_items
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'reviews', COUNT(*) FROM reviews
UNION ALL SELECT 'inventory_logs', COUNT(*) FROM inventory_logs
ORDER BY row_count DESC;
