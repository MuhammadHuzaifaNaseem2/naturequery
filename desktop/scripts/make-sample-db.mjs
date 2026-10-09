// Generates resources/sample/acme-store.db: a realistic retail dataset that
// ships with the app so people can try queries and AI before connecting
// their own database. Seeded, so every build produces the same data.
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { desktopRoot } from './electron-targets.mjs'

const output = path.join(desktopRoot, 'resources/sample/acme-store.db')
fs.mkdirSync(path.dirname(output), { recursive: true })
for (const suffix of ['', '-wal', '-shm', '-journal']) fs.rmSync(output + suffix, { force: true })

let seed = 20261009
function random() {
  // Mulberry32
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = (items) => items[Math.floor(random() * items.length)]
const between = (min, max) => min + Math.floor(random() * (max - min + 1))
const money = (value) => Math.round(value * 100) / 100
const weighted = (entries) => {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = random() * total
  for (const [value, weight] of entries) {
    if ((roll -= weight) <= 0) return value
  }
  return entries[0][0]
}

const FIRST = ['Olivia', 'Liam', 'Emma', 'Noah', 'Ava', 'Elijah', 'Sophia', 'Lucas', 'Mia', 'Mateo', 'Amelia', 'Hiroshi', 'Fatima', 'Arjun', 'Chloe', 'Ethan', 'Zara', 'Omar', 'Isabella', 'Daniel', 'Aisha', 'Leo', 'Grace', 'Yusuf', 'Hannah', 'Carlos', 'Mei', 'Samuel', 'Nora', 'Ali', 'Sofia', 'Jack', 'Layla', 'Henry', 'Priya', 'Lucia', 'Kenji', 'Ella', 'Ibrahim', 'Ruby']
const LAST = ['Smith', 'Johnson', 'Garcia', 'Khan', 'Chen', 'Williams', 'Brown', 'Ahmed', 'Martinez', 'Tanaka', 'Rossi', 'Muller', 'Patel', 'Silva', 'Kim', 'Nguyen', 'Lopez', 'Wilson', 'Anderson', 'Hassan', 'Dubois', 'Moreau', 'Novak', 'Kowalski', 'Jensen', 'Okafor', 'Mensah', 'Costa', 'Fischer', 'Ali']
const PLACES = [
  ['New York', 'United States', 'North America'], ['Chicago', 'United States', 'North America'], ['Austin', 'United States', 'North America'],
  ['Seattle', 'United States', 'North America'], ['Toronto', 'Canada', 'North America'], ['Vancouver', 'Canada', 'North America'],
  ['London', 'United Kingdom', 'Europe'], ['Manchester', 'United Kingdom', 'Europe'], ['Berlin', 'Germany', 'Europe'], ['Munich', 'Germany', 'Europe'],
  ['Paris', 'France', 'Europe'], ['Amsterdam', 'Netherlands', 'Europe'], ['Madrid', 'Spain', 'Europe'], ['Milan', 'Italy', 'Europe'],
  ['Dubai', 'United Arab Emirates', 'Middle East'], ['Riyadh', 'Saudi Arabia', 'Middle East'], ['Karachi', 'Pakistan', 'Asia'], ['Lahore', 'Pakistan', 'Asia'],
  ['Mumbai', 'India', 'Asia'], ['Singapore', 'Singapore', 'Asia'], ['Tokyo', 'Japan', 'Asia'], ['Sydney', 'Australia', 'Oceania'],
  ['Melbourne', 'Australia', 'Oceania'], ['Sao Paulo', 'Brazil', 'South America'], ['Mexico City', 'Mexico', 'North America'], ['Lagos', 'Nigeria', 'Africa'],
]
const SEGMENTS = [['Consumer', 62], ['Small Business', 28], ['Enterprise', 10]]
const CATALOG = {
  Electronics: [['Wireless Earbuds', 79], ['Noise-Cancelling Headphones', 249], ['Smart Watch', 199], ['Portable Charger', 39], ['Bluetooth Speaker', 89], ['4K Webcam', 129], ['Mechanical Keyboard', 119], ['Wireless Mouse', 45], ['USB-C Hub', 59], ['27" Monitor', 329], ['Tablet Stand', 35], ['Smart Home Plug', 25]],
  'Home & Kitchen': [['Espresso Machine', 399], ['Chef Knife Set', 149], ['Air Fryer', 129], ['Ceramic Mug Set', 32], ['Cast Iron Skillet', 49], ['Electric Kettle', 59], ['Blender', 89], ['Linen Bedding Set', 179], ['Scented Candle', 24], ['Stainless Water Bottle', 29], ['Bamboo Cutting Board', 34]],
  Outdoors: [['Hiking Backpack', 139], ['Camping Tent', 229], ['Insulated Jacket', 189], ['Trail Running Shoes', 119], ['Sleeping Bag', 99], ['Headlamp', 29], ['Trekking Poles', 69], ['Camping Stove', 79], ['Yoga Mat', 39]],
  Office: [['Ergonomic Chair', 349], ['Standing Desk', 499], ['Desk Lamp', 59], ['Notebook Set', 19], ['Fountain Pen', 45], ['Document Organizer', 27], ['Whiteboard', 89], ['Monitor Arm', 109]],
  Apparel: [['Merino Sweater', 99], ['Everyday Tote', 49], ['Canvas Sneakers', 79], ['Rain Jacket', 129], ['Cotton Cap', 22], ['Leather Belt', 45], ['Wool Socks (3-pack)', 24], ['Denim Jacket', 119]],
}
const REPS = [
  ['Sarah Collins', 'North America', '2021-03-15'], ['James Park', 'North America', '2022-06-01'], ['Elena Rossi', 'Europe', '2020-11-09'],
  ['Thomas Weber', 'Europe', '2023-01-23'], ['Aiko Sato', 'Asia', '2021-08-30'], ['Bilal Hussain', 'Asia', '2024-02-12'],
  ['Layla Haddad', 'Middle East', '2022-09-05'], ['Grace Okafor', 'Africa', '2023-05-17'], ['Lucas Almeida', 'South America', '2022-04-11'],
  ['Mia Thompson', 'Oceania', '2023-10-02'],
]

const db = new DatabaseSync(output)
db.exec(`
PRAGMA journal_mode = DELETE;
PRAGMA foreign_keys = ON;
CREATE TABLE sales_reps (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  hired_on DATE NOT NULL
);
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  segment TEXT NOT NULL,
  signed_up_on DATE NOT NULL
);
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  unit_cost NUMERIC(10,2) NOT NULL,
  in_stock INTEGER NOT NULL
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  sales_rep_id INTEGER REFERENCES sales_reps(id),
  order_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'shipped', 'processing', 'canceled', 'refunded')),
  channel TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL
);
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  discount NUMERIC(4,2) NOT NULL DEFAULT 0
);
CREATE INDEX orders_customer ON orders(customer_id);
CREATE INDEX orders_date ON orders(order_date);
CREATE INDEX order_items_order ON order_items(order_id);
CREATE INDEX order_items_product ON order_items(product_id);
CREATE VIEW monthly_revenue AS
  SELECT strftime('%Y-%m', order_date) AS month,
         COUNT(*) AS orders,
         ROUND(SUM(total_amount), 2) AS revenue
  FROM orders
  WHERE status IN ('completed', 'shipped')
  GROUP BY 1
  ORDER BY 1;
`)

db.exec('BEGIN')
const insertRep = db.prepare('INSERT INTO sales_reps (id, name, region, hired_on) VALUES (?, ?, ?, ?)')
REPS.forEach(([name, region, hired], index) => insertRep.run(index + 1, name, region, hired))

const insertCustomer = db.prepare(
  'INSERT INTO customers (id, name, email, city, country, region, segment, signed_up_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
)
const customers = []
const start = new Date(Date.UTC(2024, 0, 1))
const end = new Date(Date.UTC(2026, 8, 30))
const span = end.getTime() - start.getTime()
const usedEmails = new Set()
for (let id = 1; id <= 640; id++) {
  const first = pick(FIRST)
  const last = pick(LAST)
  let email = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@example.com'
  let n = 2
  while (usedEmails.has(email)) email = `${first}.${last}${n++}`.toLowerCase() + '@example.com'
  usedEmails.add(email)
  const [city, country, region] = pick(PLACES)
  // More customers sign up as the business grows.
  const signup = new Date(start.getTime() + span * Math.sqrt(random()) * 0.92)
  const customer = { id, region, segment: weighted(SEGMENTS), signup }
  customers.push(customer)
  insertCustomer.run(id, `${first} ${last}`, email, city, country, region, customer.segment, signup.toISOString().slice(0, 10))
}

const insertProduct = db.prepare(
  'INSERT INTO products (id, name, category, unit_price, unit_cost, in_stock) VALUES (?, ?, ?, ?, ?, ?)'
)
const products = []
let productId = 1
for (const [category, items] of Object.entries(CATALOG)) {
  for (const [name, price] of items) {
    const cost = money(price * (0.42 + random() * 0.2))
    products.push({ id: productId, price, category, popularity: 0.3 + random() * 1.7 })
    insertProduct.run(productId++, name, category, price, cost, between(0, 400))
  }
}

const insertOrder = db.prepare(
  'INSERT INTO orders (id, customer_id, sales_rep_id, order_date, status, channel, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?)'
)
const insertItem = db.prepare(
  'INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, discount) VALUES (?, ?, ?, ?, ?, ?)'
)
const repsByRegion = {}
REPS.forEach(([, region], index) => (repsByRegion[region] ??= []).push(index + 1))

let orderId = 1
let itemId = 1
for (let day = new Date(start); day <= end; day = new Date(day.getTime() + 86_400_000)) {
  const progress = (day.getTime() - start.getTime()) / span
  const month = day.getUTCMonth()
  const seasonal = month === 10 ? 1.6 : month === 11 ? 1.9 : month === 0 ? 0.8 : 1
  const weekday = [0.75, 1, 1, 1.05, 1.1, 1.2, 0.9][day.getUTCDay()]
  const expected = (4 + progress * 9) * seasonal * weekday
  const count = Math.max(0, Math.round(expected + (random() - 0.5) * 4))
  const eligible = customers.filter((customer) => customer.signup <= day)
  if (!eligible.length) continue
  for (let i = 0; i < count; i++) {
    const customer = pick(eligible)
    const status = weighted([['completed', 84], ['shipped', 6], ['processing', 2], ['canceled', 5], ['refunded', 3]])
    const channel = weighted([['Online store', 58], ['Mobile app', 27], ['Retail partner', 15]])
    const rep = customer.segment === 'Consumer' && random() < 0.7 ? null : pick(repsByRegion[customer.region] ?? [1])
    const lines = weighted([[1, 45], [2, 30], [3, 15], [4, 7], [5, 3]])
    let total = 0
    const chosen = new Set()
    const items = []
    for (let line = 0; line < lines; line++) {
      let product
      do {
        product = weighted(products.map((candidate) => [candidate, candidate.popularity]))
      } while (chosen.has(product.id) && chosen.size < products.length)
      chosen.add(product.id)
      const quantity = customer.segment === 'Enterprise' ? between(2, 12) : weighted([[1, 70], [2, 20], [3, 7], [4, 3]])
      const discount = customer.segment === 'Enterprise' ? 0.1 : random() < 0.12 ? 0.15 : 0
      total += product.price * quantity * (1 - discount)
      items.push([product.id, quantity, product.price, discount])
    }
    insertOrder.run(orderId, customer.id, rep, day.toISOString().slice(0, 10), status, channel, money(total))
    for (const [product, quantity, price, discount] of items) {
      insertItem.run(itemId++, orderId, product, quantity, price, discount)
    }
    orderId++
  }
}
db.exec('COMMIT')
db.exec('ANALYZE')
db.exec('VACUUM')
const counts = db.prepare(`
  SELECT (SELECT COUNT(*) FROM customers) AS customers, (SELECT COUNT(*) FROM products) AS products,
         (SELECT COUNT(*) FROM orders) AS orders, (SELECT COUNT(*) FROM order_items) AS order_items,
         (SELECT ROUND(SUM(total_amount)) FROM orders WHERE status IN ('completed','shipped')) AS revenue
`).get()
db.close()
console.log(`Sample database written to ${path.relative(desktopRoot, output)}`, counts)
