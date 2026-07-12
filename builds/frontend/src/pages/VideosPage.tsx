import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiBase } from '@/api/base'
import { useAuth } from '@/context/AuthContext'
import '@/styles/ddl.css'

const api = `${apiBase}/videos`

type Video = { id: number; yt_video_id: string; title: string; description: string; thumbnail_url: string; published_at: string; status?: string }
type Taxonomy = { id: number; dimension: 'type' | 'hero' | 'level'; name: string; slug: string }
type Playlist = { id: string; owner_discord_id: number; title: string; description: string; featured: boolean; source: 'manual' | 'yt'; yt_playlist_id?: string; videos?: Video[] }
type Channel = { id: number; youtube_channel_id: string; youtube_url: string; title: string; active: boolean }
type PlaylistDraft = { id?: string; title: string; description: string; source: 'manual' | 'yt'; ytPlaylist: string; videoIds: number[]; featured: boolean }

const emptyPlaylist: PlaylistDraft = { title: '', description: '', source: 'manual', ytPlaylist: '', videoIds: [], featured: false }

const dimensionLabels: Record<Taxonomy['dimension'], string> = { type: 'Typ', hero: 'Held', level: 'Level' }
const dimensionFilterLabels: Record<Taxonomy['dimension'], string> = { type: 'Alle Typen', hero: 'Alle Helden', level: 'Alle Level' }
const statusLabels: Record<string, string> = { pending: 'Wartet auf Freigabe', live: 'Öffentlich', hidden: 'Versteckt' }

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) throw new Error(String(response.status))
  return response.json()
}

async function sendJson<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) throw new Error(String(response.status))
  return response.json()
}

function playlistId(value: string) {
  try {
    return new URL(value).searchParams.get('list') || value.trim()
  } catch {
    return value.trim()
  }
}

function Corners() {
  return <i className="c" aria-hidden />
}

function Divider() {
  return (
    <div className="ddl-divider" aria-hidden>
      <span />
    </div>
  )
}

