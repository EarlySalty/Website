const D = window.AUDIT_DATA;
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 0) => Number(n || 0).toLocaleString('de-DE', {maximumFractionDigits: d, minimumFractionDigits: d});
const sum = (arr, key) => arr.reduce((a, r) => a + Number(r[key] || 0), 0);
const byDay = (arr, key) => Object.fromEntries(arr.map(r => [r.day, Number(r[key] || 0)]));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

$('generatedAt').textContent = D.generatedAt;

function stat(value, label) {
  return `<div class="stat"><b>${value}</b><span>${label}</span></div>`;
}

$('stats').innerHTML = [
  stat(fmt(D.summary.reportCommits), 'Commits im Bericht'),
  stat(fmt(D.summary.codingHours, 1) + ' h', 'ca. Codex-/Claude-Codingzeit'),
  stat(fmt(D.summary.impactPeople), 'Impact-Team Personen'),
  stat(fmt(D.summary.modTimelinePeople), 'Mods im Zeitgraph'),
  stat(fmt(D.summary.moderationActions), 'harte Mod-/Server-Auditaktionen'),
  stat(fmt(D.summary.voiceHours, 1) + ' h', 'Team Voice-Präsenz'),
  stat(fmt(D.summary.naniDiscordMessages), 'Nani Discord-Chatnachrichten'),
  stat(fmt(D.summary.naniTwitchMessages), 'earlysalty Twitch-Chatnachrichten'),
  stat(fmt(D.summary.pitchHits), 'earlysalty Pitch-/Community-Treffer'),
  stat(fmt(D.summary.pitchedStreamers), 'gepitchte Twitch-Kanäle'),
  stat(fmt(D.summary.newPartners), 'neue Twitch-Partner'),
  stat(fmt(D.summary.directPitchConversions), 'Pitch→Partner am selben/danach Tag')
].join('');

function level(v, max) {
  if (!v || !max) return 0;
  return Math.max(1, Math.min(5, Math.ceil((v / max) * 5)));
}

function renderHeatmap() {
  const maps = {
    'Code-Commits': byDay(D.gitDaily, 'commits'),
    'Coding-h': byDay(D.codingDaily, 'hours'),
    'Discord-Chat': {},
    'Voice-h': {},
    'Auditlog': {},
    'Twitch-Chat': {},
    'Pitch': {},
    'Partner+': {}
  };
  D.central.text_daily.forEach(r => maps['Discord-Chat'][r.day] = (maps['Discord-Chat'][r.day] || 0) + r.messages);
  D.central.voice_daily.forEach(r => maps['Voice-h'][r.day] = (maps['Voice-h'][r.day] || 0) + r.hours);
  D.central.audit_daily.forEach(r => maps['Auditlog'][r.day] = (maps['Auditlog'][r.day] || 0) + r.actions);
  D.twitch.team_chat_daily.forEach(r => maps['Twitch-Chat'][r.day] = (maps['Twitch-Chat'][r.day] || 0) + r.messages);
  D.twitch.pitch_daily.forEach(r => maps['Pitch'][r.day] = (maps['Pitch'][r.day] || 0) + r.hits);
  D.twitch.partnered_daily.forEach(r => maps['Partner+'][r.day] = r.count);

  const htmlRows = Object.entries(maps).map(([label, values]) => {
    const max = Math.max(...D.days.map(d => values[d] || 0), 1);
    const cells = D.days.map(d => `<span class="cell" data-level="${level(values[d] || 0, max)}" title="${d}: ${fmt(values[d] || 0, 1)}"></span>`).join('');
    return `<div class="heat-row"><div class="heat-label">${label}</div>${cells}</div>`;
  });
  $('heatmap').innerHTML = htmlRows.join('');
}

