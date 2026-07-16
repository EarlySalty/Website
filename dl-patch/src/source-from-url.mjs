export function sourceFromUrl(url) {
  try {
    const hostname = new URL(String(url ?? '')).hostname
    if (hostname === 'store.steampowered.com') return 'steam'
    if (hostname === 'forums.playdeadlock.com') return 'forum'
  } catch {
    return 'other'
  }
  return 'other'
}
