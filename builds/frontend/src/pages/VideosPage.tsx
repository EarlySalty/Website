import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

const api = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/videos`

type Video = { id: number; yt_video_id: string; title: string; description: string; thumbnail_url: string; published_at: string }
type Taxonomy = { id: number; dimension: 'type' | 'hero' | 'level'; name: string; slug: string }
type Playlist = { id: string; title: string; description: string; featured: boolean; videos?: Video[] }

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) throw new Error(String(response.status))
  return response.json()
}

function VideoCard({ video }: { video: Video }) {
  const [active, setActive] = useState(false)
  return (
    <article className="overflow-hidden rounded-[1.4rem] border border-[#c9a86a]/25 bg-[#211a11] shadow-2xl shadow-black/25">
      <div className="aspect-video bg-black">
        {active ? (
          <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${video.yt_video_id}?autoplay=1`} title={video.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        ) : (
          <button className="group relative h-full w-full text-left" onClick={() => setActive(true)} aria-label="PLATZHALTER: Video abspielen">
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

function PlaylistDetail() {
  const { id } = useParams()
  const [playlist, setPlaylist] = useState<Playlist>()
  useEffect(() => { getJson<Playlist>(`${api}/playlists/${id}`).then(setPlaylist).catch(() => setPlaylist(undefined)) }, [id])
  if (!playlist) return <p className="text-[#cfc1a5]">PLATZHALTER: Playlist wird geladen</p>
  return <section className="space-y-8"><Link to="/videos" className="text-sm font-bold text-[#c9a86a]">PLATZHALTER: Zur Video-Bibliothek</Link><div><p className="text-xs uppercase tracking-[.25em] text-[#c9a86a]">PLATZHALTER: Lernpfad</p><h1 className="mt-2 text-4xl font-black text-[#f5ecd9]">{playlist.title}</h1><p className="mt-3 max-w-2xl text-[#cfc1a5]">{playlist.description}</p></div><div className="grid gap-6 md:grid-cols-2">{playlist.videos?.map(video => <VideoCard key={video.id} video={video} />)}</div></section>
}

function CreatorProfile() {
  const { id } = useParams()
  type Profile = { name?: string; avatar_url?: string; youtube_url: string; videos: Video[]; playlists: Playlist[] }
  const [profile, setProfile] = useState<Profile>()
  useEffect(() => { getJson<Profile>(`${api}/creators/${id}`).then(setProfile).catch(() => setProfile(undefined)) }, [id])
  if (!profile) return <p className="text-[#cfc1a5]">PLATZHALTER: Creator-Profil wird geladen</p>
  return <section className="space-y-8"><Link to="/videos" className="text-sm font-bold text-[#c9a86a]">PLATZHALTER: Zur Video-Bibliothek</Link><div className="flex items-center gap-5 border-l-4 border-[#c9a86a] pl-5">{profile.avatar_url && <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover" />}<div><h1 className="text-4xl font-black text-[#f5ecd9]">{profile.name}</h1><a className="mt-2 inline-block font-bold text-[#c9a86a]" href={profile.youtube_url} target="_blank" rel="noreferrer">PLATZHALTER: YouTube-Kanal öffnen</a></div></div><div className="grid gap-6 md:grid-cols-2">{profile.videos.map(video => <VideoCard key={video.id} video={video} />)}</div></section>
}

export default function VideosPage({ view = 'feed' }: { view?: 'feed' | 'playlist' | 'creator' }) {
  const { user, isAdmin } = useAuth()
  const [videos, setVideos] = useState<Video[]>([])
  const [taxonomy, setTaxonomy] = useState<Taxonomy[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [filters, setFilters] = useState({ type: '', hero: '', level: '', q: '' })
  const [channel, setChannel] = useState('')
  const [notice, setNotice] = useState('')
  const [ownVideos, setOwnVideos] = useState<(Video & { status: string })[]>([])
  const [newTag, setNewTag] = useState({ dimension: 'hero', name: '', slug: '' })

  const query = useMemo(() => new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString(), [filters])
  useEffect(() => { getJson<Video[]>(`${api}?${query}`).then(setVideos).catch(() => setVideos([])) }, [query])
  useEffect(() => { Promise.all([getJson<Taxonomy[]>(`${api}/taxonomy`), getJson<Playlist[]>(`${api}/playlists`)]).then(([tags, paths]) => { setTaxonomy(tags); setPlaylists(paths) }).catch(() => undefined) }, [])
  useEffect(() => { if (user) getJson<(Video & { status: string })[]>(`${api}/mine`).then(setOwnVideos).catch(() => setOwnVideos([])) }, [user])

  if (view === 'playlist') return <PlaylistDetail />
  if (view === 'creator') return <CreatorProfile />

  const register = async (event: FormEvent) => {
    event.preventDefault(); setNotice('')
    const response = await fetch(`${api}/channels`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel }) })
    setNotice(response.ok ? 'PLATZHALTER: Kanal wurde registriert' : 'PLATZHALTER: Kanal konnte nicht registriert werden')
  }
  const options = (dimension: Taxonomy['dimension']) => taxonomy.filter(tag => tag.dimension === dimension)
  const moderate = async (id: number, action: 'approve' | 'hide') => {
    const response = await fetch(`${api}/${id}/${action}`, { method: 'POST', credentials: 'include' })
    if (response.ok) setOwnVideos(items => items.map(item => item.id === id ? { ...item, status: action === 'approve' ? 'live' : 'hidden' } : item))
  }
  const addTaxonomy = async (event: FormEvent) => {
    event.preventDefault()
    const response = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/admin/videos/taxonomy`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(newTag) })
    if (response.ok) setNotice('PLATZHALTER: Taxonomie-Eintrag wurde gespeichert')
  }

  return (
    <div className="space-y-12">
      <header className="relative overflow-hidden rounded-[2rem] border border-[#c9a86a]/30 bg-[#211a11] px-6 py-10 md:px-10">
        <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-b from-[#f2dfb8] via-[#c9a86a] to-[#806536]" />
        <p className="text-xs font-extrabold uppercase tracking-[.3em] text-[#c9a86a]">PLATZHALTER: Deutsche Deadlock Video-Bibliothek</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-[#f5ecd9] md:text-6xl">PLATZHALTER: Wissen, Spielzüge und Analysen an einem Ort</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[#cfc1a5]">PLATZHALTER: Beschreibung der Video-Bibliothek und ihrer kuratierten Lernpfade</p>
      </header>

      <section className="grid gap-3 rounded-[1.4rem] border border-[#c9a86a]/20 bg-black/20 p-4 md:grid-cols-4" aria-label="PLATZHALTER: Videofilter">
        <input className="rounded-xl border border-white/10 bg-[#18120c] px-4 py-3 text-[#f5ecd9] outline-none focus:border-[#c9a86a]" value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} placeholder="PLATZHALTER: Videos durchsuchen" />
        {(['type', 'hero', 'level'] as const).map(dimension => <select key={dimension} className="rounded-xl border border-white/10 bg-[#18120c] px-4 py-3 text-[#f5ecd9] outline-none focus:border-[#c9a86a]" value={filters[dimension]} onChange={e => setFilters({ ...filters, [dimension]: e.target.value })}><option value="">PLATZHALTER: {dimension}-Filter</option>{options(dimension).map(tag => <option key={tag.id} value={tag.slug}>{tag.name}</option>)}</select>)}
      </section>

      {playlists.length > 0 && <section><div className="mb-5 flex items-end justify-between"><div><p className="text-xs uppercase tracking-[.25em] text-[#c9a86a]">PLATZHALTER: Kuratiert</p><h2 className="mt-2 text-3xl font-black text-[#f5ecd9]">PLATZHALTER: Lernpfade und Playlists</h2></div></div><div className="grid gap-4 md:grid-cols-3">{playlists.map(playlist => <Link key={playlist.id} to={`/videos/playlists/${playlist.id}`} className="rounded-[1.25rem] border border-[#c9a86a]/20 bg-[#211a11] p-5 transition hover:-translate-y-1 hover:border-[#c9a86a]/60"><span className="text-xs font-bold uppercase tracking-[.2em] text-[#c9a86a]">{playlist.featured ? 'PLATZHALTER: Lernpfad' : 'PLATZHALTER: Playlist'}</span><h3 className="mt-3 text-xl font-bold text-[#f5ecd9]">{playlist.title}</h3><p className="mt-2 text-sm text-[#cfc1a5]">{playlist.description}</p></Link>)}</div></section>}

      <section><h2 className="mb-5 text-3xl font-black text-[#f5ecd9]">PLATZHALTER: Neueste Videos</h2><div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{videos.map(video => <VideoCard key={video.id} video={video} />)}</div>{videos.length === 0 && <p className="rounded-2xl border border-dashed border-[#c9a86a]/30 p-8 text-center text-[#cfc1a5]">PLATZHALTER: Keine passenden Videos gefunden</p>}</section>

      {user && <section className="rounded-[1.4rem] border border-[#c9a86a]/25 bg-[#211a11] p-6"><p className="text-xs uppercase tracking-[.25em] text-[#c9a86a]">PLATZHALTER: Creator-Bereich</p><h2 className="mt-2 text-2xl font-black text-[#f5ecd9]">PLATZHALTER: YouTube-Kanal verbinden</h2><form onSubmit={register} className="mt-5 flex flex-col gap-3 sm:flex-row"><input required value={channel} onChange={e => setChannel(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#18120c] px-4 py-3 text-[#f5ecd9] focus:border-[#c9a86a] focus:outline-none" placeholder="PLATZHALTER: Kanal-URL oder Channel-ID" /><button className="rounded-xl bg-[#c9a86a] px-5 py-3 font-extrabold text-[#241c11]">PLATZHALTER: Kanal registrieren</button></form>{notice && <p className="mt-3 text-sm text-[#cfc1a5]">{notice}</p>}{ownVideos.length > 0 && <div className="mt-6 space-y-3">{ownVideos.map(video => <div key={video.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate font-bold text-[#f5ecd9]">{video.title}</p><p className="text-xs uppercase tracking-wider text-[#c9a86a]">{video.status}</p></div>{video.status === 'pending' && <button onClick={() => moderate(video.id, 'approve')} className="rounded-lg bg-[#c9a86a] px-3 py-2 text-sm font-bold text-[#241c11]">PLATZHALTER: Freigeben</button>}<button onClick={() => moderate(video.id, 'hide')} className="rounded-lg border border-[#c9a86a]/40 px-3 py-2 text-sm font-bold text-[#f5ecd9]">PLATZHALTER: Verstecken</button></div>)}</div>}</section>}

      {isAdmin && <section className="rounded-[1.4rem] border border-[#c9a86a]/25 bg-[#211a11] p-6"><p className="text-xs uppercase tracking-[.25em] text-[#c9a86a]">PLATZHALTER: Admin-Bereich</p><h2 className="mt-2 text-2xl font-black text-[#f5ecd9]">PLATZHALTER: Filter-Vokabular ergänzen</h2><form onSubmit={addTaxonomy} className="mt-5 grid gap-3 md:grid-cols-4"><select value={newTag.dimension} onChange={e => setNewTag({ ...newTag, dimension: e.target.value })} className="rounded-xl bg-[#18120c] px-4 py-3 text-[#f5ecd9]"><option value="type">PLATZHALTER: Typ</option><option value="hero">PLATZHALTER: Held</option><option value="level">PLATZHALTER: Level</option></select><input required value={newTag.name} onChange={e => setNewTag({ ...newTag, name: e.target.value })} placeholder="PLATZHALTER: Anzeigename" className="rounded-xl bg-[#18120c] px-4 py-3 text-[#f5ecd9]" /><input required value={newTag.slug} onChange={e => setNewTag({ ...newTag, slug: e.target.value })} placeholder="PLATZHALTER: Kennung" className="rounded-xl bg-[#18120c] px-4 py-3 text-[#f5ecd9]" /><button className="rounded-xl bg-[#c9a86a] px-4 py-3 font-bold text-[#241c11]">PLATZHALTER: Speichern</button></form></section>}
    </div>
  )
}
