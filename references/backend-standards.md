# Backend Standards Reference

> Mandatory backend/API/database rules for all server-side code.
> Every developer, reviewer, and tester agent MUST follow these standards.

---

## API Design

### RESTful Conventions
- Use nouns for resources: `/api/users`, `/api/projects`, NOT `/api/getUsers`
- HTTP methods: GET (read), POST (create), PUT (full update), PATCH (partial update), DELETE
- Plural resource names: `/api/users` not `/api/user`
- Nested resources for relationships: `/api/projects/:id/tasks`
- Query params for filtering/sorting: `?status=active&sort=created_at&order=desc`
- Pagination: `?page=1&limit=20` or cursor-based `?cursor=abc123&limit=20`

### HTTP Status Codes (use correctly)
```
200 OK              - Successful GET, PUT, PATCH
201 Created         - Successful POST that creates a resource
204 No Content      - Successful DELETE
400 Bad Request     - Invalid input, validation failure
401 Unauthorized    - Missing or invalid authentication
403 Forbidden       - Authenticated but not authorized
404 Not Found       - Resource does not exist
409 Conflict        - Duplicate resource, state conflict
422 Unprocessable   - Validation errors (alternative to 400)
429 Too Many Reqs   - Rate limiting
500 Internal Error  - Unexpected server error (never intentional)
```

### Error Response Format
All errors MUST follow this structure:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

### Success Response Format
```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

---

## Database Standards

### Parameterized Queries (MANDATORY)
```javascript
// CORRECT - Parameterized
db.query("SELECT * FROM users WHERE id = $1", [userId]);
db.prepare("INSERT INTO tasks (title, status) VALUES ($1, $2)").run(title, status);

// BANNED - String interpolation (SQL injection risk!)
// db.query(`SELECT * FROM users WHERE id = ${userId}`);
// db.query("SELECT * FROM users WHERE name = '" + name + "'");
```

### Schema Conventions
- Table names: lowercase, plural, snake_case: `user_tasks`, `project_members`
- Column names: lowercase, snake_case: `created_at`, `is_active`, `user_id`
- Primary keys: `id` (integer autoincrement or UUID)
- Foreign keys: `<table_singular>_id`: `user_id`, `project_id`
- Timestamps: always include `created_at` and `updated_at`
- Booleans: prefix with `is_` or `has_`: `is_active`, `has_access`
- Soft delete: use `deleted_at` timestamp, not boolean

### Index Strategy
- Always index foreign keys
- Always index columns used in WHERE clauses
- Always index columns used in ORDER BY
- Composite indexes: most selective column first
- Use `EXPLAIN ANALYZE` to verify query performance
- Do not over-index: each index slows writes

### Migration Patterns
- Migrations are forward-only in production
- Each migration file: `001_create_users.sql`, `002_add_tasks.sql`
- Always include both `up` and `down` in migration files
- Never modify data in schema migrations - use separate data migrations
- Test migrations on empty DB AND on DB with data

### Connection Management
- Use connection pooling (never open/close per request)
- Set reasonable pool size: 5-20 connections
- Set connection timeout: 5-10 seconds
- Handle connection errors gracefully
- Close pool on application shutdown

---

## Error Handling

### Typed Errors (not generic catch-all)
```javascript
class AppError extends Error {
  constructor(code, message, statusCode = 500) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

class ValidationError extends AppError {
  constructor(message, details = []) {
    super("VALIDATION_ERROR", message, 400);
    this.details = details;
  }
}

class NotFoundError extends AppError {
  constructor(resource, id) {
    super("NOT_FOUND", `${resource} with id ${id} not found`, 404);
  }
}
```

### Error Handling Rules
- Never swallow errors silently (empty catch blocks)
- Always log errors with context (what operation, what input)
- Return appropriate HTTP status codes (see table above)
- Do not expose stack traces or internal paths in production
- Do not expose database error messages to clients
- Use error middleware for consistent error formatting

---

## Security

### Input Validation
- Validate ALL input at system boundaries (API endpoints)
- Use a validation library (zod, joi, yup) - do not hand-roll
- Validate types, ranges, lengths, formats
- Sanitize HTML input to prevent XSS
- Validate file uploads: type, size, extension

### SQL Injection Prevention
- ONLY use parameterized queries (see above)
- Never build SQL strings with concatenation
- Use an ORM or query builder for complex queries
- Audit raw SQL queries during code review

### Environment Variables
- `.env` file MUST be in `.gitignore` (NEVER commit secrets)
- Create `.env.example` with dummy values (committed to repo)
- Required env vars: check at startup, fail fast if missing
- Never log environment variables
- Never expose env vars in API responses

### CORS Configuration
- Do not use `*` for allowed origins in production
- List specific allowed origins
- Set appropriate methods and headers
- Handle preflight requests (OPTIONS)

### Rate Limiting
- Implement rate limiting on all public endpoints
- Use sliding window algorithm
- Return `429 Too Many Requests` with `Retry-After` header
- Stricter limits on auth endpoints (login, register)

---

## Project Structure

### Standard Layout
```
src/
  server.js          # Entry point, server startup
  routes/            # Route definitions (one file per resource)
    users.js
    tasks.js
    index.js         # Route aggregator
  middleware/        # Express/Hono middleware
    auth.js
    error-handler.js
    validate.js
  db/                # Database layer
    connection.js    # Pool/connection setup
    migrations/      # SQL migration files
    queries/         # Named query files or functions
  services/          # Business logic (not in routes)
    user-service.js
    task-service.js
  utils/             # Shared utilities
    errors.js        # Error classes
  config/            # Configuration
    index.js         # Env var loading, defaults
```

### Separation of Concerns
- Routes: HTTP handling (parse request, send response)
- Services: Business logic (validation, orchestration)
- DB/Queries: Data access (SQL, ORM calls)
- Never put business logic in route handlers
- Never put HTTP concerns in services
- Never put SQL in route handlers

---

## Logging

### What to Log
- Request method, path, status code, duration
- Errors with full context (stack trace in dev, message in prod)
- Authentication events (login, logout, failed attempts)
- Database query failures
- External API calls (request/response summary)

### What NOT to Log
- Passwords or tokens
- Full request/response bodies (too verbose)
- Personal data (email, phone) in plain text
- Environment variables or secrets

### Log Format
```javascript
// Structured logging
console.log(JSON.stringify({
  level: "error",
  message: "Failed to create user",
  error: err.message,
  userId: req.user?.id,
  timestamp: new Date().toISOString()
}));
```

---

## Testing Standards

### What to Test
- Every API endpoint: happy path + error cases
- Input validation: invalid types, missing fields, boundary values
- Database operations: CRUD, constraints, edge cases
- Business logic: service layer functions
- Error handling: proper status codes and messages

### Test Structure
```javascript
describe("POST /api/users", () => {
  it("creates a user with valid input", async () => { ... });
  it("returns 400 for missing email", async () => { ... });
  it("returns 409 for duplicate email", async () => { ... });
  it("returns 422 for invalid email format", async () => { ... });
});
```

### Test Database
- Use a separate test database or in-memory SQLite
- Reset state between tests (truncate tables)
- Do not depend on test execution order
- Use factories/fixtures for test data, not hardcoded values
