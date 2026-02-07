# ReportFlow

A Next.js application that converts natural language queries to SQL and exports results to Excel, powered by Claude AI.

## Features

- 🤖 Natural language to SQL conversion using Claude AI
- 📊 PostgreSQL database connection management
- 📑 Excel export with formatting using ExcelJS
- 🎨 Modern, responsive UI with Tailwind CSS
- ⚡ Built on Next.js 15 App Router with Server Actions

## Project Structure

```
reportflow/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout with fonts
│   │   ├── page.tsx            # Main dashboard page
│   │   └── globals.css         # Global styles
│   ├── components/             # React components (to be added)
│   ├── lib/                    # Core utilities
│   │   ├── ai.ts               # Anthropic Claude integration
│   │   ├── db.ts               # PostgreSQL connection utilities
│   │   ├── excel.ts            # Excel export functionality
│   │   ├── types.ts            # TypeScript type definitions
│   │   └── utils.ts            # Helper functions
│   └── actions/                # Next.js Server Actions
│       └── query.ts            # Query-related server actions
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.js
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Anthropic API key

### Installation

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Create a `.env.local` file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your credentials:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

3. **Run the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Key Dependencies

- **next**: React framework with App Router
- **react** & **react-dom**: UI library
- **lucide-react**: Icon library
- **pg**: PostgreSQL client for Node.js
- **anthropic**: Claude AI SDK
- **exceljs**: Excel file generation
- **clsx**: Utility for conditional classes
- **tailwindcss**: Utility-first CSS framework

## Usage

### Adding a Database Connection

1. Click "Add Connection" in the sidebar
2. Enter your PostgreSQL credentials:
   - Host
   - Port
   - Database name
   - Username
   - Password
3. Test the connection

### Creating Queries

1. Select a database connection from the sidebar
2. Enter your query in natural language, for example:
   - "Show me all users who signed up in the last 30 days"
   - "Get the top 10 products by revenue this quarter"
   - "Find customers who haven't made a purchase in 6 months"
3. Click "Generate SQL" to convert to SQL
4. Review the generated SQL query
5. Execute the query
6. Export results to Excel

### Exporting to Excel

After executing a query:
1. Click "Export to Excel"
2. The file will include:
   - Query metadata (row count, execution time)
   - Formatted headers
   - Auto-sized columns
   - Bordered data cells

## Architecture

### Frontend (Client Components)

- **Dashboard**: Main UI with sidebar and query workspace
- **Connection Manager**: Database connection interface
- **Query Builder**: Natural language input and SQL preview
- **Results Viewer**: Display query results

### Backend (Server Actions)

- **generateSQL**: Converts natural language to SQL using Claude
- **executeSQL**: Runs SQL queries against PostgreSQL
- **exportResults**: Generates Excel files from query results
- **testDatabaseConnection**: Validates database credentials

### AI Integration

The app uses Claude Sonnet 4 to:
- Parse natural language queries
- Generate optimized SQL
- Provide query explanations
- Suggest improvements

## Development

### Adding New Features

1. **New Server Action**: Add to `src/actions/`
2. **New Component**: Add to `src/components/`
3. **New Utility**: Add to `src/lib/`

### Type Safety

The project uses TypeScript throughout. Key types are defined in `src/lib/types.ts`:

- `DatabaseConnection`: Database credential schema
- `QueryResult`: Query execution response
- `NLToSQLRequest`: AI request payload
- `NLToSQLResponse`: AI response payload

## Security Considerations

- Database credentials should be encrypted at rest
- Use environment variables for sensitive data
- Implement rate limiting for AI API calls
- Validate and sanitize all user inputs
- Use parameterized queries to prevent SQL injection

## Future Enhancements

- [ ] Multiple database support (MySQL, SQLite, etc.)
- [ ] Query history and favorites
- [ ] Real-time collaboration
- [ ] Query scheduling and automation
- [ ] Advanced visualization options
- [ ] Custom report templates
- [ ] API key management UI
- [ ] User authentication and multi-tenancy

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
