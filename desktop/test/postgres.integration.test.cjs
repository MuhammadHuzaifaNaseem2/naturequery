'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { Client } = require('pg')
const { createDriver } = require('../engine/db-drivers.cjs')
test(
  'isolated PostgreSQL: connect, schema, query, row cap and transaction protection',
  { skip: !process.env.NQ_TEST_PG_PORT },
  async () => {
    const creds = {
      dbType: 'postgresql',
      host: '127.0.0.1',
      port: Number(process.env.NQ_TEST_PG_PORT),
      database: 'postgres',
      user: 'nq_test',
      password: '',
    }
    const seed = new Client(creds)
    await seed.connect()
    const driver = createDriver(creds)
    try {
      await seed.query('CREATE TABLE IF NOT EXISTS nq_fixture (id integer, label text)')
      await seed.query('TRUNCATE nq_fixture')
      await seed.query(
        "INSERT INTO nq_fixture SELECT n, 'Sample ' || n FROM generate_series(1, 1200) AS n"
      )
      await seed.query(
        "CREATE OR REPLACE FUNCTION nq_write_test() RETURNS integer LANGUAGE plpgsql AS $$BEGIN INSERT INTO nq_fixture VALUES (9999, 'bad'); RETURN 1; END$$"
      )
      await seed.query('CREATE SCHEMA IF NOT EXISTS "nq_fixture schema"')
      await seed.query(
        'CREATE TABLE IF NOT EXISTS "nq_fixture schema".nq_fixture (other_id integer)'
      )
      await seed.query(
        'CREATE TABLE IF NOT EXISTS "nq_fixture schema"."quoted""table" (id integer)'
      )
      await driver.testConnection()
      const schema = await driver.fetchSchema()
      assert.deepEqual(
        schema.find((t) => t.name === '"public"."nq_fixture"')?.columns.map((c) => c.name),
        ['id', 'label']
      )
      assert.deepEqual(
        schema
          .find((t) => t.name === '"nq_fixture schema"."nq_fixture"')
          ?.columns.map((c) => c.name),
        ['other_id']
      )
      assert.equal(
        schema.some((t) => /^"(?:pg_|information_schema)/.test(t.name)),
        false
      )
      const quotedTable = schema.find((t) => t.name === '"nq_fixture schema"."quoted""table"')
      assert.ok(quotedTable)
      assert.deepEqual((await driver.executeQuery('SELECT * FROM ' + quotedTable.name)).fields, [
        'id',
      ])
      assert.equal(
        (
          await driver.executeQuery(
            "SELECT current_setting('standard_conforming_strings') AS setting"
          )
        ).rows[0].setting,
        'on'
      )
      const rows = await driver.executeQuery('SELECT * FROM nq_fixture ORDER BY id LIMIT 50000')
      assert.equal(rows.rows.length, 1000)
      assert.equal(rows.truncated, true)
      assert.equal(
        (await driver.executeQuery("SELECT '--hello' AS literal")).rows[0].literal,
        '--hello'
      )
      assert.equal(
        (await driver.executeQuery('WITH x AS (SELECT * FROM nq_fixture LIMIT 3) SELECT * FROM x'))
          .rows.length,
        3
      )
      await assert.rejects(driver.executeQuery('DELETE FROM nq_fixture'), /SELECT query/)
      await assert.rejects(driver.executeQuery('SELECT nq_write_test()'), /read-only transaction/)
      assert.equal((await seed.query('SELECT count(*) FROM nq_fixture')).rows[0].count, '1200')
    } finally {
      await driver.close()
      await seed.end()
    }
  }
)
