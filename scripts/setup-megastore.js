const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const rootClient = new Client({
    connectionString: 'postgresql://postgres:Huzaifa12@localhost:5432/postgres'
  });

  try {
    await rootClient.connect();
    await rootClient.query('DROP DATABASE IF EXISTS megastore');
    await rootClient.query('CREATE DATABASE megastore');
    console.log('Database megastore created');
  } catch (err) {
    console.error('Error setting up DB:', err);
  } finally {
    await rootClient.end();
  }

  const megastoreClient = new Client({
    connectionString: 'postgresql://postgres:Huzaifa12@localhost:5432/megastore' 
  });

  try {
    await megastoreClient.connect();
    console.log('Connected to megastore. Loading schema and data...');
    
    let sql = fs.readFileSync(path.join(__dirname, 'create_megastore.sql'), 'utf8');
    
    // Remove database creation lines since they are already run
    sql = sql.replace(/DROP DATABASE IF EXISTS megastore;/g, '');
    sql = sql.replace(/CREATE DATABASE megastore;/g, '');
    sql = sql.replace(/\\c megastore/g, '');
    
    await megastoreClient.query(sql);
    console.log('Successfully completed building megastore!!');
  } catch (err) {
    console.error('Error running megastore SQL:', err.message);
  } finally {
    await megastoreClient.end();
  }
}

main();
