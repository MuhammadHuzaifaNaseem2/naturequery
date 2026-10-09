-- Seed data for the MySQL and MariaDB integration tests. Uses a digits
-- table instead of recursive CTEs so the same file works on both.

-- The MySQL image runs init scripts as latin1 unless told otherwise, which
-- would double-encode the Unicode test values below.
SET NAMES utf8mb4;

CREATE TABLE customers (
  id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(200),
  country VARCHAR(10),
  signed_up DATETIME,
  birthday DATE,
  balance DECIMAL(12, 2),
  lifetime_orders BIGINT,
  active TINYINT(1),
  profile JSON,
  avatar VARBINARY(16)
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL,
  ordered_on DATE NOT NULL,
  total DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) NOT NULL,
  CONSTRAINT orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
);

CREATE TABLE `Order Details` (
  `Line ID` INT PRIMARY KEY,
  `Order` INT,
  qty INT
);

CREATE TABLE digits (d INT);
INSERT INTO digits VALUES (0), (1), (2), (3), (4), (5), (6), (7), (8), (9);

INSERT INTO customers
SELECT n, CONCAT('Customer ', n), CONCAT('c', n, '@example.com'),
       ELT(1 + n % 4, 'US', 'PK', 'DE', 'JP'),
       DATE_ADD('2026-01-05 09:30:00', INTERVAL n DAY),
       DATE_ADD('1990-01-01', INTERVAL n DAY),
       1234.50 + n,
       9007199254740993 + n,
       n % 2 = 0,
       JSON_OBJECT('tier', 'gold', 'n', n),
       UNHEX('0102FF')
FROM (SELECT a.d + b.d * 10 AS n FROM digits a, digits b) AS seq
WHERE n BETWEEN 1 AND 50;

INSERT INTO customers (id, name) VALUES (51, 'Zoë Ünicode 名前');

INSERT INTO orders
SELECT n, 1 + n % 50, DATE_ADD('2025-01-01', INTERVAL n % 365 DAY), (n % 500) + 0.99,
       ELT(1 + n % 3, 'completed', 'shipped', 'canceled')
FROM (SELECT a.d + b.d * 10 + c.d * 100 + e.d * 1000 AS n FROM digits a, digits b, digits c, digits e) AS seq
WHERE n BETWEEN 1 AND 2500;

INSERT INTO `Order Details`
SELECT n, n, 1 + n % 5 FROM (SELECT a.d + b.d * 10 AS n FROM digits a, digits b) AS seq WHERE n BETWEEN 1 AND 20;

DROP TABLE digits;

CREATE VIEW big_spenders AS
  SELECT c.name, SUM(o.total) AS spent
  FROM customers c JOIN orders o ON o.customer_id = c.id
  GROUP BY c.name;
