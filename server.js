const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const url = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: url,
  ssl: url && !/localhost|127\.0\.0\.1/.test(url) ? { rejectUnauthorized: false } : false,
});
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const q = (t, p) => pool.query(t, p);
const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'Server error' }); });

async function init() {
  await q(`CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'user')`);
  await q(`CREATE TABLE IF NOT EXISTS products(id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', price NUMERIC(10,2) NOT NULL, category TEXT DEFAULT 'Tees', image TEXT DEFAULT '', sizes TEXT DEFAULT 'S,M,L,XL', stock INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now())`);
  await q(`CREATE TABLE IF NOT EXISTS orders(id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE SET NULL, name TEXT, phone TEXT, address TEXT, payment_method TEXT DEFAULT 'COD', total NUMERIC(10,2), status TEXT DEFAULT 'Pending', created_at TIMESTAMPTZ DEFAULT now())`);
  await q(`CREATE TABLE IF NOT EXISTS order_items(id SERIAL PRIMARY KEY, order_id INT REFERENCES orders(id) ON DELETE CASCADE, product_id INT, name TEXT, price NUMERIC(10,2), qty INT, size TEXT)`);

  const email = (process.env.ADMIN_EMAIL || 'admin@ogculture.com').toLowerCase();
  const pass = process.env.ADMIN_PASSWORD || 'admin123';
  if (!(await q('SELECT 1 FROM users WHERE email=$1', [email])).rowCount)
    await q(`INSERT INTO users(name,email,password,role) VALUES('Admin',$1,$2,'admin')`, [email, await bcrypt.hash(pass, 10)]);

  if (!(await q('SELECT 1 FROM products LIMIT 1')).rowCount) {
    const u = id => `https://images.unsplash.com/${id}?w=700&q=80&auto=format&fit=crop`;
    const seed = [
      ['OG Oversized Tee', 'Heavyweight 240gsm cotton, boxy fit.', 899, 'Tees', u('photo-1521572163474-6864f9cf17ab')],
      ['Street Graphic Tee', 'Drop shoulder with back print.', 999, 'Tees', u('photo-1583743814966-8936f5b7be1a')],
      ['Cloud Hoodie', 'Fleece-lined, oversized, kangaroo pocket.', 1899, 'Hoodies', u('photo-1556821840-3a63f95609a7')],
      ['Night Shift Hoodie', 'Black on black embroidery.', 1999, 'Hoodies', u('photo-1578768079052-aa76e52ff62e')],
      ['Baggy Cargo Pants', 'Six pockets, relaxed leg.', 1599, 'Bottoms', u('photo-1624378439575-d8705ad7ae80')],
      ['Wide Leg Denim', 'Washed indigo, 90s cut.', 1799, 'Bottoms', u('photo-1542272604-787c3835535d')],
      ['Varsity Jacket', 'Wool body, faux leather sleeves.', 3299, 'Outerwear', u('photo-1551028719-00167b16eac5')],
      ['OG Dad Cap', 'Washed cotton, embroidered logo.', 499, 'Accessories', u('photo-1588850561407-ed78c282e89b')],
    ];
    for (const [n, d, p, c, i] of seed)
      await q('INSERT INTO products(name,description,price,category,image,stock) VALUES($1,$2,$3,$4,$5,50)', [n, d, p, c, i]);
  }
}

const sign = u => jwt.sign({ id: u.id, role: u.role }, SECRET, { expiresIn: '7d' });
const pub = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
function auth(req, res, next) {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); next(); }
  catch { res.status(401).json({ error: 'Please log in' }); }
}
const admin = (req, res, next) => req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admins only' });

// ---- auth
app.post('/api/signup', wrap(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ error: 'Name, email and a 6+ char password required' });
  if ((await q('SELECT 1 FROM users WHERE email=$1', [email.toLowerCase()])).rowCount) return res.status(400).json({ error: 'Email already registered' });
  const r = await q(`INSERT INTO users(name,email,password) VALUES($1,$2,$3) RETURNING *`, [name, email.toLowerCase(), await bcrypt.hash(password, 10)]);
  res.json({ token: sign(r.rows[0]), user: pub(r.rows[0]) });
}));
app.post('/api/login', wrap(async (req, res) => {
  const r = await q('SELECT * FROM users WHERE email=$1', [(req.body.email || '').toLowerCase()]);
  const u = r.rows[0];
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password))) return res.status(400).json({ error: 'Wrong email or password' });
  res.json({ token: sign(u), user: pub(u) });
}));