function renderModHeatmap() {
  const rows = D.modTimeline || [];
  const metrics = [
    ['Discord-Chat', 'messages', ''],
    ['Voice-h', 'voiceHours', 'h'],
    ['Mod-Audit', 'auditActions', ''],
    ['Twitch-Chat', 'twitchMessages', ''],
    ['Pitch', 'pitchHits', '']
  ];
  const maxByMetric = Object.fromEntries(metrics.map(([, key]) => [key, Math.max(...rows.flatMap(r => r.days.map(d => Number(d[key] || 0))), 1)]));
  $('modHeatmap').innerHTML = rows.map(r => {
    const metricRows = metrics.map(([label, key, suffix]) => {
      const cells = r.days.map(d => `<span class="cell" data-level="${level(d[key] || 0, maxByMetric[key])}" title="${d.day}: ${label} ${fmt(d[key] || 0, key === 'voiceHours' ? 1 : 0)}${suffix}"></span>`).join('');
      return `<div class="mod-row"><div class="heat-label">${label}</div>${cells}</div>`;
    }).join('');
    return `<div class="mod-block"><div class="mod-title"><strong>${esc(r.name)}</strong><span>${esc(r.role)} · ${fmt(r.activeDays)} aktive Tage · ca. ${fmt(r.estimatedHours,1)} h</span></div><div class="mod-grid">${metricRows}</div></div>`;
  }).join('');
}

function renderNaniHeatmap() {
  const row = D.naniTimeline;
  const metrics = [
    ['Coding-h', 'codingHours', 'h'],
    ['Discord-Chat', 'messages', ''],
    ['Voice-h', 'voiceHours', 'h'],
    ['Mod-Audit', 'auditActions', ''],
    ['Twitch-Chat', 'twitchMessages', ''],
    ['Pitch', 'pitchHits', '']
  ];
  const maxByMetric = Object.fromEntries(metrics.map(([, key]) => [key, Math.max(...row.days.map(d => Number(d[key] || 0)), 1)]));
  const metricRows = metrics.map(([label, key, suffix]) => {
    const cells = row.days.map(d => `<span class="cell" data-level="${level(d[key] || 0, maxByMetric[key])}" title="${d.day}: ${label} ${fmt(d[key] || 0, key.toLowerCase().includes('hours') ? 1 : 0)}${suffix}"></span>`).join('');
    return `<div class="mod-row"><div class="heat-label">${label}</div>${cells}</div>`;
  }).join('');
  $('naniHeatmap').innerHTML = `<div class="mod-block"><div class="mod-title"><strong>${esc(row.name)}</strong><span>${esc(row.role)}</span></div><div class="mod-grid">${metricRows}</div></div>`;
}

function renderTaskProfiles() {
  const profiles = D.taskProfiles || [];
  $('taskProfiles').innerHTML = profiles.map(p => {
    const primary = (p.primaryTasks || []).length
      ? p.primaryTasks.map(t => `<span class="pill">${esc(t)}</span>`).join(' ')
      : '<span class="muted">keine Aktivität im Zeitraum</span>';
    const tasks = (p.tasks || []).map(t => {
      const width = Math.max(0, Math.min(100, Number(t.share || 0)));
      return `<div class="task-line" title="${esc(t.source)}"><label>${esc(t.task)}</label><div class="track"><span class="fill" style="--w:${width}%"></span></div><output>${esc(t.raw)}</output></div>`;
    }).join('');
    const channels = (p.topChannels || []).map(c => `<span class="pill" title="${esc(c.channel_id)}">${esc(c.label)} · ${fmt(c.messages)}</span>`).join(' ') || '<span class="muted">keine Chatkanäle</span>';
    const audits = (p.topAuditTypes || []).map(a => `<span class="pill">${esc(a.label)} · ${fmt(a.actions)}</span>`).join(' ') || '<span class="muted">keine Audit-Aktionen</span>';
    return `<article class="profile">
      <div class="profile-head"><div><strong>${esc(p.name)}</strong><div class="mini">${esc(p.role)}</div></div><output>${fmt(p.estimatedHours,1)} h</output></div>
      <div class="chips">${primary}</div>
      <div class="task-list">${tasks}</div>
      <div class="source-row">Top-Chatkanäle</div><div class="chips">${channels}</div>
      <div class="source-row">Häufigste Auditlog-Aktionen</div><div class="chips">${audits}</div>
    </article>`;
  }).join('');
}

function renderBars(id, rows, labelKey, valueKey, suffix = '') {
  const max = Math.max(...rows.map(r => Number(r[valueKey] || 0)), 1);
  $(id).innerHTML = rows.map(r => {
    const v = Number(r[valueKey] || 0);
    return `<div class="bar"><label title="${esc(r[labelKey])}">${esc(r[labelKey])}</label><div class="track"><span class="fill" style="--w:${(v / max) * 100}%"></span></div><output>${fmt(v, valueKey.toLowerCase().includes('hours') ? 1 : 0)}${suffix}</output></div>`;
  }).join('');
}