function VideoCard({ video }: { video: Video }) {
  const [active, setActive] = useState(false)
  return (
    <article className="ddl-card">
      <div className="thumb">
        {active ? (
          <iframe src={`https://www.youtube-nocookie.com/embed/${video.yt_video_id}?autoplay=1`} title={video.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        ) : (
          <button className="ddl-play" onClick={() => setActive(true)} aria-label="Video abspielen">
            <img src={video.thumbnail_url || `https://i.ytimg.com/vi/${video.yt_video_id}/hqdefault.jpg`} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <span className="ring"><span>▶</span></span>
          </button>
        )}
      </div>
      <div className="meta">
        <p className="date">{new Date(video.published_at).toLocaleDateString('de-DE')}</p>
        <h2 className="title">{video.title}</h2>
        <p className="desc">{video.description}</p>
      </div>
    </article>
  )
}

function VideoTagEditor({ videoId, taxonomy, onNotice }: { videoId: number; taxonomy: Taxonomy[]; onNotice: (message: string) => void }) {
  const [selected, setSelected] = useState<number[]>([])
  const [freeTags, setFreeTags] = useState('')
  const toggle = (id: number) => setSelected(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id])
  const save = async () => {
    try {
      await sendJson(`${api}/${videoId}/tags`, 'PUT', { taxonomy_ids: selected, free_tags: freeTags.split(',').map(tag => tag.trim()).filter(Boolean) })
      onNotice('Tags gespeichert.')
    } catch {
      onNotice('Tags konnten nicht gespeichert werden.')
    }
  }
  return (
    <div style={{ marginTop: '1.1rem', borderTop: '1px solid var(--line)', paddingTop: '1.1rem', display: 'grid', gap: '.9rem' }}>
      {(['type', 'hero', 'level'] as const).map(dimension => (
        <fieldset key={dimension} style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="ddl-label">{dimensionLabels[dimension]}</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.45rem' }}>
            {taxonomy.filter(tag => tag.dimension === dimension).map(tag => (
              <button type="button" key={tag.id} aria-pressed={selected.includes(tag.id)} onClick={() => toggle(tag.id)} className="ddl-chip">{tag.name}</button>
            ))}
          </div>
        </fieldset>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.6rem' }}>
        <input value={freeTags} onChange={event => setFreeTags(event.target.value)} className="ddl-field" style={{ flex: 1, minWidth: '220px' }} placeholder="Freie Tags, mit Komma getrennt" />
        <button type="button" onClick={save} className="ddl-btn mini">Tags speichern</button>
      </div>
    </div>
  )
}

function PlaylistManager({ playlists, ownVideos, onChanged, onNotice }: { playlists: Playlist[]; ownVideos: Video[]; onChanged: () => Promise<void>; onNotice: (message: string) => void }) {
  const [draft, setDraft] = useState<PlaylistDraft>(emptyPlaylist)
  const toggleVideo = (id: number) => setDraft(value => ({ ...value, videoIds: value.videoIds.includes(id) ? value.videoIds.filter(videoId => videoId !== id) : [...value.videoIds, id] }))
  const move = (index: number, offset: number) => setDraft(value => {
    const next = [...value.videoIds]
    const target = index + offset
    if (target < 0 || target >= next.length) return value
    ;[next[index], next[target]] = [next[target], next[index]]
    return { ...value, videoIds: next }
  })
  const edit = async (playlist: Playlist) => {
    try {
      const detail = await getJson<Playlist>(`${api}/playlists/${playlist.id}`)
      setDraft({ id: playlist.id, title: playlist.title, description: playlist.description, source: playlist.source, ytPlaylist: playlist.yt_playlist_id || '', videoIds: detail.videos?.map(video => video.id) || [], featured: playlist.featured })
    } catch {
      onNotice('Playlist konnte nicht geladen werden.')
    }
  }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    const payload = {
      title: draft.title,
      description: draft.description,
      source: draft.source,
      yt_playlist_id: draft.source === 'yt' ? playlistId(draft.ytPlaylist) : null,
      video_ids: draft.source === 'manual' ? draft.videoIds : [],
      featured: draft.featured,
    }
    try {
      await sendJson(draft.id ? `${api}/playlists/${draft.id}` : `${api}/playlists`, draft.id ? 'PUT' : 'POST', payload)
      setDraft(emptyPlaylist)
      await onChanged()
      onNotice('Playlist gespeichert.')
    } catch {
      onNotice('Playlist konnte nicht gespeichert werden.')
    }
  }
  const remove = async (id: string) => {
    try {
      await sendJson(`${api}/playlists/${id}`, 'DELETE')
      if (draft.id === id) setDraft(emptyPlaylist)
      await onChanged()
      onNotice('Playlist gelöscht.')
    } catch {
      onNotice('Playlist konnte nicht gelöscht werden.')
    }
  }
  return (
    <div style={{ marginTop: '2rem', borderTop: '1px solid var(--line)', paddingTop: '2rem' }} className="ddl-playlist-manager">
      <div>
        <p className="ddl-label">Deine Playlists</p>
        <div style={{ display: 'grid', gap: '.8rem', marginTop: '.9rem' }}>
          {playlists.map(playlist => (
            <div key={playlist.id} className="ddl-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <p className="name">{playlist.title}</p>
              <p className="ddl-label" style={{ marginBottom: 0 }}>{playlist.source === 'yt' ? 'YouTube-Sync' : 'Manuell gepflegt'}</p>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => edit(playlist)} className="ddl-btn-ghost mini">Bearbeiten</button>
                <button type="button" onClick={() => remove(playlist.id)} className="ddl-btn-ghost mini">Löschen</button>
              </div>
            </div>
          ))}
          {playlists.length === 0 && <p className="ddl-muted">Noch keine Playlist angelegt.</p>}
        </div>
      </div>
      <form onSubmit={save} style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
        <h3 className="ddl-h3">{draft.id ? 'Playlist bearbeiten' : 'Neue Playlist'}</h3>
        <input required value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} className="ddl-field" placeholder="Titel" />
        <textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} className="ddl-textarea" placeholder="Beschreibung (optional)" />
        <div style={{ display: 'grid', gap: '.7rem', gridTemplateColumns: '1fr 1fr' }}>
          <button type="button" onClick={() => setDraft({ ...draft, source: 'manual' })} className={draft.source === 'manual' ? 'ddl-btn mini' : 'ddl-btn-ghost mini'}>Videos selbst auswählen</button>
          <button type="button" onClick={() => setDraft({ ...draft, source: 'yt' })} className={draft.source === 'yt' ? 'ddl-btn mini' : 'ddl-btn-ghost mini'}>YouTube-Playlist verknüpfen</button>
        </div>
        {draft.source === 'yt' ? (
          <input required value={draft.ytPlaylist} onChange={event => setDraft({ ...draft, ytPlaylist: event.target.value })} className="ddl-field" placeholder="YouTube-Playlist-Link oder ID" />
        ) : (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <p className="ddl-label" style={{ marginBottom: 0 }}>Videos auswählen und ordnen</p>
            <div style={{ display: 'grid', gap: '.5rem', maxHeight: '13rem', overflowY: 'auto', gridTemplateColumns: '1fr 1fr' }}>
              {ownVideos.map(video => (
                <label key={video.id} className="ddl-row" style={{ cursor: 'pointer', padding: '.6rem .8rem' }}>
                  <input type="checkbox" checked={draft.videoIds.includes(video.id)} onChange={() => toggleVideo(video.id)} style={{ accentColor: 'var(--gold)' }} />
                  <span className="grow name" style={{ fontSize: '.85rem', whiteSpace: 'normal' }}>{video.title}</span>
                </label>
              ))}
            </div>
            <ol style={{ display: 'grid', gap: '.5rem', padding: 0, margin: 0, listStyle: 'none' }}>
              {draft.videoIds.map((id, index) => {
                const video = ownVideos.find(item => item.id === id)
                return (
                  <li key={id} className="ddl-row" style={{ padding: '.55rem .8rem' }}>
                    <span className="grow name" style={{ fontSize: '.85rem' }}>{video?.title}</span>
                    <button type="button" onClick={() => move(index, -1)} className="ddl-btn-ghost mini">Hoch</button>
                    <button type="button" onClick={() => move(index, 1)} className="ddl-btn-ghost mini">Runter</button>
                  </li>
                )
              })}
            </ol>
          </div>
        )}
        <div style={{ display: 'flex', gap: '.7rem', flexWrap: 'wrap' }}>
          <button className="ddl-btn">Playlist speichern</button>
          {draft.id && <button type="button" onClick={() => setDraft(emptyPlaylist)} className="ddl-btn-ghost">Abbrechen</button>}
        </div>
      </form>
    </div>
  )
}

