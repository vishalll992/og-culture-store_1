# OG CULTURE – clothing store (Node + Express + PostgreSQL)

Features: product browsing with category filters, signup/login (JWT), bag, Cash on Delivery checkout,
my orders, and an admin dashboard (add / edit / delete products, manage and delete orders, stats).
Tables and sample products are created automatically on first start.

## Run locally (Windows PowerShell)
    npm install
    $env:DATABASE_URL="postgres://user:pass@localhost:5432/ogculture"
    $env:JWT_SECRET="any-long-random-string"
    npm start
Open http://localhost:3000

Default admin: admin@ogculture.com / admin123 (override with ADMIN_EMAIL / ADMIN_PASSWORD env vars BEFORE first start).

## Deploy on Render (free web service + PostgreSQL)
1. Push this folder to a GitHub repo.
2. Render dashboard -> New -> Blueprint -> pick the repo (it reads render.yaml).
3. Enter a strong ADMIN_PASSWORD when asked, then Apply.
4. Open the URL Render gives you and log in at /#/login as the admin.
