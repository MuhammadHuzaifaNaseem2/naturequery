# NatureQuery Desktop user guide

NatureQuery Desktop lets you ask questions about your company's databases in
plain English, or write queries yourself, from your own computer. It connects
directly to databases on your PC, your office network or the cloud, including
ones a website cannot reach.

**Requirements:** Windows 10 or 11 (64-bit). About 600 MB of disk space.

---

## 1. Install

1. Run `NatureQuery-<version>-win-x64-Setup.exe`.
2. If Windows shows **Windows protected your PC**, choose **More info**, then
   **Run anyway**. Windows shows this for new apps until enough people have
   installed them. On company-managed PCs, your IT team may need to allow it.
3. Choose where to install (the default needs no administrator rights) and
   finish. NatureQuery opens when installation completes.

Updates: NatureQuery checks for new versions and asks before downloading one.
The update installs when you restart the app. You can turn checks off in
**Settings, Updates**.

## 2. Sign in

NatureQuery opens on a sign-in screen, because your connections and history
belong to your NatureQuery account.

1. Choose **Sign in with your browser**. Your browser opens naturequery.app;
   sign in, or create a free account, then choose **Allow**.
2. The browser sends you back to the app. If it does not, copy the code shown
   on the page, paste it into the app and choose **Continue**.

Each account has its own connections, history, saved queries and open tabs on
this computer. To sign out, choose your name at the bottom left, then **Sign
out**: NatureQuery closes your work, disconnects from your databases and
returns to the sign-in screen. Someone else who signs in on the same computer
sees only their own work. For complete separation, each person should also use
their own Windows account.

If you used NatureQuery before sign-in was required, your connections and
history move into the first account that signs in.

## 3. Try the sample database

Choose **Acme Store (sample)** in the sidebar. It is a small store database with
customers, products and orders, built into the app, so you can try queries,
charts and exports before connecting your own data.

## 4. Connect your database

Choose **Connect your first database** (or **+** next to Connections), pick the
database type, fill in the form and choose **Test connection**. When the test
succeeds, choose **Save and connect**.

NatureQuery only reads data. Every query is checked before it runs and anything
that would change data is blocked, and where the database allows it, queries
also run in a read-only session. Even so, **connect with an account that can
only read**. The commands below create one; your database administrator can run
them. Replace the names and the password with your own.

**PostgreSQL** (also Amazon Redshift, CockroachDB and Neon, with small differences)

```sql
CREATE ROLE naturequery_reader LOGIN PASSWORD 'choose-a-strong-password';
GRANT CONNECT ON DATABASE sales TO naturequery_reader;
GRANT pg_read_all_data TO naturequery_reader;  -- PostgreSQL 14 and later
```

**MySQL and MariaDB** (also PlanetScale)

```sql
CREATE USER 'naturequery_reader'@'%' IDENTIFIED BY 'choose-a-strong-password';
GRANT SELECT, SHOW VIEW ON sales.* TO 'naturequery_reader'@'%';
```

**Microsoft SQL Server and Azure SQL**

```sql
CREATE LOGIN naturequery_reader WITH PASSWORD = 'Choose-a-strong-password1';
USE Sales;
CREATE USER naturequery_reader FOR LOGIN naturequery_reader;
ALTER ROLE db_datareader ADD MEMBER naturequery_reader;
```

For a named instance such as `SERVER\SQLEXPRESS`, enter the instance name; the
SQL Server Browser service must be running on the server. Windows (domain)
accounts are supported: choose **Windows account** and enter `DOMAIN\user`.

**Oracle**

```sql
CREATE USER naturequery_reader IDENTIFIED BY "Choose-a-strong-password1";
GRANT CREATE SESSION TO naturequery_reader;
GRANT READ ANY TABLE TO naturequery_reader;  -- or GRANT SELECT on specific tables
```

Connect with the service name (for example `ORCLPDB1`) or the SID.

**MongoDB**

```js
use admin
db.createUser({
  user: "naturequery_reader",
  pwd: "choose-a-strong-password",
  roles: [{ role: "read", db: "sales" }],
})
```

For MongoDB Atlas, choose **Connection string**, paste the string from Atlas
(Connect, Drivers) and add this computer's IP address to the Atlas IP Access
List.

**ClickHouse**

```sql
CREATE USER naturequery_reader IDENTIFIED BY 'choose-a-strong-password' SETTINGS readonly = 2;
GRANT SELECT ON sales.* TO naturequery_reader;
```

`readonly = 2` still blocks all changes but lets NatureQuery apply its query
time limit. ClickHouse Cloud uses HTTPS on port 8443.

**Snowflake**

```sql
CREATE ROLE NATUREQUERY_READER;
GRANT USAGE ON WAREHOUSE COMPUTE_WH TO ROLE NATUREQUERY_READER;
GRANT USAGE ON DATABASE SALES TO ROLE NATUREQUERY_READER;
GRANT USAGE ON ALL SCHEMAS IN DATABASE SALES TO ROLE NATUREQUERY_READER;
GRANT SELECT ON ALL TABLES IN DATABASE SALES TO ROLE NATUREQUERY_READER;
GRANT SELECT ON ALL VIEWS IN DATABASE SALES TO ROLE NATUREQUERY_READER;
GRANT ROLE NATUREQUERY_READER TO USER JANE;
```

Enter `NATUREQUERY_READER` as the role in the connection form. Sign in with a
password, a programmatic access token (paste it into the password field; needed
when your account uses multi-factor sign-in) or a key pair.

