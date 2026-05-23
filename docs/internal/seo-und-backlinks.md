# SEO und Backlinks

Die SEO- und Backlink-Logik dieses Repos ist zweigeteilt: technisch saubere Auffindbarkeit über Sitemap und IndexNow einerseits, kontrollierte Owned-Property-Verlinkung andererseits. Beides ist bereits im Repo abgebildet und sollte zusammen gedacht werden.

## SEO-Submission-Flow

Der vorgesehene Grundablauf nach einem Deploy ist:

1. Sitemap mit aktuellen `lastmod`-Werten bauen
2. Frontends normal builden und deployen
3. danach den SEO-Submit ausführen

IndexNow ist bereits vorbereitet. Dafür liegt eine Verifikationsdatei im Public-Bereich der Landing und wird beim Build mit ausgeliefert. Das beschleunigt vor allem Bing-nahe Indexierung. Google wird dadurch nicht aktiv gepingt; dort bleibt die Search Console plus Sitemap der relevante Kanal.

## Einmalige externe Einrichtung

Die Repo-Doku beschreibt zwei Kernplattformen:

- Google Search Console für die Domain-Verifikation und Sitemap-Einreichung
- Bing Webmaster Tools, idealerweise via Import aus der Search Console

Das operative Ziel ist simpel: Die Domain soll als Ganzes verifiziert sein, nicht nur ein einzelner URL-Präfix. Danach reicht es im Alltag meist, Sitemap und IndexNow sauber nachzuführen.

## Backlinks aus Owned Properties

Backlinks werden bewusst nicht über fremde Spam-Listings erzwungen, sondern über eigene oder kontrollierte Properties:

- GitHub-READMEs
- Discord-Serverbeschreibung
- Twitch-About/Panels
- Steam-Community-Group

Für GitHub existiert ein Script, das Marker-Blöcke in READMEs idempotent pflegt. Für Discord, Twitch und Steam gibt es Generatoren, die pastefertige Textblöcke ausgeben. Das ist absichtlich halbautomatisch: Die Plattformen haben unterschiedliche Limits und Editorverhalten, daher ist ein reiner Blind-Push dort nicht sinnvoll.

## Was bewusst nicht gemacht wird

Das Runbook grenzt sich klar von Listing-Spam ab. Nicht vorgesehen sind etwa:

- fremde Bot-/Server-Listing-Spams
- Forum- oder Reddit-Autoposts
- aggressive Linkfarmen

Die Linie ist sinnvoll: Der SEO-Gewinn solcher Einträge ist meist klein, das Moderations- oder TOS-Risiko dagegen unnötig hoch.

## Operative Regeln

- Nach jedem strukturellen Landing-Deploy Sitemap und Submit neu ausführen.
- Wenn sich Invite-Code oder Haupt-URL ändern, müssen die Backlink-Skripte mitgezogen werden.
- Neue Hauptseiten oder neue Repos gehören in die Skript-Konfiguration, nicht nur manuell irgendwohin.
- GitHub-README-Updates sind idempotent und sollen Marker-Blöcke, nicht freien Text, pflegen.

## Wirkung realistisch einschätzen

Die vorhandenen Maßnahmen sind keine Wunderwaffe, aber solide Basisarbeit:

- Sitemaps und Search Console sorgen dafür, dass neue Seiten sauber crawlbar bleiben.
- IndexNow beschleunigt schnelle Reaktionen bei kompatiblen Suchmaschinen.
- GitHub-READMEs liefern starke, glaubwürdige Links.
- Twitch- und Discord-Flächen bringen eher qualifizierten Traffic als rohen SEO-Boost.

Die wichtigste Regel lautet daher: erst saubere Seitenstruktur und Deployment, dann SEO-Automation. Backlinks helfen, aber nur wenn die ausgerollten Seiten selbst stabil, schnell und indexierbar sind.
