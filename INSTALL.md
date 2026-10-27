# Installing Cards with Kurt & Friends on a fresh Ubuntu VPS

This is the from-zero guide: you have an Ubuntu server and nothing else. It
takes about fifteen minutes and every block is copy-paste.

It gets you live on **`https://magic.therobinsonfamily.com.au`**. If you are
installing somewhere else, replace that hostname wherever it appears.

**Before you start:** the server's IP address, root or sudo access, a domain
whose DNS you control, and ports 80/443 reachable from the internet.

---

## 1. Log in

From your own computer:

```bash
ssh root@YOUR_SERVER_IP
```

Everything below runs **on the server**.

## 2. Update and install the basics

```bash
apt update && apt upgrade -y
apt install -y curl git ufw ca-certificates
```

## 3. Add 2 GB of swap — do this even on a 2 GB box

The build needs 0.8–1.2 GB of RAM and gets killed without swap. This makes that
impossible:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h
```

`free -h` should now show **2.0Gi** under Swap. If it does not, stop here and
check the output of the `fallocate` command.

## 4. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
docker --version
docker compose version
```

## 5. Download the app

```bash
git clone https://github.com/Kurtalos/mtgapp.git /opt/mtgapp
cd /opt/mtgapp
```

If this asks for a username and password because the repository is private, you
will need a deploy key or a personal access token — that is a GitHub setting,
not something on the server.

## 6. Set your admin password

`/admin` is where you add planes, schemes and role classes. Protect it:

```bash
cd /opt/mtgapp
echo "ADMIN_TOKEN=$(openssl rand -hex 16)" > .env
cat .env
```

**Copy that token somewhere safe.** You paste it into `/admin` to save content.
Without it set, anyone who finds the page can rewrite your game content.

The `.env` file is read by Docker Compose automatically and is excluded from the
image build, so the token never ends up baked into the container.

## 7. Build and start

```bash
docker compose up -d --build
```

The first build takes 3–8 minutes. Watch it if you are curious:

```bash
docker compose logs -f
```

Then check the state:

```bash
docker compose ps
```

You want `running`, and `healthy` after about 20 seconds.

Confirm the app is answering:

```bash
curl -i http://127.0.0.1:3000/api/rt/rooms/ABCDE
```

**A 404 here is the correct answer.** It means the server is up and that room
does not exist yet. "Connection refused" means the container is not running —
check `docker compose logs --tail=50`.

## 8. Open the firewall

```bash
ufw allow OpenSSH
ufw allow 80,443/tcp
ufw --force enable
ufw status
```

Do this **before** Caddy starts, or certificate issuance fails and Caddy backs
off for several minutes.

## 9. Point the domain at the box

In your DNS provider, an `A` record:

| Type | Name | Value |
| --- | --- | --- |
| A | `magic` | your server's IP |

Then check it has propagated, from the server:

```bash
dig +short magic.therobinsonfamily.com.au
```

Do not continue until this prints your server's IP.

> **On Cloudflare?** Set the record to **DNS only** (grey cloud) while you set
> this up, otherwise `dig` returns Cloudflare addresses rather than yours. Once
> HTTPS is working you can turn the proxy back on, but then set **SSL/TLS →
> Full (strict)** — "Flexible" gives you an endless redirect loop.

## 10. Put HTTPS in front

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

```bash
cat > /etc/caddy/Caddyfile <<'CADDY'
magic.therobinsonfamily.com.au {
    encode gzip zstd
    reverse_proxy 127.0.0.1:3000
}
CADDY
systemctl reload caddy
```

Watch it fetch the certificate:

```bash
journalctl -u caddy -f
```

Look for `certificate obtained successfully`. Then, from your own computer:

```bash
curl -I https://magic.therobinsonfamily.com.au
```

Expect `HTTP/2 200`. A TLS error usually just means it has not finished the
first attempt — wait thirty seconds and retry.

> **Why `encode gzip` is safe here:** Caddy does not compress
> `text/event-stream`, so the live-update stream still flushes immediately. If
> you swap in nginx instead, it *will* buffer that stream and the table stops
> refreshing until the connection closes — you need `proxy_buffering off;`.

