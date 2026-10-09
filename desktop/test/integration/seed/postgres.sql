-- Seed data for the PostgreSQL integration tests. Covers schemas, quoted
-- names, foreign keys, a view, and the value types the engine normalizes.

CREATE SCHEMA sales;

CREATE TABLE sales.customers (
  id integer PRIMARY KEY,
  name text NOT NULL,
  email text,
  country text,
  signed_up timestamp,
  signed_up_tz timestamptz,
  birthday date,
  balance numeric(12, 2),
  lifetime_orders bigint,
  active boolean,
  tags text[],
  profile jsonb,
  avatar bytea
);

CREATE TABLE sales.orders (
  id integer PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES sales.customers (id),
  ordered_on date NOT NULL,
  total numeric(12, 2) NOT NULL,
  status text NOT NULL
);

CREATE VIEW sales.big_spenders AS
  SELECT c.name, sum(o.total) AS spent
  FROM sales.customers c JOIN sales.orders o ON o.customer_id = c.id
  GROUP BY c.name;

CREATE TABLE public."Order Details" (
  "Line ID" integer PRIMARY KEY,
  "Order" integer REFERENCES sales.orders (id),
  qty integer
);

INSERT INTO sales.customers
SELECT n,
       'Customer ' || n,
       'c' || n || '@example.com',
       (ARRAY['US', 'PK', 'DE', 'JP'])[1 + n % 4],
       timestamp '2026-01-05 09:30:00' + n * interval '1 day',
       timestamptz '2026-01-05 09:30:00+00' + n * interval '1 hour',
       date '1990-01-01' + n,
       1234.50 + n,
       9007199254740993 + n,
       n % 2 = 0,
       ARRAY['vip', 'east'],
       jsonb_build_object('tier', 'gold', 'n', n),
       '\x0102ff'::bytea
FROM generate_series(1, 50) AS n;

INSERT INTO sales.customers (id, name) VALUES (51, 'Zoë Ünicode 名前');

INSERT INTO sales.orders
SELECT n, 1 + n % 50, date '2025-01-01' + (n % 365), (n % 500) + 0.99,
       (ARRAY['completed', 'shipped', 'canceled'])[1 + n % 3]
FROM generate_series(1, 2500) AS n;

INSERT INTO public."Order Details" SELECT n, n, 1 + n % 5 FROM generate_series(1, 20) AS n;

-- A function that writes. Calling it inside a SELECT must still be refused
-- by the read-only transaction even for an account allowed to write.
CREATE FUNCTION sales.sneaky_write() RETURNS integer LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO sales.orders VALUES (99999, 1, current_date, 1, 'x');
  RETURN 1;
END
$$;

CREATE ROLE nq_reader LOGIN PASSWORD 'nq_reader_pw';
GRANT USAGE ON SCHEMA sales TO nq_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA sales TO nq_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO nq_reader;
