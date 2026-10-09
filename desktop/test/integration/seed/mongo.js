// Seed data for the MongoDB integration tests. Throwaway values only.
const acme = db.getSiblingDB('acme')

acme.createUser({
  user: 'nq_reader',
  pwd: 'nq_reader_pw',
  roles: [{ role: 'read', db: 'acme' }],
})

const customers = []
for (let i = 1; i <= 50; i++) {
  customers.push({
    _id: i,
    name: `Customer ${i}`,
    email: `customer${i}@example.com`,
    signedUp: new Date(Date.UTC(2026, 0, (i % 28) + 1, 9, 30)),
    balance: NumberDecimal(`${i * 10}.50`),
    tags: i % 2 ? ['vip'] : [],
    address: { city: i % 3 ? 'Lahore' : 'Karachi', zip: String(54000 + i) },
  })
}
customers.push({
  _id: 51,
  name: 'Zoë Ünicode 名前',
  email: 'zoe@example.com',
  signedUp: new Date(Date.UTC(2026, 0, 6, 9, 30)),
  balance: NumberDecimal('1235.50'),
  lifetimeOrders: NumberLong('9007199254740993'),
})
acme.customers.insertMany(customers)

const orders = []
for (let i = 1; i <= 2500; i++) {
  orders.push({
    orderNo: i,
    customerId: (i % 51) + 1,
    total: i * 1.25,
    status: i % 4 ? 'paid' : 'refunded',
    placedAt: new Date(Date.UTC(2026, 1, (i % 28) + 1)),
  })
}
acme.orders.insertMany(orders)

acme.createView('paid_orders', 'orders', [{ $match: { status: 'paid' } }])
