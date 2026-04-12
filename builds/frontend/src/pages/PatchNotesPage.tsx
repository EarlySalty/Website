import { useQuery } from '@tanstack/react-query'
import { patchNotes } from '@/api/client'

export default function PatchNotesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['patchnotes'],
    queryFn: patchNotes.list,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-violet border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="content-grid py-10 md:py-14">
      <div className="mb-8">
        <span className="eyebrow">Patch Archive</span>
        <h1 className="section-title mt-4">Patch Notes</h1>
        <p className="section-copy mt-2 max-w-2xl">
          Current updates and archived notes in a denser, more readable changelog layout.
        </p>
      </div>

      {data && data.length > 0 ? (
        <div className="space-y-5">
          {data.map((note) => (
            <article key={note.id} className="glass-panel rounded-[1.75rem] p-6 md:p-7">
              <div className="flex flex-col gap-3 border-b border-white/8 pb-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <span className="rounded-full border border-white/10 bg-white/4 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                    Version {note.version}
                  </span>
                  <h2 className="mt-4 text-2xl font-semibold text-white">{note.title}</h2>
                </div>
                <span className="text-sm text-slate-500">
                  {new Date(note.createdAt).toLocaleDateString('de-DE')}
                </span>
              </div>
              <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                {note.content}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="glass-panel rounded-[1.75rem] px-6 py-12 text-center text-slate-400">
          No patch notes yet.
        </div>
      )}
    </div>
  )
}
