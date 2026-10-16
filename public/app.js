const app=document.getElementById('app');
const S={token:localStorage.token||'',user:JSON.parse(localStorage.user||'null'),cart:JSON.parse(localStorage.cart||'[]')};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inr=n=>'₹'+Number(n).toLocaleString('en-IN');
const FALL="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500'><rect fill='%2316161a' width='400' height='500'/><text x='50%' y='50%' fill='%23c6ff3d' font-size='28' text-anchor='middle'>OG</text></svg>";
const img=(s,a='')=>`<img ${a} src="${esc(s||FALL)}" onerror="this.onerror=null;this.src=FALL" alt="">`;
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.className='show';setTimeout(()=>t.className='',2500)}
async function api(p,o={}){
  const r=await fetch('/api'+p,{method:o.method||'GET',headers:{'Content-Type':'application/json',...(S.token?{Authorization:'Bearer '+S.token}:{})},body:o.body?JSON.stringify(o.body):undefined});
  const d=await r.json().catch(()=>({}));
  if(r.status===401&&S.token){logout(true)}
  if(!r.ok)throw new Error(d.error||'Something went wrong');return d;
}
function persist(){localStorage.cart=JSON.stringify(S.cart);S.token?(localStorage.token=S.token,localStorage.user=JSON.stringify(S.user)):(localStorage.removeItem('token'),localStorage.removeItem('user'));nav()}
function logout(q){S.token='';S.user=null;persist();if(!q)toast('Logged out');location.hash='#/login'}
function nav(){
  const n=S.cart.reduce((a,i)=>a+i.qty,0);
  document.getElementById('nav').innerHTML=`<a href="#/shop">Shop</a>
  ${S.user?.role==='admin'?'<a href="#/admin">Admin</a>':''}
  ${S.user?`<a href="#/orders">Orders</a><button onclick="logout()">Logout (${esc(S.user.name.split(' ')[0])})</button>`:'<a href="#/login">Login</a>'}
  <a href="#/cart">Bag (${n})</a>`;
}
const cats=['Tees','Hoodies','Bottoms','Outerwear','Accessories'];
const card=p=>`<a class="card" href="#/product/${p.id}"><div class="im">${img(p.image)}</div><div class="in"><div class="tag">${esc(p.category)}</div><div>${esc(p.name)}</div><div class="price">${inr(p.price)}</div>${p.stock<1?'<span class="pill">Sold out</span>':''}</div></a>`;