function renderTeam() {
  const rows = D.team.filter(r => r.isImpactTeam && (r.estimatedHours > 0 || r.auditActions > 0));
  $('teamMatrix').innerHTML = `<table><thead><tr><th>Person</th><th>Rolle</th><th>Bereiche</th><th class="num">ca. h</th><th class="num">Discord</th><th class="num">Voice h</th><th class="num">Mod-Audit</th><th class="num">Twitch</th><th class="num">Pitch</th><th class="num">Code h</th></tr></thead><tbody>${rows.map(r => `<tr><td><strong>${esc(r.name)}</strong><div class="mini">${r.source === 'audit' ? 'per Auditlog erkannt' : 'bekannte Teamrolle'}</div></td><td>${esc(r.role)}</td><td>${(r.impactAreas || []).map(a => `<span class="pill">${esc(a)}</span>`).join(' ')}</td><td class="num">${fmt(r.estimatedHours,1)}</td><td class="num">${fmt(r.textMessages)}</td><td class="num">${fmt(r.voiceHours,1)}</td><td class="num">${fmt(r.auditActions)}</td><td class="num">${fmt(r.twitchMessages)}</td><td class="num">${fmt(r.pitchHits)}</td><td class="num">${fmt(r.codingHours,1)}</td></tr>`).join('')}</tbody></table>`;
}

function renderImpactSections() {
  renderBars('roleImpact', D.teamSummary.roleGroups, 'group', 'estimatedHours', ' h');
  renderBars('auditTypes', D.auditTypeTotals.slice(0, 12), 'label', 'actions');
  renderBars('coverage', [
    {name: 'aktive Impact-Personen', value: D.teamSummary.coverage.impactPeople},
    {name: 'bekannte Rollenliste', value: D.teamSummary.coverage.knownTeam},
    {name: 'per Auditlog ergänzt', value: D.teamSummary.coverage.auditDiscovered}
  ], 'name', 'value');
  const metrics = [
    ['estimatedHours', 'Gesamtlast', ' h'],
    ['auditActions', 'Moderation/Audit', ''],
    ['voiceHours', 'Voice/Betreuung', ' h'],
    ['textMessages', 'Discord-Chat', ''],
    ['pitchHits', 'Pitches', ''],
    ['twitchMessages', 'Twitch-Chat', '']
  ];
  $('taskLeaders').innerHTML = metrics.map(([key, label, suffix]) => {
    const rows = D.teamSummary.topByMetric[key] || [];
    return `<div class="leader"><h3>${label}</h3><ol>${rows.map(r => `<li><strong>${esc(r.name)}</strong> <span class="muted">${fmt(r.value, key.toLowerCase().includes('hours') ? 1 : 0)}${suffix}</span></li>`).join('')}</ol></div>`;
  }).join('');
}

function renderCodeTimeline() {
  const max = Math.max(...D.gitDaily.map(r => r.commits), 1);
  $('codeTimeline').innerHTML = D.gitDaily.map((r, i) => {
    const h = Math.max(2, (r.commits / max) * 118);
    const hours = D.codingDaily[i]?.hours || 0;
    return `<span class="daybar" style="height:${h}px" title="${r.day}: ${r.commits} Commits, ca. ${fmt(hours,1)} h"></span>`;
  }).join('');
}

function renderPitchPartners() {
  const rows = D.twitch.early_pitch_to_partner.filter(r => r.partnered_day || r.pitch_hits >= 3).slice(0, 30);
  $('pitchPartners').innerHTML = `<table><thead><tr><th>Streamer</th><th>Pitch</th><th>Partner</th><th class="num">Delta</th><th class="num">Treffer</th><th>Beleg-Treffer</th></tr></thead><tbody>${rows.map(r => {
    const delta = r.days_to_partner === null ? 'offen' : (r.days_to_partner < 0 ? 'vor Pitch' : `${r.days_to_partner} Tage`);
    const snippets = (r.snippets || []).map(s => `<span class="pill" title="${esc(s.snippet)}">${esc(s.day)} · ${esc(s.snippet)}</span>`).join(' ');
    return `<tr><td><strong>${esc(r.streamer_login)}</strong><div class="mini">${fmt(r.stream_hours,1)} Stream-h · ${fmt(r.unique_chatters)} Chatters</div></td><td>${esc(r.first_pitch)} bis ${esc(r.last_pitch)}</td><td>${r.partnered_day ? esc(r.partnered_day) : '<span class="muted">noch offen/kein Partnerdatensatz</span>'}</td><td class="num">${esc(delta)}</td><td class="num">${fmt(r.pitch_hits)}</td><td>${snippets || '<span class="muted">Snippet gefiltert</span>'}</td></tr>`;
  }).join('')}</tbody></table>`;
}