**Google BigQuery**: create a service account with the **BigQuery Data
Viewer** and **BigQuery Job User** roles, create a JSON key for it, and choose
that file in the connection form. To protect you from unexpected bills, a single
query may scan at most 50 GB.

**Amazon DynamoDB**: create an IAM user with this policy and an access key:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:ListTables",
        "dynamodb:DescribeTable",
        "dynamodb:Scan",
        "dynamodb:PartiQLSelect"
      ],
      "Resource": "*"
    }
  ]
}
```

**Cloud Firestore**: create a service account with the **Cloud Datastore
Viewer** role and a JSON key.

**Apache Cassandra and ScyllaDB**

```sql
CREATE ROLE naturequery_reader WITH PASSWORD = 'choose-a-strong-password' AND LOGIN = true;
GRANT SELECT ON KEYSPACE shop TO naturequery_reader;
```

Enter the local data center name; `nodetool status` shows it.

**Turso and libSQL**: create a read-only token with
`turso db tokens create <database> --read-only`.

**SQLite**: choose the database file. It is opened read-only.

### Databases on another network

- **Company network or VPN**: connect to the VPN first, then use the server's
  name or IP address.
- **SSH tunnel**: if the database is only reachable through a jump server, open
  **SSH tunnel** in the connection form. NatureQuery remembers the server's key
  on first use and refuses to connect if it ever changes.
- **Encryption**: **Connection security** controls TLS. "Prefer encryption"
  works with most servers; choose "Verify certificate and host name" for
  databases on the internet. Certificates installed on your PC by your IT team
  are trusted automatically.

## 5. Ask questions in plain English

1. In a query tab, choose **Ask** and type a question, for example
   _"Top 10 customers by revenue this year"_, then press Enter.
2. NatureQuery writes the query, shows it in the editor and runs it. You can
   edit it and press **Run** again. To look at queries before they run, turn on
   **Settings, AI assistant, Review SQL before it runs**.
3. Ask follow-ups such as _"only last month"_ to refine the result, or choose
   **New question** to start over.

Also available:

- **Fix with AI** appears when the database rejects a query. It suggests a
  corrected query and runs it. **Undo AI fix** puts your query back.
- **Explain** describes any query in plain language.
- **Summarize** describes the result for business readers.

Writing queries yourself has no limit. The Free plan
includes 50 AI questions a month (only questions that produce a query count);
paid plans have no monthly limit. The account menu shows how many you have left.

## 6. Privacy and security

**Stays on this computer**

- Your connections. Passwords, keys and tokens are encrypted with your Windows
  account and are never sent to NatureQuery.
- Query results, history and saved queries.
- Log files, with passwords and tokens removed.

**Sent to NatureQuery, only when you use an AI feature**

- **Ask**: your question, your recent follow-up questions with the queries they
  produced, the database type, and the names and types of your tables and
  columns, with their keys, relationships and approximate row counts. Never the
  data in them.
- **Fix with AI**: the query, the database's error message, and the same table
  and column names.
- **Explain**: the query.
- **Summarize**: the question, the query, the column names and the row count.
  Result rows are included only if you turn on **Let AI summaries use result
  rows** (off by default); then at most 50 rows are sent, with long values
  shortened.

NatureQuery counts your AI questions for your plan but does not store the
questions, queries or schema details. The text is processed by NatureQuery's AI
providers to produce the answer.

Signing in happens in your web browser, so the app never sees your NatureQuery
password. You can see and sign out every computer that is signed in under
**Settings, Security** on naturequery.app. Changing your password signs out all
of them.

## 7. Everyday use

- **Results**: switch between **Table** and **Chart**; **Copy** pastes into
  Excel; **Export** saves Excel, CSV or JSON files.
- **Row limit and time limit**: queries return up to 1,000 rows and stop after
  60 seconds by default. Change both in **Settings**.
- **History** keeps every query you ran; **Saved queries** keeps the ones you
  name. Both stay on this computer and belong to your account.
- **Ctrl+K** opens the command palette; **Ctrl+Enter** runs the query.

## 8. Troubleshooting

| Message                                                 | What to do                                                                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| The server refused the connection                       | Check the host and port, that the database is running, and that its firewall allows this computer.                                     |
| The server name could not be found                      | Check the spelling, or connect to the VPN first.                                                                                       |
| The database rejected the user name or password         | Check the credentials; passwords are case-sensitive.                                                                                   |
| The server's security certificate could not be verified | For a self-signed certificate choose "Require encryption, trust server certificate", or add your company's certificate authority file. |
| The identity of the SSH server has changed              | The jump server's key changed. Confirm with IT that this is expected, then remove and re-enter the SSH settings.                       |
| This Snowflake account requires multi-factor sign-in    | Use a programmatic access token or key pair sign-in.                                                                                   |
| You have used all AI questions this month               | Upgrade, or keep writing queries yourself (always free).                                                                               |
| You were signed out. Sign in again to continue.         | Your sign-in ended, for example after a password change. Sign in again: your connections and history are still there.                  |
| Your antivirus blocks or removes NatureQuery            | New apps are sometimes flagged by mistake. Ask IT to allow `%LOCALAPPDATA%\Programs\NatureQuery` and tell us the detection name.       |

**Sending logs to support:** choose **Settings, Show log files**, and attach
`main.log` to your message. Logs never contain passwords or tokens.

**Support:** https://naturequery.app/contact

## 9. Uninstall

Open Windows **Settings, Apps**, find **NatureQuery** and choose **Uninstall**.
Your connections and history stay in `%APPDATA%\NatureQuery` in case you
reinstall; delete that folder to remove them too.
