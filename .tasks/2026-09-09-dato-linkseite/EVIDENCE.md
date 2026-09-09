# EVIDENCE: dato-Linkseite

## Auslieferung statischer Seiten der Hauptdomain
- /home/naniadm/Documents/Website ist ein Symlink auf /home/nathanael/repos/Website (realpath bestaetigt).
- Neuer Code kommt ohne separaten Clone in den Checkout, das Repo selbst ist die Ausliefer-Quelle: Merge/Pull auf main im Repo /home/nathanael/repos/Website genuegt.
- Startseite (@home): /etc/caddy/Caddyfile:366 root auf /home/naniadm/Documents/Website/deco-elevator-new.
- /new/* Assets: /etc/caddy/Caddyfile:357 handle_path mit root deco-elevator-new.
- /faq-Muster (Vorlage fuer neue statische Route): /etc/caddy/Caddyfile:394 @faq_bare, redir, handle_path /faq/*.
- /docs-Muster: /etc/caddy/Caddyfile:384 redir + handle_path mit try_files.
- /brand/* Marken-Paket wird ausgeliefert: /etc/caddy/Caddyfile:725 handle_path /brand/* root Website/dl-brand (Fonts same-origin nutzbar).

## caddy-config Repo und Live-Abgleich
- Repo: /home/nathanael/repos/Caddy (git remote origin git@github.com:EarlySalty/caddy-config.git).
- Zwei Hosts, DDC-Domain laeuft auf v50671: /home/nathanael/repos/Caddy/CLAUDE.md Tabelle (config hosts/v50671/Caddyfile).
- hosts/v50671/Caddyfile ist byte-identisch mit /etc/caddy/Caddyfile (diff -q IDENTISCH, beide 45575 Bytes).
- conf/Caddyfile ist der ALTE IONOS-Host, nicht die DDC-Domain (CLAUDE.md).
- Reload neu: sudo systemctl reload caddy (nativer caddy.service).

## Marken-Baukasten (wiederverwenden statt erfinden)
- Farben/Fonts: /home/nathanael/repos/Website/dl-brand/tokens.css:44 :root --ink #0b0b0b, --gold #c8a86b, --gold-bright #efd49d, --gold-dark #806534, --gold-border rgba(201,168,106,0.42), --bone #f2eee6.
- Fonts: Sora (display) und Manrope (body), tokens.css @font-face src /brand/fonts/*.woff2.
- Schatten/Kanten: tokens.css --shadow-card, --line, --line-strong fuer erhabene Karten.

## CSP fuer /dato
- Standard-CSP @non_demo_embed: /etc/caddy/Caddyfile:199 default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.discordapp.com; font-src 'self' data:.
- /dato ist NICHT in den Ausnahmelisten (@non_demo_embed schliesst nur Embed-/Dashboard-Pfade aus) -> Standard-CSP greift, alles self genuegt, keine Ausnahme noetig.
