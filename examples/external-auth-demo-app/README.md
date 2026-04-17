# External Auth Demo

This demo shows `nestjs-dj-admin` running in `external` auth mode.

What it demonstrates:

- the host application owns the session cookie
- the admin reuses a Nest guard to authenticate `/admin` requests
- `resolveUser(request)` reads the already-authenticated principal from `request.user`

Run it with:

```bash
npm run dev:external-auth-example
```

Open:

- `http://127.0.0.1:3000/admin`

The admin login screen will send you to:

- `http://127.0.0.1:3000/host-auth/login`

From there you can create a host app session and return to the admin.

Demo users:

- `ada@example.com` / `admin123`
- `grace@example.com` / `editor123`
