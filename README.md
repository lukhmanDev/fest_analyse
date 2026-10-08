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

Open http://localhost:5173 to sign in. Create a local account first:

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py createsuperuser
```

Use the username and password you choose. Ordinary active Django users can also sign in. The page includes password visibility, errors, session restoration, and sign-out. Account creation and password recovery are managed by your administrator.
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

SQLite is configured and local migrations are applied. Authentication uses Django REST Framework and Simple JWT. Successful sign-in opens `/dashboard`; reloading restores authentication and dashboard access.

## JWT authentication

| Endpoint | Method | Purpose |
| --- | --- | --- |
| /api/auth/csrf/ | GET | Get a CSRF token before cookie-based POST requests |
| /api/auth/login/ | POST | Send username/password; receive an access JWT and an HttpOnly refresh cookie |
| /api/auth/refresh/ | POST | Rotate the refresh cookie and receive a new access JWT |
| /api/auth/me/ | GET | Read the current user with Authorization: Bearer <access> |
| /api/auth/logout/ | POST | Blacklist the refresh token and clear its cookie |

Access tokens expire after 5 minutes and are stored only in JavaScript memory. Refresh tokens expire after 1 day, rotate after use, and are stored in an HttpOnly, SameSite=Strict cookie scoped to /api/auth/. Cookies use Secure when DJANGO_DEBUG=false. Login, refresh, and logout require an X-CSRFToken header and CSRF cookie. Django admin retains its own session authentication.

The frontend restores login after reload through the refresh cookie. Use the exported apiRequest helper in frontend/src/auth.js for protected API calls; it sends the Bearer header and retries once after refreshing an expired access token. Concurrent refresh requests within a tab share one promise. Separate tabs can race when rotating the shared refresh cookie; if that occurs, sign in again.

Logout revokes the refresh token. An already-issued access token remains valid until its 5-minute expiry. The API no longer exposes the old /api/auth/session/ endpoint. Schedule manage.py flushexpiredtokens daily to clean up expired blacklist records. Add deployment-level login rate limiting before exposing authentication publicly.

See [Simple JWT settings](https://django-rest-framework-simplejwt.readthedocs.io/en/stable/settings.html) for token rotation and blacklist behavior.

## Checks

```powershell
.\backend\.venv\Scripts\python.exe backend/manage.py check
.\backend\.venv\Scripts\python.exe backend/manage.py test api
cd frontend
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

## Deployment

Development CSRF settings trust `http://localhost:5173` and `http://127.0.0.1:5173`. To override these, set `DJANGO_CSRF_TRUSTED_ORIGINS` to a comma-separated list of complete origins (including scheme and port where needed). Development defaults are disabled when `DJANGO_DEBUG=false`. Open the React UI on port 5173; Django's root URL on port 8000 has no page and returns 404.

The defaults are for local development. Set `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, and `DJANGO_ALLOWED_HOSTS` (comma-separated) in the deployment environment. Settings read environment variables directly; `.env` files are not loaded automatically. In production, serve the frontend build and route `/api/` to Django through your hosting server. The Vite development proxy is not included in the build. Configure HTTPS, static files, and a production application server before deploying.

References: [Django documentation](https://docs.djangoproject.com/en/5.2/) and [Vite guide](https://vite.dev/guide/).

## Dashboard and roles

The dashboard shows actual festival counts, a searchable list, and your current role. It starts empty until an Admin or Staff member adds a festival. Upcoming and past counts use the backend timezone (UTC).

| Role | View dashboard and festivals | Create festivals | List team and change roles |
| --- | --- | --- | --- |
| Admin | Yes | Yes | Yes |
| Staff | Yes | Yes | No |
| Viewer | Yes | No | No |

Your existing superuser is automatically an Admin. Other accounts default to Viewer. Migrations create Django groups named Admin, Staff, and Viewer. If multiple role groups are assigned, Admin takes priority, then Staff, then Viewer. Django's `is_staff` flag controls Django admin access separately and does not grant a workspace role.

Create accounts at http://127.0.0.1:8000/admin/ using your superuser. Then sign in to the React app and use **Team & roles** to assign roles. Admins cannot modify their own role or any superuser's role. Role changes preserve unrelated groups and do not grant Django admin or superuser privileges. Roles can also be assigned using groups in Django admin.

The API checks the current database role on each request, so existing JWTs do not retain revoked role privileges. Refresh the dashboard to update visible actions after another administrator changes your role. All authenticated users share the festival list; separate organizations and private festivals are not implemented.

- `GET /api/dashboard/`: current role, permissions, festival counts and list (all roles).
- `POST /api/festivals/`: create a festival with name, date, and location (Admin/Staff).
- `GET /api/users/`: list users and roles (Admin).
- `PATCH /api/users/<id>/role/`: send a JSON `role` of Admin, Staff, or Viewer (Admin).

Protected endpoints require the JWT Bearer header. See [DRF permissions](https://www.django-rest-framework.org/api-guide/permissions/) for the API permission model.
