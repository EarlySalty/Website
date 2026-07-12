import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiBase } from '@/api/base'
import { useAuth } from '@/context/AuthContext'

const api = `${apiBase}/videos`
const panel = 'rounded-[1.4rem] border border-[#c9a86a]/25 bg-[#211a11] p-6'
const field = 'rounded-xl border border-white/10 bg-[#18120c] px-4 py-3 text-[#f5ecd9] outline-none focus:border-[#c9a86a]'
const primary = 'rounded-xl bg-[#c9a86a] px-4 py-3 font-extrabold text-[#241c11]'
const secondary = 'rounded-xl border border-[#c9a86a]/40 px-4 py-3 font-bold text-[#f5ecd9]'

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

function VideoCard({ video }: { video: Video }) {
  const [active, setActive] = useState(false)
  return (
    <article className="overflow-hidden rounded-[1.4rem] border border-[#c9a86a]/25 bg-[#211a11] shadow-2xl shadow-black/25">
      <div className="aspect-video bg-black">
        {active ? (
          <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${video.yt_video_id}?autoplay=1`} title={video.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        ) : (
          <button className="group relative h-full w-full text-left" onClick={() => setActive(true)} aria-label="Video abspielen">
            <img className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" src={video.thumbnail_url || `https://i.ytimg.com/vi/${video.yt_video_id}/hqdefault.jpg`} alt="" loading="lazy" />
            <span className="absolute inset-0 grid place-items-center bg-black/15"><span className="grid h-14 w-14 place-items-center rounded-full border border-[#f2dfb8]/50 bg-[#c9a86a] text-xl text-[#241c11] shadow-xl">▶</span></span>
          </button>
        )}
      </div>
      <div className="space-y-2 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#c9a86a]">{new Date(video.published_at).toLocaleDateString('de-DE')}</p>
        <h2 className="font-display text-xl font-bold text-[#f5ecd9]">{video.title}</h2>
        <p className="line-clamp-2 text-sm leading-6 text-[#cfc1a5]">{video.description}</p>
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
    <div className="mt-4 space-y-3 border-t border-[#c9a86a]/15 pt-4">
      {(['type', 'hero', 'level'] as const).map(dimension => (
        <fieldset key={dimension} className="space-y-2">
          <legend className="text-xs font-bold uppercase tracking-[.18em] text-[#c9a86a]">{dimensionLabels[dimension]}</legend>
          <div className="flex flex-wrap gap-2">
            {taxonomy.filter(tag => tag.dimension === dimension).map(tag => (
              <button type="button" key={tag.id} aria-pressed={selected.includes(tag.id)} onClick={() => toggle(tag.id)} className={`rounded-full border px-3 py-1 text-xs font-bold ${selected.includes(tag.id) ? 'border-[#f2dfb8] bg-[#c9a86a] text-[#241c11]' : 'border-[#c9a86a]/30 text-[#cfc1a5]'}`}>{tag.name}</button>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={freeTags} onChange={event => setFreeTags(event.target.value)} className={`${field} min-w-0 flex-1`} placeholder="Freie Tags, mit Komma getrennt" />
        <button type="button" onClick={save} className={primary}>Tags speichern</button>
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
    <div className="mt-8 grid gap-6 border-t border-[#c9a86a]/20 pt-8 lg:grid-cols-[.8fr_1.2fr]">
      <div>
        <p className="text-xs uppercase tracking-[.25em] text-[#c9a86a]">Deine Playlists</p>
        <div className="mt-4 space-y-3">
          {playlists.map(playlist => (
            <div key={playlist.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="font-bold text-[#f5ecd9]">{playlist.title}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-[#c9a86a]">{playlist.source === 'yt' ? 'YouTube-Sync' : 'Manuell gepflegt'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => edit(playlist)} className={secondary}>Bearbeiten</button>
                <button type="button" onClick={() => remove(playlist.id)} className={secondary}>Löschen</button>
              </div>
            </div>
          ))}
          {playlists.length === 0 && <p className="text-sm text-[#cfc1a5]">Noch keine Playlist angelegt.</p>}
        </div>
      </div>
      <form onSubmit={save} className="space-y-4">
        <h3 className="text-xl font-black text-[#f5ecd9]">{draft.id ? 'Playlist bearbeiten' : 'Neue Playlist'}</h3>
        <input required value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} className={`${field} w-full`} placeholder="Titel" />
        <textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} className={`${field} min-h-24 w-full`} placeholder="Beschreibung (optional)" />
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setDraft({ ...draft, source: 'manual' })} className={draft.source === 'manual' ? primary : secondary}>Videos selbst auswählen</button>
          <button type="button" onClick={() => setDraft({ ...draft, source: 'yt' })} className={draft.source === 'yt' ? primary : secondary}>YouTube-Playlist verknüpfen</button>
        </div>
        {draft.source === 'yt' ? (
          <input required value={draft.ytPlaylist} onChange={event => setDraft({ ...draft, ytPlaylist: event.target.value })} className={`${field} w-full`} placeholder="YouTube-Playlist-Link oder ID" />
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-bold text-[#cfc1a5]">Videos auswählen und ordnen</p>
            <div className="grid max-h-52 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {ownVideos.map(video => <label key={video.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 p-3 text-sm text-[#f5ecd9]"><input type="checkbox" checked={draft.videoIds.includes(video.id)} onChange={() => toggleVideo(video.id)} />{video.title}</label>)}
            </div>
            <ol className="space-y-2">
              {draft.videoIds.map((id, index) => {
                const video = ownVideos.find(item => item.id === id)
                return <li key={id} className="flex items-center gap-2 rounded-lg bg-black/20 p-2"><span className="min-w-0 flex-1 truncate text-sm text-[#f5ecd9]">{video?.title}</span><button type="button" onClick={() => move(index, -1)} className={secondary}>Hoch</button><button type="button" onClick={() => move(index, 1)} className={secondary}>Runter</button></li>
              })}
            </ol>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button className={primary}>Playlist speichern</button>
          {draft.id && <button type="button" onClick={() => setDraft(emptyPlaylist)} className={secondary}>Abbrechen</button>}
        </div>
      </form>
    </div>
  )
}

function PlaylistDetail() {
  const { id } = useParams()
  const [playlist, setPlaylist] = useState<Playlist>()
  useEffect(() => { getJson<Playlist>(`${api}/playlists/${id}`).then(setPlaylist).catch(() => setPlaylist(undefined)) }, [id])
  if (!playlist) return <p className="text-[#cfc1a5]">Playlist wird geladen …</p>
  return <section className="space-y-8"><Link to="/videos" className="text-sm font-bold text-[#c9a86a]">Zurück zur Bibliothek</Link><div><p className="text-xs uppercase tracking-[.25em] text-[#c9a86a]">{playlist.featured ? 'Lernpfad' : 'Playlist'}</p><h1 className="mt-2 text-4xl font-black text-[#f5ecd9]">{playlist.title}</h1><p className="mt-3 max-w-2xl text-[#cfc1a5]">{playlist.description}</p></div><div className="grid gap-6 md:grid-cols-2">{playlist.videos?.map(video => <VideoCard key={video.id} video={video} />)}</div></section>
}

function CreatorProfile() {
  const { id } = useParams()
  type Profile = { name?: string; avatar_url?: string; youtube_url: string; videos: Video[]; playlists: Playlist[] }
  const [profile, setProfile] = useState<Profile>()
  useEffect(() => { getJson<Profile>(`${api}/creators/${id}`).then(setProfile).catch(() => setProfile(undefined)) }, [id])
  if (!profile) return <p className="text-[#cfc1a5]">Creator-Profil wird geladen …</p>
  return <section className="space-y-8"><Link to="/videos" className="text-sm font-bold text-[#c9a86a]">Zurück zur Bibliothek</Link><div className="flex items-center gap-5 border-l-4 border-[#c9a86a] pl-5">{profile.avatar_url && <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover" />}<div><h1 className="text-4xl font-black text-[#f5ecd9]">{profile.name}</h1><a className="mt-2 inline-block font-bold text-[#c9a86a]" href={profile.youtube_url} target="_blank" rel="noreferrer">Zum YouTube-Kanal</a></div></div><div className="grid gap-6 md:grid-cols-2">{profile.videos.map(video => <VideoCard key={video.id} video={video} />)}</div></section>
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
    <section className={`${panel} space-y-8`}>
      <div><p className="text-xs uppercase tracking-[.25em] text-[#c9a86a]">Admin-Bereich</p><h2 className="mt-2 text-2xl font-black text-[#f5ecd9]">Filter-Vokabular und Lernpfade verwalten</h2></div>
      <form onSubmit={save} className="grid gap-3 md:grid-cols-4"><select value={draft.dimension} onChange={event => setDraft({ ...draft, dimension: event.target.value as Taxonomy['dimension'] })} className={field}><option value="type">Typ</option><option value="hero">Held</option><option value="level">Level</option></select><input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Anzeigename" className={field} /><input required value={draft.slug} onChange={event => setDraft({ ...draft, slug: event.target.value })} placeholder="Kennung, z.B. neuer-held" className={field} /><button className={primary}>Speichern</button></form>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{taxonomy.map(tag => <div key={tag.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3"><span className="min-w-0 flex-1 truncate text-sm text-[#f5ecd9]">{tag.name}</span><button type="button" onClick={() => setDraft(tag)} className={secondary}>Bearbeiten</button><button type="button" onClick={() => deactivate(tag.id)} className={secondary}>Deaktivieren</button></div>)}</div>
      <div><h3 className="text-xl font-black text-[#f5ecd9]">Lernpfade festlegen</h3><div className="mt-4 grid gap-3 md:grid-cols-2">{playlists.map(playlist => <div key={playlist.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4"><span className="min-w-0 flex-1 truncate font-bold text-[#f5ecd9]">{playlist.title}</span><button type="button" onClick={() => toggleFeatured(playlist)} className={playlist.featured ? primary : secondary}>{playlist.featured ? 'Lernpfad entfernen' : 'Zum Lernpfad machen'}</button></div>)}</div></div>
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
    <div className="space-y-12">
      <header className="relative overflow-hidden rounded-[2rem] border border-[#c9a86a]/30 bg-[#211a11] px-6 py-10 md:px-10"><div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-b from-[#f2dfb8] via-[#c9a86a] to-[#806536]" /><p className="text-xs font-extrabold uppercase tracking-[.3em] text-[#c9a86a]">Deutsche Deadlock Community</p><h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-[#f5ecd9] md:text-6xl">Die Video-Bibliothek unserer Creator</h1><p className="mt-5 max-w-2xl text-base leading-7 text-[#cfc1a5]">Guides, Gameplay und Analysen aus der deutschen Deadlock-Community, chronologisch und filterbar. Neu im Spiel? Die Lernpfade führen dich Schritt für Schritt rein.</p></header>

      <section className="grid gap-3 rounded-[1.4rem] border border-[#c9a86a]/20 bg-black/20 p-4 md:grid-cols-4" aria-label="Videofilter"><input className={field} value={filters.q} onChange={event => setFilters({ ...filters, q: event.target.value })} placeholder="Suchen, z.B. Lash oder Farming" />{(['type', 'hero', 'level'] as const).map(dimension => <select key={dimension} className={field} value={filters[dimension]} onChange={event => setFilters({ ...filters, [dimension]: event.target.value })}><option value="">{dimensionFilterLabels[dimension]}</option>{options(dimension).map(tag => <option key={tag.id} value={tag.slug}>{tag.name}</option>)}</select>)}</section>

      {playlists.length > 0 && <section><div className="mb-5"><p className="text-xs uppercase tracking-[.25em] text-[#c9a86a]">Kuratiert</p><h2 className="mt-2 text-3xl font-black text-[#f5ecd9]">Lernpfade und Playlists</h2></div><div className="grid gap-4 md:grid-cols-3">{playlists.map(playlist => <Link key={playlist.id} to={`/videos/playlists/${playlist.id}`} className="rounded-[1.25rem] border border-[#c9a86a]/20 bg-[#211a11] p-5 transition hover:-translate-y-1 hover:border-[#c9a86a]/60"><span className="text-xs font-bold uppercase tracking-[.2em] text-[#c9a86a]">{playlist.featured ? 'Lernpfad' : 'Playlist'}</span><h3 className="mt-3 text-xl font-bold text-[#f5ecd9]">{playlist.title}</h3><p className="mt-2 text-sm text-[#cfc1a5]">{playlist.description}</p></Link>)}</div></section>}

      <section><h2 className="mb-5 text-3xl font-black text-[#f5ecd9]">Neueste Videos</h2><div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{videos.map(video => <VideoCard key={video.id} video={video} />)}</div>{videos.length === 0 && <p className="rounded-2xl border border-dashed border-[#c9a86a]/30 p-8 text-center text-[#cfc1a5]">Keine passenden Videos gefunden. Probier andere Filter.</p>}</section>

      {user && <section className={panel}><p className="text-xs uppercase tracking-[.25em] text-[#c9a86a]">Creator-Bereich</p><h2 className="mt-2 text-2xl font-black text-[#f5ecd9]">Deine Kanäle, Videos und Playlists</h2><form onSubmit={register} className="mt-5 flex flex-col gap-3 sm:flex-row"><input required value={channel} onChange={event => setChannel(event.target.value)} className={`${field} min-w-0 flex-1`} placeholder="YouTube-Kanal-Link oder Channel-ID" /><button className={primary}>Kanal registrieren</button></form><div className="mt-4 grid gap-3 sm:grid-cols-2">{channels.map(item => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4"><div className="min-w-0 flex-1"><p className="truncate font-bold text-[#f5ecd9]">{item.title || item.youtube_channel_id}</p><p className="text-xs uppercase tracking-wider text-[#c9a86a]">{item.active ? 'Verbunden' : 'Getrennt'}</p></div>{item.active && <button type="button" onClick={() => disconnect(item.id)} className={secondary}>Kanal trennen</button>}</div>)}</div>{notice && <p className="mt-4 text-sm text-[#cfc1a5]">{notice}</p>}<div className="mt-8 space-y-4">{ownVideos.map(video => <article key={video.id} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate font-bold text-[#f5ecd9]">{video.title}</p><p className="text-xs uppercase tracking-wider text-[#c9a86a]">{statusLabels[video.status ?? ''] ?? video.status}</p></div>{video.status === 'pending' && <button type="button" onClick={() => moderate(video.id, 'approve')} className={primary}>Freigeben</button>}<button type="button" onClick={() => moderate(video.id, 'hide')} className={secondary}>Verstecken</button></div><VideoTagEditor videoId={video.id} taxonomy={taxonomy} onNotice={setNotice} /></article>)}</div><PlaylistManager playlists={creatorPlaylists} ownVideos={ownVideos} onChanged={refreshLibrary} onNotice={setNotice} /></section>}

      {isAdmin && <AdminPanel taxonomy={taxonomy} playlists={playlists} refresh={refreshLibrary} onNotice={setNotice} />}
    </div>
  )
}