function PlaylistDetail() {
  const { id } = useParams()
  const [playlist, setPlaylist] = useState<Playlist>()
  useEffect(() => { getJson<Playlist>(`${api}/playlists/${id}`).then(setPlaylist).catch(() => setPlaylist(undefined)) }, [id])
  if (!playlist) return <p className="ddl-muted">Playlist wird geladen …</p>
  return (
    <section style={{ display: 'grid', gap: '2rem' }}>
      <div className="ddl-reveal">
        <Link to="/videos" className="ddl-link">← Zurück zur Bibliothek</Link>
        <p className="ddl-kicker" style={{ marginTop: '1.4rem' }}>{playlist.featured ? 'Lernpfad' : 'Playlist'}</p>
        <h1 className="ddl-h1">{playlist.title}</h1>
        <p className="ddl-lead">{playlist.description}</p>
      </div>
      <Divider />
      <div className="ddl-grid two ddl-reveal d1">{playlist.videos?.map(video => <VideoCard key={video.id} video={video} />)}</div>
    </section>
  )
}

function CreatorProfile() {
  const { id } = useParams()
  type Profile = { name?: string; avatar_url?: string; youtube_url: string; videos: Video[]; playlists: Playlist[] }
  const [profile, setProfile] = useState<Profile>()
  useEffect(() => { getJson<Profile>(`${api}/creators/${id}`).then(setProfile).catch(() => setProfile(undefined)) }, [id])
  if (!profile) return <p className="ddl-muted">Creator-Profil wird geladen …</p>
  return (
    <section style={{ display: 'grid', gap: '2rem' }}>
      <div className="ddl-reveal">
        <Link to="/videos" className="ddl-link">← Zurück zur Bibliothek</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.3rem', marginTop: '1.4rem', borderLeft: '2px solid var(--gold)', paddingLeft: '1.3rem' }}>
          {profile.avatar_url && <img src={profile.avatar_url} alt="" style={{ width: 84, height: 84, objectFit: 'cover', border: '1px solid var(--line-strong)' }} />}
          <div>
            <p className="ddl-kicker">Creator</p>
            <h1 className="ddl-h1" style={{ marginTop: '.5rem', fontSize: 'clamp(1.7rem, 4vw, 2.6rem)' }}>{profile.name}</h1>
            <a className="ddl-link" href={profile.youtube_url} target="_blank" rel="noreferrer">Zum YouTube-Kanal ↗</a>
          </div>
        </div>
      </div>
      <Divider />
      <div className="ddl-grid two ddl-reveal d1">{profile.videos.map(video => <VideoCard key={video.id} video={video} />)}</div>
    </section>
  )
}

