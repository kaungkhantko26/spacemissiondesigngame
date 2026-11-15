# Deploying to your own server (VPS)

The game is a static site: the build output is plain files, so any web server can host it. No Node process runs on the server.

## Deploy (run on the machine that has the `new-vps` SSH alias, e.g. your Mac)
```bash
git pull
./scripts/deploy-vps.sh                      # builds for the domain root, uploads with rsync over ssh new-vps
```
Options: `VPS_HOST=other-alias`, `REMOTE_DIR=/srv/spacemission`, `SITE_PATH=/game` (if served under a sub-path).
It needs `rsync` on both sides, creates `REMOTE_DIR` if missing (default `/var/www/spacemission`), and refuses system folders such as `/var/www` itself.

## Web server (one-time, on the VPS) - nginx example
```nginx
server {
  listen 80;
  server_name example.com;              # your domain or the server IP
  root /var/www/spacemission;
  index index.html;
  location / { try_files $uri $uri/ /404.html; }     # routes are folders (/menu/, /design/ ...)
  location /_next/static/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
  location ~* \.(mp3|glb|webp|png|jpg)$ { add_header Cache-Control "public, max-age=604800"; }
  types { application/javascript mjs; }
}
```
Then `sudo nginx -t && sudo systemctl reload nginx`. Add HTTPS with `sudo certbot --nginx -d example.com` if you have a domain. Audio and the 3D model need no special headers.

## Notes
- Static files only: nothing here stores data on the server; progress is saved in each player's browser.
- Old hashed assets under `_next/static` are kept between deploys so a tab opened before a deploy keeps working.