function renderDayLog() {
  const gitMap = Object.fromEntries(D.gitDaily.map(r => [r.day, r]));
  const active = D.dayLog.filter(d => (d.git?.commits || 0) || d.codingHours || d.text || d.voice || d.audit || d.twitchChat || d.pitch || d.newStreamers || d.partners).reverse();
  $('dayLog').innerHTML = active.map(d => {
    const git = gitMap[d.day] || d.git || {commits: 0, features: [], repoCounts: {}, items: []};
    const repo = Object.entries(git.repoCounts || {}).map(([k,v]) => `<span class="pill">${esc(k)} ${fmt(v)}</span>`).join('');
    const features = (git.features || []).map(f => `<span class="pill">${esc(f)}</span>`).join('');
    const commits = (git.items || []).map(c => `<li><b>${esc(c.repo)}</b> ${esc(c.hash)} · ${esc(c.subject)}</li>`).join('');
    const people = (rows, key, suffix='') => (rows || []).map(r => `<span class="pill">${esc(r.name || r.login)} ${fmt(r[key], key === 'hours' ? 1 : 0)}${suffix}</span>`).join('') || '<span class="muted">keine sichtbaren Treffer</span>';
    return `<details>
      <summary>${d.day} · ${fmt(git.commits)} Commits · ca. ${fmt(d.codingHours || 0,1)} h Coding · ${d.partners ? '+' + d.partners.count + ' Partner' : 'kein Partner+'}</summary>
      <div class="daybody">
        <div>
          <div class="mini">Coding-Features</div><div class="chips">${features || '<span class="muted">keine Coding-Features</span>'}</div>
          <div class="mini">Repos</div><div class="chips">${repo || '<span class="muted">keine Commits</span>'}</div>
          <ol class="commit-list">${commits || '<li>Keine Commits</li>'}</ol>
        </div>
        <div>
          <div class="mini">Discord-Chat</div><div class="chips">${people(d.text, 'messages')}</div>
          <div class="mini">Voice</div><div class="chips">${people(d.voice, 'hours', 'h')}</div>
          <div class="mini">Auditlog</div><div class="chips">${people(d.audit, 'actions')}</div>
          <div class="mini">Twitch-Chat</div><div class="chips">${people(d.twitchChat, 'messages')}</div>
          <div class="mini">Pitch-Treffer</div><div class="chips">${people(d.pitch, 'hits')}</div>
          <div class="mini">Streamer/Partner</div><div class="chips">${d.newStreamers ? `<span class="pill">Neue Streamer: ${esc(d.newStreamers.streamers)}</span>` : ''}${d.partners ? `<span class="pill">Neue Partner: ${esc(d.partners.streamers)}</span>` : ''}</div>
        </div>
      </div>
    </details>`;
  }).join('');
}

renderHeatmap();
renderNaniHeatmap();
renderModHeatmap();
renderTaskProfiles();
renderTeam();
renderImpactSections();
renderBars('repoBars', D.repos, 'repo', 'commits');
renderCodeTimeline();
renderBars('twitchFunnel', [
  {name: 'neue Streamer', value: D.summary.newStreamers},
  {name: 'neue Partner', value: D.summary.newPartners},
  {name: 'Pitch-Kanäle earlysalty', value: D.summary.pitchedStreamers},
  {name: 'direkte Pitch→Partner', value: D.summary.directPitchConversions},
  {name: 'Recruitment-Raids', value: D.summary.recruitmentRaids}
], 'name', 'value');
renderBars('pitchActors', D.twitch.pitch_by_login.slice(0, 10), 'login', 'hits');
renderBars('streamOps', D.twitch.top_streams.slice(0, 10), 'streamer', 'streams');
renderPitchPartners();
renderDayLog();