const V={
async home(){
  const ps=(await api('/products')).slice(0,4);
  app.innerHTML=`<section class="hero"><h1>WEAR THE<br><em>ORIGINAL.</em></h1><p>Streetwear built for the ones who set the trend. Cash on delivery available everywhere.</p><a class="btn" href="#/shop">Shop the drop →</a></section>
  <div class="marquee"><div>${'NEW DROP • COD AVAILABLE • OG CULTURE • FREE VIBES • '.repeat(8)}</div></div>
  <h2>Fresh drops</h2><div class="grid">${ps.map(card).join('')}</div>`;
},
async shop(a){
  const c=a[0]||'';const ps=await api('/products'+(c?'?category='+encodeURIComponent(c):''));
  app.innerHTML=`<h2>Shop</h2><div class="chips"><a class="chip ${c?'':'on'}" href="#/shop">All</a>${cats.map(x=>`<a class="chip ${c===x?'on':''}" href="#/shop/${x}">${x}</a>`).join('')}</div>
  <div class="grid">${ps.map(card).join('')||'<p>Nothing here yet.</p>'}</div>`;
},
async product([id]){
  const p=await api('/products/'+id);const sz=p.sizes.split(',').map(s=>s.trim()).filter(Boolean);
  app.innerHTML=`<div class="split">${img(p.image)}<div><div class="tag">${esc(p.category)}</div><h2>${esc(p.name)}</h2><p class="price" style="font-size:1.6rem">${inr(p.price)}</p><p style="color:var(--mut);margin:14px 0">${esc(p.description)}</p>
  <label>Size</label><select id="sz">${sz.map(s=>`<option>${esc(s)}</option>`).join('')}</select>
  ${p.stock>0?`<button class="btn" onclick="addCart(${p.id})">Add to bag</button><p style="color:var(--mut);margin-top:10px">Pay by cash on delivery</p>`:'<span class="pill">Sold out</span>'}</div></div>`;
  window._p=p;
},
cart(){
  if(!S.cart.length){app.innerHTML='<h2>Your bag is empty</h2><a class="btn" href="#/shop">Go shopping</a>';return}
  const t=S.cart.reduce((a,i)=>a+i.price*i.qty,0);
  app.innerHTML=`<h2>Your bag</h2>${S.cart.map((i,x)=>`<div class="row">${img(i.image)}<div class="g">${esc(i.name)}<br><small>Size ${esc(i.size)} · ${inr(i.price)}</small></div><button class="btn sm ghost" onclick="qty(${x},-1)">−</button>${i.qty}<button class="btn sm ghost" onclick="qty(${x},1)">+</button><button class="btn sm red" onclick="qty(${x},-99)">✕</button></div>`).join('')}
  <h2>Total: ${inr(t)}</h2><a class="btn" href="#/checkout">Checkout</a>`;
},
checkout(){
  if(!S.user){toast('Log in to checkout');location.hash='#/login';return}
  if(!S.cart.length){location.hash='#/cart';return}
  const t=S.cart.reduce((a,i)=>a+i.price*i.qty,0);
  app.innerHTML=`<div class="box"><h2>Checkout</h2><label>Full name</label><input id="n" value="${esc(S.user.name)}"><label>Phone</label><input id="ph"><label>Delivery address</label><textarea id="ad" rows="3"></textarea>
  <label>Payment</label><div class="cod"><label style="color:var(--fg)"><input type="radio" checked style="width:auto;margin-right:8px">Cash on Delivery (COD)</label></div>
  <button class="btn" onclick="placeOrder()">Place order · ${inr(t)}</button></div>`;
},
login(a){
  const up=a[0]==='signup';
  app.innerHTML=`<div class="box"><h2>${up?'Join OG':'Welcome back'}</h2>${up?'<label>Name</label><input id="nm">':''}<label>Email</label><input id="em" type="email"><label>Password</label><input id="pw" type="password">
  <button class="btn" onclick="auth(${up})">${up?'Sign up':'Login'}</button><p style="margin-top:16px;color:var(--mut)">${up?'Have an account? <a href="#/login" style="color:var(--lime)">Login</a>':'New here? <a href="#/login/signup" style="color:var(--lime)">Sign up</a>'}</p></div>`;
},
async orders(){
  if(!S.user){location.hash='#/login';return}
  const os=await api('/orders/mine');
  app.innerHTML=`<h2>My orders</h2>${os.map(o=>`<div class="row"><div class="g"><b>#${o.id}</b> <span class="pill">${esc(o.status)}</span> <span class="pill">${esc(o.payment_method)}</span><br>${o.items.map(i=>`${esc(i.name)} (${esc(i.size)}) ×${i.qty}`).join(', ')}</div><b class="price">${inr(o.total)}</b></div>`).join('')||'<p>No orders yet.</p>'}`;
},
async admin(a){
  if(S.user?.role!=='admin'){app.innerHTML='<h2>Admins only</h2>';return}
  const tab=a[0]||'products';const st=await api('/admin/stats');
  let body='';
  if(tab==='products'){
    const ps=await api('/products');window._ps=ps;
    body=`<div class="box" style="max-width:none;margin:0 0 20px"><h3 id="ft">Add product</h3><input type="hidden" id="pid">
    <div class="split" style="gap:16px"><div><label>Name</label><input id="pn"><label>Price (₹)</label><input id="pp" type="number"><label>Category</label><select id="pc">${cats.map(c=>`<option>${c}</option>`).join('')}</select><label>Stock</label><input id="ps" type="number" value="50"></div>
    <div><label>Image URL</label><input id="pi" placeholder="https://..."><label>Sizes (comma separated)</label><input id="pz" value="S,M,L,XL"><label>Description</label><textarea id="pd" rows="4"></textarea></div></div>
    <button class="btn" onclick="saveProd()">Save product</button> <button class="btn ghost" onclick="clearForm()">Clear</button></div>
    <div class="scroll"><table><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr>${ps.map(p=>`<tr><td>${img(p.image,'style="width:44px;height:44px;object-fit:cover;border-radius:8px"')}</td><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td>${inr(p.price)}</td><td>${p.stock}</td><td><button class="btn sm" onclick="editProd(${p.id})">Edit</button> <button class="btn sm red" onclick="delProd(${p.id})">Delete</button></td></tr>`).join('')}</table></div>`;
  }else{
    const os=await api('/admin/orders');
    body=`<div class="scroll"><table><tr><th>#</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr>${os.map(o=>`<tr><td>${o.id}</td><td>${esc(o.name)}<br>${esc(o.phone)}<br><small>${esc(o.address)}</small></td><td>${o.items.map(i=>`${esc(i.name)} (${esc(i.size)}) ×${i.qty}`).join('<br>')}<br><span class="pill">${esc(o.payment_method)}</span></td><td>${inr(o.total)}</td>
    <td><select onchange="setStatus(${o.id},this.value)" style="width:auto">${['Pending','Shipped','Delivered','Cancelled'].map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select></td><td><button class="btn sm red" onclick="delOrder(${o.id})">Delete</button></td></tr>`).join('')}</table></div>`;
  }
  app.innerHTML=`<h2>Admin dashboard</h2><div class="stats"><div class="stat">Products<b>${st.products}</b></div><div class="stat">Orders<b>${st.orders}</b></div><div class="stat">Users<b>${st.users}</b></div><div class="stat">Revenue<b>${inr(st.revenue)}</b></div></div>
  <div class="chips"><a class="chip ${tab==='products'?'on':''}" href="#/admin/products">Products</a><a class="chip ${tab==='orders'?'on':''}" href="#/admin/orders">Orders</a></div>${body}`;
}};

// actions
const run=async f=>{try{await f()}catch(e){toast(e.message)}};
window.addCart=id=>{const p=window._p,size=document.getElementById('sz').value;const i=S.cart.find(c=>c.id===p.id&&c.size===size);i?i.qty++:S.cart.push({id:p.id,name:p.name,price:+p.price,image:p.image,size,qty:1});persist();toast('Added to bag 🔥')};
window.qty=(x,d)=>{S.cart[x].qty+=d;if(S.cart[x].qty<1)S.cart.splice(x,1);persist();V.cart()};
window.auth=up=>run(async()=>{const d=await api(up?'/signup':'/login',{method:'POST',body:{name:document.getElementById('nm')?.value,email:document.getElementById('em').value,password:document.getElementById('pw').value}});S.token=d.token;S.user=d.user;persist();toast('Welcome '+d.user.name);location.hash=S.cart.length?'#/checkout':'#/'});
window.placeOrder=()=>run(async()=>{const d=await api('/orders',{method:'POST',body:{items:S.cart.map(i=>({id:i.id,qty:i.qty,size:i.size})),name:n.value,phone:ph.value,address:ad.value}});S.cart=[];persist();app.innerHTML=`<div class="box"><h2>Order placed 🎉</h2><p>Order #${d.id}. Pay ${inr(d.total)} in cash when it arrives.</p><br><a class="btn" href="#/orders">View orders</a></div>`});
window.logout=logout;
window.clearForm=()=>{['pid','pn','pp','pi','pd'].forEach(i=>document.getElementById(i).value='');document.getElementById('ps').value=50;document.getElementById('pz').value='S,M,L,XL';document.getElementById('ft').textContent='Add product'};
window.editProd=id=>{const p=window._ps.find(x=>x.id===id);pid.value=p.id;pn.value=p.name;pp.value=p.price;pc.value=p.category;ps.value=p.stock;pi.value=p.image;pz.value=p.sizes;pd.value=p.description;ft.textContent='Edit product #'+id;scrollTo({top:0,behavior:'smooth'})};
window.saveProd=()=>run(async()=>{const b={name:pn.value,price:pp.value,category:pc.value,stock:ps.value,image:pi.value,sizes:pz.value,description:pd.value};if(!b.name||!b.price)throw new Error('Name and price required');await api(pid.value?'/products/'+pid.value:'/products',{method:pid.value?'PUT':'POST',body:b});toast('Saved');route()});
window.delProd=id=>confirm('Delete this product?')&&run(async()=>{await api('/products/'+id,{method:'DELETE'});toast('Deleted');route()});
window.setStatus=(id,status)=>run(async()=>{await api('/admin/orders/'+id,{method:'PUT',body:{status}});toast('Status updated')});
window.delOrder=id=>confirm('Delete this order?')&&run(async()=>{await api('/admin/orders/'+id,{method:'DELETE'});route()});

async function route(){
  const [v,...a]=(location.hash.slice(2)||'home').split('/');
  window.scrollTo(0,0);
  try{await (V[v]||V.home)(a.map(decodeURIComponent))}catch(e){app.innerHTML='<h2>'+esc(e.message)+'</h2>'}
}
addEventListener('hashchange',route);nav();route();
