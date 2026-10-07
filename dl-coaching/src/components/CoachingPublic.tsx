export function CoachingHero() {
  return (
    <section className="world-hero world-small-hero">
      <picture className="world-picture">
        <source type="image/avif" srcSet="/brand/world/alley-960.avif 960w, /brand/world/alley-1920.avif 1920w" sizes="100vw" />
        <img src="/brand/world/alley-1920.webp" srcSet="/brand/world/alley-960.webp 960w, /brand/world/alley-1920.webp 1920w" sizes="100vw" alt="Schnauzbärtiger Held in einer warm beleuchteten Industriegasse" width="1920" height="1080" fetchPriority="high" />
      </picture>
      <div className="world-wrap"><div className="world-copy">
        <h1>Deadlock<br />Coaching<br />auf Deutsch.</h1>
        <p>Finde einen deutschsprachigen Deadlock Coach. Gemeinsam auf deine Matches schauen, Fragen klären und gezielt üben. Das Community-Coaching ist kostenlos.</p>
        <div className="world-actions"><a href="/coaching/anfrage" className="world-button">Coaching anfragen</a><a href="#coaches" className="world-button world-button--outline">Coaches ansehen</a></div>
      </div></div>
    </section>
  )
}

export function PublicCoachingPage() {
  return (
    <div className="coaching-world">
      <header className="world-header"><a className="brand" href="/" aria-label="Deutsche Deadlock Community"><img src="/brand/logo/logo-192.png" className="brand-logo" alt="" width="54" height="54" /><img src="/brand/logo/wordmark.svg" className="brand-wordmark-img" alt="" width="220" height="48" /></a><nav className="world-nav" aria-label="Community-Wege"><a href="/mitspieler/">Mitspieler</a><a href="/patch/">Patch-Verlauf</a><a className="world-button" href="/beitreten/">Beitreten</a></nav></header>
      <main><CoachingHero /><section id="coaches" className="world-paper"><div className="world-wrap world-editorial"><h2>Dein nächster Schritt.</h2><div><p>Nenne dein Lernziel, deine Helden und passende Zeiten in der <a href="/coaching/anfrage">Coaching-Anfrage</a>. Ein Coach kann sich bei dir melden und einen Termin abstimmen.</p><p>Die aktuelle Coachliste wird mit JavaScript geladen. Du kannst auch auf unserem <a href="/beitreten/">Discord</a> nach Coaching fragen.</p></div></div></section></main>
      <footer className="world-footer"><nav aria-label="Footer-Navigation"><a href="/">Start</a><a href="/mitspieler/">Mitspieler</a><a href="/patch/">Patch-Verlauf</a><a href="/twitch/impressum">Impressum</a><a href="/twitch/datenschutz">Datenschutz</a></nav><p className="world-footer-note">Inoffizielles Community-Projekt. Nicht mit Valve verbunden. Deadlock und die Spielbilder gehören Valve.</p></footer>
    </div>
  )
}
