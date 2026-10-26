# Deploying Mana Table on a VPS

## How big does the VPS need to be?

Small. Genuinely small — and it is now the **only** thing you need to pay for.
The app ships its own backend, so there is no Supabase project, no managed
database, and nothing that can be paused for inactivity while your group is
sitting down to play.

| | Spec | Notes |
| --- | --- | --- |
| **Minimum** (build elsewhere, just run) | 1 vCPU · 512 MB · 10 GB disk | ~100 MB resident in practice |
| **Recommended** (build *and* run on the box) | **1 vCPU · 2 GB RAM · 20 GB disk** | `next build` is the memory-hungry part |
| **Comfortable** (room for other projects) | 2 vCPU · 4 GB · 40 GB | |

**The one thing that will bite you:** `npm run build` peaks around 0.8–1.2 GB of
RAM. On a 1 GB box it often gets OOM-killed mid-build, which looks like a
mysterious failure. Either give the box 2 GB, add swap, or build the image
elsewhere and only run it here.

Adding 2 GB of swap costs nothing and removes the problem entirely:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Where to put it

You are in Perth, so a Perth or Sydney region is ideal. **BinaryLane** has a
Perth datacentre and bills in AUD from about A$5/month. Vultr, DigitalOcean and
Linode all have Sydney regions at roughly USD$5–6/month, and the extra 40 ms of
latency to Sydney is genuinely irrelevant for a life counter. Any of them is
fine — pick whichever dashboard you find least annoying.

Ubuntu 24.04 LTS is a safe default image.

**Bandwidth** is a non-issue: a whole five-player game is a few hundred
kilobytes of JSON, and card art is loaded from Scryfall's CDN, not your server.

---

## Option A — Docker + Caddy (recommended)

Caddy gives you automatic HTTPS with a two-line config.

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

### 4. Build and start

```bash
docker compose up -d --build
docker compose logs -f
```

That is it. **No environment variables are required** — the bundled backend
stores rooms on disk. The compose file mounts a named volume at `/app/.data` so
your tables survive a redeploy.

The app listens on `127.0.0.1:3000`.

### 5. Put Caddy in front

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

Caddy fetches a certificate once the domain resolves. The table is live.

> **One Caddy detail matters here.** `encode gzip` is fine because Caddy does
> not compress `text/event-stream`, so the live-updates stream still flushes
> immediately. If you use nginx instead, the app already sends
> `X-Accel-Buffering: no` to stop it buffering the stream — do not remove
> `proxy_buffering off;` from your nginx config.

**Updating later:**

```bash
cd mtgapp && git pull
docker compose up -d --build
```

---

## Option B — Node + systemd, no Docker

For people who would rather not run containers.

```bash
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx

sudo useradd -r -s /usr/sbin/nologin -d /opt/mtgapp manatable
sudo git clone https://github.com/Kurtalos/mtgapp.git /opt/mtgapp
cd /opt/mtgapp
sudo npm ci
sudo npm run build

# Standalone output needs these two copied next to the server or you get a
# page with no CSS and no images.
sudo cp -r public .next/standalone/public
sudo cp -r .next/static .next/standalone/.next/static

# Where rooms are stored.
sudo mkdir -p /var/lib/mana-table
sudo chown -R manatable:manatable /opt/mtgapp /var/lib/mana-table
```

`/etc/systemd/system/mana-table.service`:

```ini
[Unit]
Description=Mana Table
After=network.target

[Service]
Type=simple
User=manatable
WorkingDirectory=/opt/mtgapp/.next/standalone
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
Environment=DATA_DIR=/var/lib/mana-table
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
MemoryMax=512M

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mana-table
```

nginx (`/etc/nginx/sites-available/mana-table`):

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

        # Required for the live-update stream, or it buffers and the table
        # stops refreshing until the connection closes.
        proxy_buffering off;
        proxy_read_timeout 1h;
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

## How much can one box handle?

Measured rather than guessed. This is the production build, running four
simultaneous eight-player games (32 live connections) with a life total changing
every ~300 ms on every phone — far busier than a real table, where nobody taps
ten times a second:

```
Writes          2080 (96.8/s)
Write latency   p50 8.2ms · p95 24.5ms · max 64.4ms
Server memory   131 MB → 135 MB
Open streams    32, zero errors
```

So the "3 or 4 games with 2–8 players" case uses about **4 MB above idle**. When
your box is up, run the same test against it:

```bash
node scripts/loadtest.mjs --url http://localhost:3000 --rooms 4 --players 8 --pid $(pgrep -f next-server | head -1)
```

Raise `--rooms` until latency starts climbing; that is your real ceiling.

## Admin panel

`https://mtg.example.com/admin` lets you add planes, schemes and role classes.
Set an `ADMIN_TOKEN` in the environment or the panel is open to anyone who finds
the address:

```bash
# docker-compose.yml
environment:
  DATA_DIR: /app/.data
  ADMIN_TOKEN: ${ADMIN_TOKEN}
```

```bash
echo 'ADMIN_TOKEN=something-long' >> .env
docker compose up -d
```

Content is written to `content.json` next to the rooms, so it survives restarts
and is covered by the backup command below.

## Making sure it actually works

1. Open the site. The badge under the join box should read **Self-hosted**.
2. Create a table and join it from your phone on mobile data. If the phone sits
   on the lobby screen forever, the event stream is being blocked — check the
   proxy buffering settings above.
3. Move a life total on the phone and watch the laptop update instantly.
4. Open `/admin`, add a plane, then start a Planechase game and search for it in
   the "Change" picker.

Quick backend check from the box:

```bash
curl -i http://127.0.0.1:3000/api/rt/rooms/ABCDE
# 404 here is correct: the server is up and the room does not exist yet.
```

---

## Backups

Everything is in one directory of small JSON files. Backing up is a tar:

```bash
# Docker
docker run --rm -v manatable_manatable-data:/data -v "$PWD:/backup" alpine \
  tar czf /backup/manatable-$(date +%F).tar.gz -C /data .

# systemd install
sudo tar czf ~/manatable-$(date +%F).tar.gz -C /var/lib/mana-table .
```

Put that in a weekly cron and copy it off the box. Rooms older than seven days
are pruned automatically, so the directory stays tiny.

---

## Two things to know

**Run exactly one instance.** Live updates are fanned out from the memory of the
process that handled the write. Two containers behind a load balancer would each
know about half the connections, and a player would see updates from only some
of the table. One box, one process — which is the whole design.

**Do not expose port 3000 publicly.** It is bound to `127.0.0.1` in the compose
file for that reason. TLS and the public port belong to Caddy.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

---

## Using Supabase instead

Still supported if you already have a project — set `NEXT_PUBLIC_BACKEND=supabase`
plus the two keys in `.env.local`, and run `supabase/schema.sql`. Remember that
Supabase pauses free projects after seven days of low activity, which is a poor
fit for a group that plays a couple of times a month. The bundled backend has no
such rule, which is why it is the default.
