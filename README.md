# Fest Analyse

Django backend and React frontend with a working API connection.

## Run locally

Open two PowerShell terminals in this folder.

Backend:

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py runserver
```

Frontend:

```powershell
cd frontend
npm.cmd run dev
```

Open http://localhost:5173 to see the backend connection status.
API: http://127.0.0.1:8000/api/health/.
Admin: http://127.0.0.1:8000/admin/ (create a user using `.\.venv\Scripts\python.exe manage.py createsuperuser` from backend).

## Fresh installation

Requires Python 3.12 and Node.js 22.12+ or 24.

```powershell
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\backend\.venv\Scripts\python.exe backend/manage.py migrate
cd frontend
npm.cmd ci
```

## Structure

- `backend/config/`: Django settings and root URLs.
- `backend/api/`: API routes and JSON views.
- `frontend/src/`: React components and styles.
- `frontend/vite.config.js`: development proxy forwarding `/api` to Django.

SQLite is configured and local migrations are applied. The API exposes a read-only health endpoint. Django's standard admin, session authentication, and CSRF middleware are enabled.

## Checks

```powershell
.\backend\.venv\Scripts\python.exe backend/manage.py check
cd frontend
npm.cmd run lint
npm.cmd run build
```

## Deployment

The defaults are for local development. Set `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, and `DJANGO_ALLOWED_HOSTS` (comma-separated) in the deployment environment. Settings read environment variables directly; `.env` files are not loaded automatically. In production, serve the frontend build and route `/api/` to Django through your hosting server. The Vite development proxy is not included in the build. Configure HTTPS, static files, and a production application server before deploying.

References: [Django documentation](https://docs.djangoproject.com/en/5.2/) and [Vite guide](https://vite.dev/guide/).
