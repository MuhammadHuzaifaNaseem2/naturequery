# Microsoft Store listing for NatureQuery

Copy each block into Partner Center, in the submission for **NatureQuery**
(Store ID 9N6PJDWJRLFM). The sections follow the order of the submission
pages. Never put the reviewer password in this file.

---

## 1. Pricing and availability

- **Visibility:** _Public audience_, with **"Make this product available but
  not discoverable in the Store"**. Only people with the link can find and
  install it, which suits the pilot. Change it to discoverable later.
- **Markets:** all markets (the default).
- **Pricing:** Free. Plans are bought on naturequery.app, not in the app.
- **Schedule:** as soon as possible after certification.

The link to share: https://apps.microsoft.com/detail/9N6PJDWJRLFM

## 2. Properties

- **Category:** Business. **Subcategory:** Data & analytics. If that
  subcategory is not offered, choose Developer tools, then Database.
- **Privacy policy URL:** https://naturequery.app/privacy
- **Website:** https://naturequery.app
- **Support contact info:** https://naturequery.app/contact
- **System requirements (minimum):** Windows 10 version 1809 or later, 64-bit
  (x64), 4 GB of memory, internet connection for sign-in and AI questions.

## 3. Age ratings

Fill in the questionnaire with the app type **Productivity / utility** (not a
game). NatureQuery has no violence, sexual content, gambling or user-to-user
chat, does not share the user's location, and sells nothing inside the app
(plans are bought on the website). It does collect account details (name and
email) to sign in.

## 4. Packages

Upload `desktop/release/NatureQuery-<version>-store-x64.appx`, built with
`npm run dist:store`. Every new submission needs a higher `version` in
`desktop/package.json`.

## 5. Store listing (English, United States)

### Description

```
Ask your company's databases questions in plain English and get answers in seconds, right from your own computer.

NatureQuery connects to the databases your business already uses: PostgreSQL, MySQL, MariaDB, SQL Server, Oracle, SQLite, MongoDB, Snowflake, BigQuery, ClickHouse, Amazon Redshift, CockroachDB, Neon, PlanetScale, Turso, Amazon DynamoDB, Cloud Firestore and Apache Cassandra. Because it runs on your PC, it also reaches databases on your office network that cloud tools cannot.

Type a question such as "Which 10 customers spent the most this year?" and NatureQuery writes the query, shows it to you and runs it. Results appear as a table you can sort and filter, or as a chart. Export them to Excel, CSV or JSON in one click.

Safe by design
- NatureQuery runs read-only queries, so your data is not changed.
- Database passwords are encrypted with your Windows account and never leave your computer.
- When you ask a question, only your question and the structure of your tables (names, columns, types and approximate sizes) are sent to NatureQuery's AI service. Your data stays on your computer.

More than questions
- Fix with AI corrects a query when the database reports an error.
- Explain describes any query in plain language.
- Summarize turns a result into a short summary for your team.
- History and saved queries keep your work in one place.
- A built-in sample store database lets you try everything before connecting your own data.

NatureQuery needs a free NatureQuery account. The Free plan includes 50 AI questions a month, and paid plans have no monthly limit. Writing queries yourself is always unlimited.
```

### What's new in this version

```
The first release of NatureQuery in the Microsoft Store.
```

### Product features (one per field)

```
Ask questions in plain English and get the query and the answer
Works with PostgreSQL, MySQL, SQL Server, Oracle, MongoDB, Snowflake, BigQuery and 11 more databases
Connects to databases on your PC, your office network or the cloud
Read-only queries, so your data is not changed
Database passwords encrypted with your Windows account
Sort and filter results, or show them as a chart
Export results to Excel, CSV or JSON
Fix with AI, Explain and Summarize
Query history and saved queries
Built-in sample database to try it without any setup
Encrypted connections and SSH tunnels
```

### Search terms (seven)

```
SQL
database
text to SQL
AI query
data analytics
business intelligence
SQL client
```

### Copyright and trademark info

```
© 2026 NatureQuery
```

### Screenshots

Upload the PNG files in `desktop/store/screenshots/` (1920 x 1080), in the
order of their numbers, and use each caption below as the screenshot's caption.
To make them again, run `node test/e2e/store-screenshots.mjs` in `desktop/`
with the end-to-end test setup (see `test/e2e/README.md`).

1. Ask a question in plain English and see the answer.
2. Turn results into a chart in one click.
3. See in plain language what a query does.
4. Get a short summary of any result.
5. Connect to the databases your business already uses.
6. Your connections and recent questions in one place.

## 6. Submission options

### Notes for certification

Create the reviewer account first (see "Reviewer account" below), then paste
this and fill in the email and password:

```
NatureQuery requires a free NatureQuery account. Please use this test account:
Email: <reviewer email>
Password: <reviewer password>

How to sign in:
1. Open NatureQuery and choose "Sign in with your browser".
2. In the browser, sign in with the test account above and choose "Allow".
3. The browser hands you back to NatureQuery. If the browser asks whether to open NatureQuery, allow it. If it does not return to the app, copy the code shown on the page, paste it into NatureQuery and choose "Continue".

What to try:
- In the sidebar, open "Acme Store (sample)", a built-in sample database that needs no setup.
- Choose "Ask" and type a question, for example: Which 5 customers spent the most?
- Switch the results to "Chart", and try "Explain" and "Summarize".

NatureQuery connects directly to databases on the user's own computer and network. The sample database is included so the app can be tested without one.
```

### Restricted capability: runFullTrust

When Partner Center asks why the package needs `runFullTrust`:

```
NatureQuery is a desktop app built with Electron. It needs full trust to run its database engine as a separate desktop process and to connect directly to databases on the user's computer and local network.
```

## Reviewer account

Microsoft's testers need an email-and-password account; they cannot use your
Google sign-in.

1. On https://naturequery.app/register, sign up with the name
   **Microsoft Review** and the email **naturequery.team+review@gmail.com**.
   Gmail delivers mail for `+review` to the normal naturequery.team inbox.
2. Choose a strong password that you use nowhere else.
3. Open the verification email in the naturequery.team inbox and verify.
4. Sign in once on the website to check that the account works.
5. Put the email and password only into **Notes for certification**.
