# End-to-end test: sign-in and AI

Runs the real desktop app against the website running on this computer and a
throwaway PostgreSQL database, then checks the whole flow a customer goes
through:

1. "Sign in for AI" opens the approval page (recorded, not opened in your browser).
2. A hidden browser window logs in through the real login form and chooses Allow.
3. The `naturequery://` link is handed to the running app by a second copy, as Windows does.
4. Questions, a follow-up, Explain, Summarize, Fix with AI, a declined request to
   delete data, plan counting, and sign-out revoking the server session.

It makes about seven requests to the AI provider configured in the website's
`.env.local`, and never touches your NatureQuery profile, your browser or a real
database.

## Run

From the repository root, start a throwaway database and apply the migrations:

```powershell
docker run -d --name nq-web-db -e POSTGRES_PASSWORD=webtest_pw -e POSTGRES_DB=naturequery_test -p 55442:5432 postgres:17-alpine
$env:DATABASE_URL = 'postgresql://postgres:webtest_pw@127.0.0.1:55442/naturequery_test'
npx prisma migrate deploy
```

In the same terminal, start the website on port 3100 against that database:

```powershell
$env:NEXTAUTH_URL = 'http://localhost:3100'; $env:AUTH_URL = 'http://localhost:3100'
$env:AUTH_TRUST_HOST = 'true'; $env:NEXT_PUBLIC_APP_URL = 'http://localhost:3100'
npx next dev --turbopack -p 3100
```

In a second terminal, build the desktop app and run the test:

```powershell
cd desktop
npm run build
npm run test:e2e
```

Screenshots of each step are saved in `%TEMP%\nq-desktop-e2e\shots`. Remove the
database afterwards with `docker rm -f nq-web-db`.
