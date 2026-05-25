# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please **do not** open a public issue. Instead, email the repository owner or maintainers directly. 

We will acknowledge your report, investigate the issue, and coordinate a patch before disclosure.

---

## Purging Exposed Credentials from Git History

Because the database configuration and API keys were previously committed in `.env` files (e.g., `client/.env` and `server/.env`), those credentials should be treated as compromised. 

To remove these files completely from your repository's git history, we recommend using `git-filter-repo` (the modern successor to `git filter-branch` and BFG Repo Cleaner).

### Steps to purge history:

1. **Install `git-filter-repo`**:
   - On macOS (via Homebrew): `brew install git-filter-repo`
   - Via pip: `pip install git-filter-repo`

2. **Clone a fresh, isolated copy of the repository**:
   ```bash
   git clone https://github.com/misty6g/ASL-Study-Tool.git asl-cleanup
   cd asl-cleanup
   ```

3. **Run `git-filter-repo` to delete the `.env` files from all commits**:
   ```bash
   git filter-repo --path ASLStudyTool/client/.env --invert-paths
   git filter-repo --path ASLStudyTool/server/.env --invert-paths
   ```

4. **Force-push the clean history back to the main branch**:
   > [!WARNING]
   > This is a destructive operation that rewrites commit history. Ensure all team members align and push/pull their changes beforehand.
   ```bash
   git remote add origin https://github.com/misty6g/ASL-Study-Tool.git
   git push origin main --force
   ```

5. **Rotate your credentials**:
   - Go to your Supabase/PostgreSQL settings and rotate your API keys, database credentials, and service tokens.

---

## Required Environment Variables

The project requires the following environment variables. Ensure they are configured in your deployment settings (Vercel, Render, Railway, etc.) or set locally in `.env` files (which are ignored by version control).

### Backend Server (`ASLStudyTool/server/.env`)

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | The port the Express API server listens on | `8080` |
| `DATABASE_URL` | The PostgreSQL connection string | `postgresql://user:pass@host:port/db` |
| `JWT_SECRET` | Secret key for signing Access Tokens (short-lived) | *Generate a random secure string* |
| `JWT_REFRESH_SECRET` | Secret key for signing Refresh Tokens (long-lived) | *Generate a random secure string* |
| `AI_SERVICE_URL` | The internal address of the Python AI microservice | `http://localhost:8000` |
| `AI_SERVICE_SECRET` | Shared secret to authenticate backend -> AI calls | *Generate a random secure string* |
| `CORS_ORIGIN` | Allowed origin for frontend requests | `http://localhost:3000` |

### Frontend Client (`ASLStudyTool/client/.env`)

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `REACT_APP_API_URL` | The URL of the backend API server | `http://localhost:8080` |

### AI Microservice (`ASLStudyTool/ai_service/.env`)

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Your Google AI Studio API key | *AI Studio API Key* |
| `AI_SERVICE_SECRET` | Shared secret matching `AI_SERVICE_SECRET` on backend | *Generate a random secure string* |
| `ALLOWED_ORIGIN` | Allowed origin for incoming backend requests | `http://localhost:8080` |