function AdminPanel({ taxonomy, playlists, refresh, onNotice }: { taxonomy: Taxonomy[]; playlists: Playlist[]; refresh: () => Promise<void>; onNotice: (message: string) => void }) {
  const [draft, setDraft] = useState<{ id?: number; dimension: Taxonomy['dimension']; name: string; slug: string }>({ dimension: 'hero', name: '', slug: '' })
  const save = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await sendJson(draft.id ? `${apiBase}/admin/videos/taxonomy/${draft.id}` : `${apiBase}/admin/videos/taxonomy`, draft.id ? 'PUT' : 'POST', draft)
      setDraft({ dimension: 'hero', name: '', slug: '' })
      await refresh()
      onNotice('Eintrag gespeichert.')
    } catch {
      onNotice('Eintrag konnte nicht gespeichert werden.')
    }
  }
  const deactivate = async (id: number) => {
    try {
      await sendJson(`${apiBase}/admin/videos/taxonomy/${id}`, 'DELETE')
      await refresh()
      onNotice('Eintrag deaktiviert.')
    } catch {
      onNotice('Eintrag konnte nicht deaktiviert werden.')
    }
  }
  const toggleFeatured = async (playlist: Playlist) => {
    try {
      await sendJson(`${api}/playlists/${playlist.id}`, 'PUT', { title: playlist.title, description: playlist.description, source: playlist.source, yt_playlist_id: playlist.yt_playlist_id || null, featured: !playlist.featured })
      await refresh()
      onNotice('Lernpfad-Status geändert.')
    } catch {
      onNotice('Lernpfad-Status konnte nicht geändert werden.')
    }
  }
  return (
    <section className="ddl-panel ddl-corners">
      <Corners />
      <p className="ddl-kicker">Admin-Bereich</p>
      <h2 className="ddl-h2">Filter-Vokabular und Lernpfade verwalten</h2>
      <form onSubmit={save} style={{ display: 'grid', gap: '.7rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginTop: '1.4rem' }}>
        <select value={draft.dimension} onChange={event => setDraft({ ...draft, dimension: event.target.value as Taxonomy['dimension'] })} className="ddl-select">
          <option value="type">Typ</option>
          <option value="hero">Held</option>
          <option value="level">Level</option>
        </select>
        <input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Anzeigename" className="ddl-field" />
        <input required value={draft.slug} onChange={event => setDraft({ ...draft, slug: event.target.value })} placeholder="Kennung, z.B. neuer-held" className="ddl-field" />
        <button className="ddl-btn mini">Speichern</button>
      </form>
      <div style={{ display: 'grid', gap: '.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', marginTop: '1.4rem' }}>
        {taxonomy.map(tag => (
          <div key={tag.id} className="ddl-row" style={{ padding: '.55rem .8rem' }}>
            <span className="grow name" style={{ fontSize: '.85rem' }}>{tag.name}</span>
            <button type="button" onClick={() => setDraft(tag)} className="ddl-btn-ghost mini">Bearbeiten</button>
            <button type="button" onClick={() => deactivate(tag.id)} className="ddl-btn-ghost mini">Deaktivieren</button>
          </div>
        ))}
      </div>
      <h3 className="ddl-h3" style={{ marginTop: '2rem' }}>Lernpfade festlegen</h3>
      <div style={{ display: 'grid', gap: '.7rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', marginTop: '.9rem' }}>
        {playlists.map(playlist => (
          <div key={playlist.id} className="ddl-row">
            <span className="grow name">{playlist.title}</span>
            <button type="button" onClick={() => toggleFeatured(playlist)} className={playlist.featured ? 'ddl-btn mini' : 'ddl-btn-ghost mini'}>{playlist.featured ? 'Lernpfad entfernen' : 'Zum Lernpfad machen'}</button>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function VideosPage({ view = 'feed' }: { view?: 'feed' | 'playlist' | 'creator' }) {
  const { user, isAdmin } = useAuth()
  const [videos, setVideos] = useState<Video[]>([])
  const [taxonomy, setTaxonomy] = useState<Taxonomy[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [filters, setFilters] = useState({ type: '', hero: '', level: '', q: '' })
  const [channel, setChannel] = useState('')
  const [channels, setChannels] = useState<Channel[]>([])
  const [notice, setNotice] = useState('')
  const [ownVideos, setOwnVideos] = useState<Video[]>([])
  const query = useMemo(() => new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString(), [filters])

  async function refreshLibrary() {
    const [tags, paths] = await Promise.all([getJson<Taxonomy[]>(`${api}/taxonomy`), getJson<Playlist[]>(`${api}/playlists`)])
    setTaxonomy(tags)
    setPlaylists(paths)
  }
  async function refreshCreator() {
    if (!user) return
    const [mine, ownChannels] = await Promise.all([getJson<Video[]>(`${api}/mine`), getJson<Channel[]>(`${api}/channels`)])
    setOwnVideos(mine)
    setChannels(ownChannels)
  }

  useEffect(() => { getJson<Video[]>(`${api}?${query}`).then(setVideos).catch(() => setVideos([])) }, [query])
  useEffect(() => { refreshLibrary().catch(() => undefined) }, [])
  useEffect(() => { refreshCreator().catch(() => { setOwnVideos([]); setChannels([]) }) }, [user])

  if (view === 'playlist') return <PlaylistDetail />
  if (view === 'creator') return <CreatorProfile />

  const register = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await sendJson(`${api}/channels`, 'POST', { channel })
      setChannel('')
      await refreshCreator()
      setNotice('Kanal registriert. Deine Videos tauchen in den nächsten Minuten hier auf.')
    } catch {
      setNotice('Kanal konnte nicht registriert werden. Prüf den Link, vielleicht ist der Kanal auch schon vergeben.')
    }
  }
  const disconnect = async (id: number) => {
    try {
      await sendJson(`${api}/channels/${id}`, 'DELETE')
      await refreshCreator()
      setNotice('Kanal getrennt.')
    } catch {
      setNotice('Kanal konnte nicht getrennt werden.')
    }
  }
  const moderate = async (id: number, action: 'approve' | 'hide') => {
    try {
      await sendJson(`${api}/${id}/${action}`, 'POST')
      await refreshCreator()
      setNotice(action === 'approve' ? 'Video ist jetzt öffentlich.' : 'Video versteckt.')
    } catch {
      setNotice('Status konnte nicht geändert werden.')
    }
  }
  const options = (dimension: Taxonomy['dimension']) => taxonomy.filter(tag => tag.dimension === dimension)
  const creatorPlaylists = playlists.filter(playlist => String(playlist.owner_discord_id) === user?.id)

  return (
    <>
      <header className="ddl-panel ddl-corners ddl-hero ddl-reveal">
        <Corners />
        <p className="ddl-kicker">Deutsche Deadlock Community</p>
        <h1 className="ddl-h1">Die Video-Bibliothek unserer Creator</h1>
        <p className="ddl-lead">Guides, Gameplay und Analysen aus der deutschen Deadlock-Community, chronologisch und filterbar. Neu im Spiel? Die Lernpfade führen dich Schritt für Schritt rein.</p>
      </header>

      <section className="ddl-reveal d1" aria-label="Videofilter" style={{ display: 'grid', gap: '.7rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <input className="ddl-field" value={filters.q} onChange={event => setFilters({ ...filters, q: event.target.value })} placeholder="Suchen, z.B. Lash oder Farming" />
        {(['type', 'hero', 'level'] as const).map(dimension => (
          <select key={dimension} className="ddl-select" value={filters[dimension]} onChange={event => setFilters({ ...filters, [dimension]: event.target.value })}>
            <option value="">{dimensionFilterLabels[dimension]}</option>
            {options(dimension).map(tag => <option key={tag.id} value={tag.slug}>{tag.name}</option>)}
          </select>
        ))}
      </section>

      {playlists.length > 0 && (
        <section className="ddl-reveal d2">
          <p className="ddl-kicker">Kuratiert</p>
          <h2 className="ddl-h2">Lernpfade und Playlists</h2>
          <div className="ddl-grid three" style={{ marginTop: '1.4rem' }}>
            {playlists.map(playlist => (
              <Link key={playlist.id} to={`/videos/playlists/${playlist.id}`} className={playlist.featured ? 'ddl-path featured' : 'ddl-path'}>
                <span className="tag">{playlist.featured ? 'Lernpfad' : 'Playlist'}</span>
                <h3 className="title">{playlist.title}</h3>
                <p className="desc">{playlist.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Divider />

      <section className="ddl-reveal d3">
        <p className="ddl-kicker">Chronologisch</p>
        <h2 className="ddl-h2">Neueste Videos</h2>
        <div className="ddl-grid three" style={{ marginTop: '1.4rem' }}>
          {videos.map(video => <VideoCard key={video.id} video={video} />)}
        </div>
        {videos.length === 0 && <p className="ddl-empty" style={{ marginTop: '1.4rem' }}>Keine passenden Videos gefunden. Probier andere Filter.</p>}
      </section>

      {user && (
        <section className="ddl-panel ddl-corners">
          <Corners />
          <p className="ddl-kicker">Creator-Bereich</p>
          <h2 className="ddl-h2">Deine Kanäle, Videos und Playlists</h2>
          <form onSubmit={register} style={{ display: 'flex', flexWrap: 'wrap', gap: '.7rem', marginTop: '1.4rem' }}>
            <input required value={channel} onChange={event => setChannel(event.target.value)} className="ddl-field" style={{ flex: 1, minWidth: '260px' }} placeholder="YouTube-Kanal-Link oder Channel-ID" />
            <button className="ddl-btn">Kanal registrieren</button>
          </form>
          <div style={{ display: 'grid', gap: '.7rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', marginTop: '1rem' }}>
            {channels.map(item => (
              <div key={item.id} className="ddl-row">
                <div className="grow">
                  <p className="name">{item.title || item.youtube_channel_id}</p>
                  <span className={item.active ? 'ddl-badge live' : 'ddl-badge hidden'}>{item.active ? 'Verbunden' : 'Getrennt'}</span>
                </div>
                {item.active && <button type="button" onClick={() => disconnect(item.id)} className="ddl-btn-ghost mini">Kanal trennen</button>}
              </div>
            ))}
          </div>
          {notice && <p className="ddl-notice" style={{ marginTop: '1.1rem' }}>{notice}</p>}
          <div style={{ display: 'grid', gap: '1rem', marginTop: '1.8rem' }}>
            {ownVideos.map(video => (
              <article key={video.id} className="ddl-row" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '1.1rem 1.2rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.8rem' }}>
                  <div className="grow">
                    <p className="name">{video.title}</p>
                    <span className={`ddl-badge ${video.status === 'live' ? 'live' : video.status === 'hidden' ? 'hidden' : ''}`}>{statusLabels[video.status ?? ''] ?? video.status}</span>
                  </div>
                  {video.status === 'pending' && <button type="button" onClick={() => moderate(video.id, 'approve')} className="ddl-btn mini">Freigeben</button>}
                  <button type="button" onClick={() => moderate(video.id, 'hide')} className="ddl-btn-ghost mini">Verstecken</button>
                </div>
                <VideoTagEditor videoId={video.id} taxonomy={taxonomy} onNotice={setNotice} />
              </article>
            ))}
          </div>
          <PlaylistManager playlists={creatorPlaylists} ownVideos={ownVideos} onChanged={refreshLibrary} onNotice={setNotice} />
        </section>
      )}

      {isAdmin && <AdminPanel taxonomy={taxonomy} playlists={playlists} refresh={refreshLibrary} onNotice={setNotice} />}
    </>
  )
}