// ---- products
app.get('/api/products', wrap(async (req, res) => {
  const { category, q: s } = req.query;
  const r = await q(`SELECT * FROM products WHERE ($1::text IS NULL OR category=$1) AND ($2::text IS NULL OR name ILIKE '%'||$2||'%') ORDER BY id DESC`, [category || null, s || null]);
  res.json(r.rows);
}));
app.get('/api/products/:id', wrap(async (req, res) => {
  const r = await q('SELECT * FROM products WHERE id=$1', [req.params.id]);
  r.rows[0] ? res.json(r.rows[0]) : res.status(404).json({ error: 'Not found' });
}));
const pf = b => [b.name, b.description || '', +b.price || 0, b.category || 'Tees', b.image || '', b.sizes || 'S,M,L,XL', +b.stock || 0];
app.post('/api/products', auth, admin, wrap(async (req, res) => {
  const r = await q('INSERT INTO products(name,description,price,category,image,sizes,stock) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', pf(req.body));
  res.json(r.rows[0]);
}));
app.put('/api/products/:id', auth, admin, wrap(async (req, res) => {
  const r = await q('UPDATE products SET name=$1,description=$2,price=$3,category=$4,image=$5,sizes=$6,stock=$7 WHERE id=$8 RETURNING *', [...pf(req.body), req.params.id]);
  res.json(r.rows[0]);
}));
app.delete('/api/products/:id', auth, admin, wrap(async (req, res) => {
  await q('DELETE FROM products WHERE id=$1', [req.params.id]); res.json({ ok: true });
}));

// ---- orders (COD only)
app.post('/api/orders', auth, wrap(async (req, res) => {
  const { items, name, phone, address } = req.body;
  if (!items?.length || !name || !phone || !address) return res.status(400).json({ error: 'Fill all delivery details' });
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    let total = 0; const lines = [];
    for (const it of items) {
      const p = (await c.query('SELECT * FROM products WHERE id=$1 FOR UPDATE', [it.id])).rows[0];
      const qty = Math.max(1, +it.qty || 1);
      if (!p || p.stock < qty) throw new Error(`${p ? p.name : 'Item'} is out of stock`);
      await c.query('UPDATE products SET stock=stock-$1 WHERE id=$2', [qty, p.id]);
      total += p.price * qty; lines.push([p, qty, it.size]);
    }
    const o = (await c.query(`INSERT INTO orders(user_id,name,phone,address,payment_method,total) VALUES($1,$2,$3,$4,'COD',$5) RETURNING id`, [req.user.id, name, phone, address, total])).rows[0];
    for (const [p, qty, size] of lines)
      await c.query('INSERT INTO order_items(order_id,product_id,name,price,qty,size) VALUES($1,$2,$3,$4,$5,$6)', [o.id, p.id, p.name, p.price, qty, size || '']);
    await c.query('COMMIT'); res.json({ id: o.id, total });
  } catch (e) { await c.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { c.release(); }
}));
const withItems = `SELECT o.*, COALESCE((SELECT json_agg(i) FROM order_items i WHERE i.order_id=o.id),'[]') AS items FROM orders o`;
app.get('/api/orders/mine', auth, wrap(async (req, res) => {
  res.json((await q(`${withItems} WHERE o.user_id=$1 ORDER BY o.id DESC`, [req.user.id])).rows);
}));
app.get('/api/admin/orders', auth, admin, wrap(async (req, res) => {
  res.json((await q(`${withItems} ORDER BY o.id DESC`)).rows);
}));
app.put('/api/admin/orders/:id', auth, admin, wrap(async (req, res) => {
  await q('UPDATE orders SET status=$1 WHERE id=$2', [req.body.status, req.params.id]); res.json({ ok: true });
}));
app.delete('/api/admin/orders/:id', auth, admin, wrap(async (req, res) => {
  await q('DELETE FROM orders WHERE id=$1', [req.params.id]); res.json({ ok: true });
}));
app.get('/api/admin/stats', auth, admin, wrap(async (req, res) => {
  const r = await q(`SELECT (SELECT count(*) FROM products) products, (SELECT count(*) FROM orders) orders, (SELECT count(*) FROM users) users, (SELECT COALESCE(sum(total),0) FROM orders WHERE status<>'Cancelled') revenue`);
  res.json(r.rows[0]);
}));

const port = process.env.PORT || 3000;
init().then(() => app.listen(port, () => console.log('OG CULTURE running on :' + port)))
  .catch(e => { console.error('DB init failed:', e.message); process.exit(1); });
