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
- **Product declarations:** tick "This product allows users to make purchases,
  but does not use the Microsoft Store commerce system" (plans are bought on the
  website) and "This product incorporates generative AI features" (Store policy
  11.16). Untick "Windows can include this product's data in automatic backups
  to OneDrive" (connections and history stay on the computer) and "Customers can
  use Windows features to record and broadcast clips" (for games only). Leave
  the rest unchanged.

## 3. Age ratings

IARC questionnaire answers (submitted 2026-10-11):

- App type: **All Other App Types**.
- Ratings-relevant content in the download: No. Users interact with each other: No.
- Online content: **Yes** (the AI writes text; IARC lists "generated AI content"
  as an example). Violence, sexual content, offensive language, drugs: all No.
- Age-restricted products: No. Shares location: No.
- Purchase of digital goods: **Yes** (Upgrade opens the website to buy a plan).
  Random items or loot boxes: No. Cash rewards or NFTs: No.
- Web browser or search engine: No. News or education: No.
- Ratings from a ratings board or physical media: No.

Result: ESRB Everyone, PEGI 3, IARC 3+, Microsoft 3+, USK Everyone, Brazil 14,
with the interactive element "In-App Purchases". The IARC terms checkbox is a
personal statement, so the account owner ticks it.

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
- When you ask a question, NatureQuery's AI service receives your question and the structure of your tables (names, columns, types and approximate sizes), never the data in them. AI summaries use result rows only if you turn that on.

More than questions
- Fix with AI corrects a query when the database reports an error.
- Explain describes any query in plain language.
- Summarize turns a result into a short summary for your team.
- History and saved queries keep your work in one place.
- A built-in sample store database lets you try everything before connecting your own data.

About the AI
NatureQuery uses generative AI to write queries, explanations and summaries from your questions. AI can make mistakes, so check important answers. If an answer is wrong or inappropriate, select the flag button next to it to report it, and we will review it.

NatureQuery needs a free NatureQuery account. The Free plan includes 50 AI questions a month, and paid plans have no monthly limit. Writing queries yourself is always unlimited.
```

### Short description

```
Ask your databases questions in plain English. NatureQuery writes the query, runs it read-only on your computer and shows the answer as a table or chart. Works with PostgreSQL, MySQL, SQL Server, Oracle, MongoDB, Snowflake, BigQuery and more.
```

### What's new in this version

Leave empty for the first submission, as Partner Center asks. For later
versions, describe the changes.

### Developed by

```
NatureQuery
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

**Publishing hold options:** "Publish this submission as soon as it passes
certification" (the default).

### Notes for certification

These now live on a separate page: **Additional Testing Information** in the
left menu (under Supplemental info). Paste this into **Description**, which
must not contain passwords. Then add the test account under **Credentials**
with **New credential**, as two Name and Value pairs: `Email` with the reviewer
email, and `Password` with the reviewer password.

```
NatureQuery requires a free NatureQuery account. The test account's email and password are in the Credentials section of this page.

How to sign in:
1. Open NatureQuery and choose "Sign in with your browser".
2. In the browser, sign in with the test account and choose "Allow".
3. The browser hands you back to NatureQuery. If the browser asks whether to open NatureQuery, allow it. If it does not return to the app, copy the code shown on the page, paste it into NatureQuery and choose "Continue".

What to try:
- In the sidebar, open "Acme Store (sample)", a built-in sample database that needs no setup.
- Choose "Ask" and type a question, for example: Which 5 customers spent the most?
- Switch the results to "Chart", and try "Explain" and "Summarize".

NatureQuery uses live generative AI to write queries, explanations and summaries. Every AI answer has a flag button ("Report AI answer"): in the editor toolbar for a query the AI wrote, and on the explanation and summary cards. Reports reach the developer for review.

NatureQuery connects directly to databases on the user's own computer and network. The sample database is included so the app can be tested without one.
```

### Restricted capability: runFullTrust

On the **Submission options** page, under "Why do you need the runFullTrust
capability" (500 characters at most):

```
NatureQuery is a desktop app built with Electron. It needs full trust to run its database engine as a separate desktop process and to connect directly to databases on the user's computer and local network, such as PostgreSQL, SQL Server and MySQL servers in the office.
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
5. Put the email and password only into the **Credentials** section of
   Additional Testing Information.
