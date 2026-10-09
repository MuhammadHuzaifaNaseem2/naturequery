-- Seed data for the ClickHouse integration tests. Throwaway values only.
CREATE TABLE acme.customers
(
    id UInt32,
    name String,
    signed_up DateTime('UTC'),
    birthday Date,
    balance Decimal(12, 2),
    lifetime_orders UInt64,
    tags Array(String),
    city LowCardinality(String),
    note Nullable(String)
)
ENGINE = MergeTree ORDER BY id;

INSERT INTO acme.customers
SELECT number + 1, concat('Customer ', toString(number + 1)), toDateTime('2026-01-06 09:30:00', 'UTC'),
       toDate('1990-01-02'), toDecimal64(1235.5, 2), 9007199254740994, ['vip', 'east'], 'Lahore', NULL
FROM numbers(50);

INSERT INTO acme.customers VALUES
    (51, 'Zoë Ünicode 名前', '2026-01-06 09:30:00', '1990-01-02', 0, 18446744073709551615, [], 'Karachi', 'note');

CREATE TABLE acme.orders
(
    id UInt32,
    customer_id UInt32,
    total Decimal(10, 2),
    status String,
    placed_at DateTime('UTC')
)
ENGINE = MergeTree ORDER BY id;

INSERT INTO acme.orders
SELECT number + 1, (number % 51) + 1, toDecimal64((number + 1) * 1.25, 2),
       if(number % 4 = 0, 'refunded', 'paid'), toDateTime('2026-02-01 00:00:00', 'UTC')
FROM numbers(2500);

CREATE VIEW acme.paid_orders AS SELECT * FROM acme.orders WHERE status = 'paid';

-- readonly = 1 cannot change any setting; readonly = 2 can change settings but not data.
CREATE USER nq_reader IDENTIFIED WITH sha256_password BY 'nq_reader_pw' SETTINGS readonly = 1;
GRANT SELECT ON acme.* TO nq_reader;
CREATE USER nq_analyst IDENTIFIED WITH sha256_password BY 'nq_analyst_pw' SETTINGS readonly = 2;
GRANT SELECT ON acme.* TO nq_analyst;
GRANT SELECT ON system.numbers TO nq_analyst;
GRANT CREATE TEMPORARY TABLE ON *.* TO nq_analyst;