## 11. Test it from your phone

1. Open `https://magic.therobinsonfamily.com.au`. The badge under the join box
   should read **Self-hosted**.
2. Create a table and read the code out.
3. Join from your phone **on mobile data**, not your home wifi — that is what
   proves it works when you are out.
4. Change a life total on the phone; the laptop should update within a second.
5. Open `/admin`, paste your token, add a plane. Then start a Planechase game
   and search for it under "Change".

If a phone sits on the lobby screen forever, the live-update stream is being
blocked somewhere between the phone and the app.

---

## Day to day

**Update after changes land:**

```bash
cd /opt/mtgapp && git pull && docker compose up -d --build
```

Games in progress survive a rebuild — rooms live in a Docker volume, not in the
container.

**Check it is healthy:**

```bash
docker compose ps
docker compose logs --tail=50
```

**Change the admin password:**

```bash
cd /opt/mtgapp
sed -i "s/^ADMIN_TOKEN=.*/ADMIN_TOKEN=$(openssl rand -hex 16)/" .env
cat .env
docker compose up -d
```

**Back up** — the only irreplaceable file is `content.json`, your admin
additions. Rooms are transient and are pruned after seven days anyway:

```bash
cd /opt/mtgapp
docker compose exec -T app tar czf - -C /app .data > ~/cards-with-kurt-$(date +%F).tar.gz
```

Put that in a weekly cron and copy it off the box.

---

## When something goes wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| Build `Killed` / exit code 137 | No swap | Step 3, confirm with `free -h` |
| `COPY failed: ... /app/public` | Running an old checkout | `git pull`, then rebuild |
| `docker compose: command not found` | Old Docker | `apt install -y docker-compose-plugin` |
| Caddy issues no certificate | DNS not ready, or port 80 blocked | `dig +short <domain>`, `ufw status` |
| Browser shows too many redirects | Cloudflare SSL mode is "Flexible" | Set it to "Full (strict)" |
| Phone stuck on the lobby screen | Something is buffering the event stream | Remove gzip on `text/event-stream`; nginx needs `proxy_buffering off` |
| Rooms vanish after a redeploy | Volume not mounted | `docker compose config` should show `/app/.data` |
| `/admin` says the token is wrong | `.env` changed without recreating the container | `docker compose up -d` |

Full health check in one go:

```bash
docker compose ps
curl -i http://127.0.0.1:3000/api/rt/rooms/ABCDE   # 404 = healthy
systemctl status caddy --no-pager
dig +short magic.therobinsonfamily.com.au           # should be your IP
```

---

## What this box can handle

Measured, not guessed: four simultaneous eight-player games — **32 live
connections**, a life total changing four times a second — run in **about 135
MB of RAM** with a p50 write latency of 8 ms.

That is four times the intended load, using roughly 4 MB more than idle. A
1 vCPU / 1 GB box is plenty to *run* it; the 2 GB recommendation is entirely
about surviving `npm run build`.

To check your own box once it is live:

```bash
docker compose exec app node -e "console.log('up')"   # container is responsive
node scripts/loadtest.mjs --url http://localhost:3000 --rooms 4 --players 8
```

The load test needs Node on the host; `apt install -y nodejs` is fine for this
alone, or run it from your laptop against the public URL.

---

## A note on what is protected

- **HTTPS** covers the admin token and all game traffic in transit.
- **The admin token** protects `/admin` from anyone who finds it. Treat it like
  a password.
- **Kingdom roles** are hidden by the interface, not encrypted. A determined
  player with developer tools could read the role list from the network. For a
  group of friends around a table that is the right trade — the realistic risk
  is a glance over a shoulder, not packet inspection. Every role is revealed
  when the game ends, and the host can reveal them early.
- **Port 3000** is bound to `127.0.0.1` and should stay that way. TLS and the
  public port belong to Caddy.

Run exactly **one** instance of the app. Live updates are fanned out from the
memory of the process that handled the write, so two containers behind a load
balancer would each know about half the connections and players would see
updates from only part of the table.
