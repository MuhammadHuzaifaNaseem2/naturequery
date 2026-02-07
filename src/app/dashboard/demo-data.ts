import { DatabaseSchema, QueryResultRow } from '@/actions/db'

export const DEMO_SCHEMA: DatabaseSchema = {
  tables: [
    {
      tableName: 'customers',
      columns: [
        { name: 'id', type: 'integer', nullable: false, defaultValue: null, isPrimaryKey: true },
        { name: 'name', type: 'varchar', nullable: false, defaultValue: null, isPrimaryKey: false },
        { name: 'email', type: 'varchar', nullable: false, defaultValue: null, isPrimaryKey: false },
        { name: 'city', type: 'varchar', nullable: true, defaultValue: null, isPrimaryKey: false },
        { name: 'created_at', type: 'timestamp', nullable: false, defaultValue: 'now()', isPrimaryKey: false },
      ],
    },
    {
      tableName: 'orders',
      columns: [
        { name: 'id', type: 'integer', nullable: false, defaultValue: null, isPrimaryKey: true },
        { name: 'customer_id', type: 'integer', nullable: false, defaultValue: null, isPrimaryKey: false },
        { name: 'product', type: 'varchar', nullable: false, defaultValue: null, isPrimaryKey: false },
        { name: 'amount', type: 'decimal', nullable: false, defaultValue: null, isPrimaryKey: false },
        { name: 'status', type: 'varchar', nullable: false, defaultValue: "'pending'", isPrimaryKey: false },
        { name: 'order_date', type: 'timestamp', nullable: false, defaultValue: 'now()', isPrimaryKey: false },
      ],
    },
    {
      tableName: 'products',
      columns: [
        { name: 'id', type: 'integer', nullable: false, defaultValue: null, isPrimaryKey: true },
        { name: 'name', type: 'varchar', nullable: false, defaultValue: null, isPrimaryKey: false },
        { name: 'price', type: 'decimal', nullable: false, defaultValue: null, isPrimaryKey: false },
        { name: 'category', type: 'varchar', nullable: true, defaultValue: null, isPrimaryKey: false },
        { name: 'stock', type: 'integer', nullable: false, defaultValue: '0', isPrimaryKey: false },
      ],
    },
  ],
}

export const DEMO_DATA: Record<string, QueryResultRow[]> = {
  customers: [
    { id: 1, name: 'John Smith', email: 'john@example.com', city: 'New York', created_at: '2024-01-15' },
    { id: 2, name: 'Sarah Johnson', email: 'sarah@example.com', city: 'Los Angeles', created_at: '2024-02-20' },
    { id: 3, name: 'Mike Brown', email: 'mike@example.com', city: 'Chicago', created_at: '2024-03-10' },
    { id: 4, name: 'Emily Davis', email: 'emily@example.com', city: 'Houston', created_at: '2024-04-05' },
    { id: 5, name: 'David Wilson', email: 'david@example.com', city: 'Phoenix', created_at: '2024-05-12' },
  ],
  orders: [
    { id: 1, customer_id: 1, product: 'Laptop Pro', amount: 1299.99, status: 'completed', order_date: '2024-06-01' },
    { id: 2, customer_id: 2, product: 'Wireless Mouse', amount: 49.99, status: 'completed', order_date: '2024-06-05' },
    { id: 3, customer_id: 1, product: 'USB-C Hub', amount: 79.99, status: 'shipped', order_date: '2024-06-10' },
    { id: 4, customer_id: 3, product: 'Monitor 27"', amount: 399.99, status: 'pending', order_date: '2024-06-15' },
    { id: 5, customer_id: 4, product: 'Keyboard', amount: 129.99, status: 'completed', order_date: '2024-06-20' },
    { id: 6, customer_id: 5, product: 'Webcam HD', amount: 89.99, status: 'shipped', order_date: '2024-06-25' },
  ],
  products: [
    { id: 1, name: 'Laptop Pro', price: 1299.99, category: 'Electronics', stock: 50 },
    { id: 2, name: 'Wireless Mouse', price: 49.99, category: 'Accessories', stock: 200 },
    { id: 3, name: 'USB-C Hub', price: 79.99, category: 'Accessories', stock: 150 },
    { id: 4, name: 'Monitor 27"', price: 399.99, category: 'Electronics', stock: 30 },
    { id: 5, name: 'Keyboard', price: 129.99, category: 'Accessories', stock: 100 },
    { id: 6, name: 'Webcam HD', price: 89.99, category: 'Electronics', stock: 75 },
  ],
}
