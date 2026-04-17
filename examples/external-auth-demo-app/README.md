# External Auth Demo

This demo shows `nestjs-dj-admin` running in `external` auth mode.

What it demonstrates:

- the host application owns the session cookie
- the admin reuses a Nest guard to authenticate `/admin` requests
- `resolveUser(request)` reads the already-authenticated principal from `request.user`

Run it with:

```bash
npm run dev:external-auth-example
npm run dev:ui
```

Open:

- `http://localhost:5173/admin`

The admin login screen will send you to:

- `http://127.0.0.1:3000/host-auth/login`

From there you can create a host app session and return to the admin.

By default the demo sends the host-auth flow back to `http://localhost:5173/admin`.

If you want a different return target, set:

```bash
EXTERNAL_AUTH_RETURN_URL=http://localhost:5173/admin
```

Demo users:

- `ada@example.com` / `admin123`
- `grace@example.com` / `editor123`
