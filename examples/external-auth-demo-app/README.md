# External Auth Demo

This demo shows `nestjs-dj-admin` running in `external` auth mode.

What it demonstrates:

- the host application owns the session cookie
- the admin reuses Nest guards to authenticate and authorize `/admin` requests
- `resolveUser(request)` reads the already-authenticated principal from `request.user`

Run it with:

```bash
npm run dev:external-auth-example
npm run dev:ui
```

Open:

- `http://localhost:5173/admin/`

The admin login screen will send you to:

- `http://127.0.0.1:3000/host-auth/login`

From there you can create a host app session and return to the admin.

By default the demo sends the host-auth flow back to `http://localhost:5173/admin/`.

If you want a different return target, set:

```bash
EXTERNAL_AUTH_RETURN_URL=http://localhost:5173/admin/
```

Demo users:

- `ada@example.com` / `admin123` - allowed into admin
- `grace@example.com` / `editor123` - allowed into the admin with scoped permissions
- `linus@example.com` / `viewer123` - authenticates in the host app but is blocked from admin by the admin access guard
