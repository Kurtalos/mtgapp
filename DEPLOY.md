# Deploying Mana Table on a VPS

## How big does the VPS need to be?

Small. Genuinely small.

The server does one job: send HTML and a bit of JSON to five phones. There is
no database on the box — Supabase holds the rooms and does all the realtime
fan-out, so the traffic that would normally be the expensive part never touches
your server at all.

| | Spec | Notes |
| --- | --- | --- |
| **Minimum** (build elsewhere, just run) | 1 vCPU · 512 MB RAM · 10 GB disk | Roughly 100 MB resident in practice |
| **Recommended** (build *and* run on the box) | **1 vCPU · 2 GB RAM · 20 GB disk** | `next build` is the memory-hungry part |
| **Comfortable** (room for other projects) | 2 vCPU · 4 GB RAM · 40 GB disk | |

**The one thing that will bite you:** `npm run build` peaks around 0.8–1.2 GB of
RAM. On a 1 GB box it will often get OOM-killed mid-build, which looks like a
mysterious failure. Either give the box 2 GB, add swap, or build in Docker
elsewhere and only run the image on the VPS.

Adding 2 GB of swap costs nothing and removes the problem entirely:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Any US$5 tier works — Hetzner CX22, DigitalOcean's basic droplet, Vultr, or a
Lightsail instance. Ubuntu 24.04 LTS is a safe default.

**Bandwidth** is a non-issue: a full five-player game is a few hundred kilobytes
of JSON in total.

> Worth knowing: because everything this app needs is either static or on
> Supabase, a free tier on Vercel, Fly.io or Render will also host it for $0.
> A VPS makes sense if you want a box you control, a custom domain, or somewhere
> to put other projects alongside it.

---

## Option A — Docker + Caddy (recommended)

Caddy gets you automatic HTTPS with a two-line config.

### 1. Point a domain at the box

An `A` record for `mtg.example.com` → your VPS IP. Let DNS settle before
starting Caddy, or certificate issuance will fail.

### 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # log out and back in
```

### 3. Get the code

```bash
git clone https://github.com/Kurtalos/mtgapp.git
cd mtgapp
```

### 4. Configure

```bash
cp .env.example .env
nano .env        # NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

These two values are compiled into the browser bundle. **Changing them requires
a rebuild**, not just a restart — that is why they are passed as build args.

### 5. Build and start

```bash
docker compose up -d --build
docker compose logs -f
```

The app listens on `127.0.0.1:3000`.

### 6. Put Caddy in front

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```
mtg.example.com {
    encode gzip zstd
    reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo systemctl reload caddy
```

Caddy fetches a certificate the moment the domain resolves. Done — the table is
live at `https://mtg.example.com`.

**Updating later:**

```bash
cd mtgapp && git pull
docker compose up -d --build
```

---

## Option B — Node + systemd, no Docker

Useful if you would rather not run containers on a small box.

```bash
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx

git clone https://github.com/Kurtalos/mtgapp.git /opt/mtgapp
cd /opt/mtgapp
npm ci
cp .env.example .env.local && nano .env.local   # add your Supabase keys
npm run build
```

`/etc/systemd/system/mana-table.service`:

```ini
[Unit]
Description=Mana Table
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/mtgapp
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node /opt/mtgapp/.next/standalone/server.js
Restart=always
RestartSec=3
MemoryMax=512M

[Install]
WantedBy=multi-user.target
```

The standalone build needs two things copied next to it, otherwise you get a
page with no CSS and no images:

```bash
cp -r /opt/mtgapp/public /opt/mtgapp/.next/standalone/public
cp -r /opt/mtgapp/.next/static /opt/mtgapp/.next/standalone/.next/static
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mana-table
```

Then proxy it with nginx (`/etc/nginx/sites-available/mana-table`):

```nginx
server {
    listen 80;
    server_name mtg.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/mana-table /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d mtg.example.com
```

---

## Making sure it actually works

1. Open the site. The badge under the join box should read **Cloud rooms**.
   If it says **Local rooms**, the Supabase values were empty at build time.
2. Create a table and join it from your phone on mobile data. If the phone
   stays on the lobby screen, the WebSocket never connected — check that the
   `rooms` table exists and is in the `supabase_realtime` publication
   (`supabase/schema.sql` handles both).
3. Move a life total on the phone and watch the laptop update.

## Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

Do **not** expose port 3000 publicly. In the compose file it is already bound to
`127.0.0.1` for that reason.

## Backups

Nothing to back up on the VPS — it is stateless. Your game data lives in
Supabase, which has its own backups. Worst case, a rebuild is `git pull` plus
`docker compose up -d --build`.
