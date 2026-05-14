import '../src/site.css'
import './survey.css'

const BUCKET_QUESTIONS = {
  A: [
    {
      id: 'a1',
      label: 'Was genau ist beim Beitreten oder Einrichten schiefgelaufen?',
      placeholder: 'Zum Beispiel: unklare Schritte, Rollen, Channels, Bot-Nachrichten oder technische Probleme.',
    },
    {
      id: 'a2',
      label: 'Was haettest du dir anders gewuenscht?',
      placeholder: 'Was haette den Einstieg fuer dich leichter oder sinnvoller gemacht?',
    },
  ],
  B: [
    {
      id: 'b1',
      label: 'Was hat letztlich dazu gefuehrt, dass du gegangen bist?',
      placeholder: 'Beschreibe gerne den Hauptgrund oder die Kombination aus mehreren Gruenden.',
    },
    {
      id: 'b2',
      label: 'Was haette dich gehalten?',
      placeholder: 'Welche Aenderung, welches Angebot oder welches Verhalten haette fuer dich einen Unterschied gemacht?',
    },
    {
      id: 'b3',
      label: 'Gab es einen konkreten Ausloeser?',
      placeholder: 'Wenn ja: was ist passiert, und in welchem Kontext?',
    },
  ],
  C: [
    {
      id: 'c1',
      label: 'Was hat dir auf dem Server gefehlt?',
      placeholder: 'Zum Beispiel Inhalte, Leute, Struktur, Aktivitaet oder Orientierung.',
    },
    {
      id: 'c2',
      label: 'Was haette ihn fuer dich interessanter gemacht?',
      placeholder: 'Welche Formate, Bereiche oder Verbesserungen haetten dir gefehlt?',
    },
  ],
}

const EXTRA_QUESTION = {
  id: 'extra',
  label: 'Sonst noch etwas?',
  placeholder: 'Alles, was du uns zusaetzlich mitgeben willst.',
  required: false,
}

const MAX_FILES = 5
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

function syncYear() {
  document.querySelectorAll('[data-current-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear())
  })
}

function setupNavDrawer() {
  const toggle = document.querySelector('[data-menu-toggle]')
  const drawer = document.getElementById('nav-drawer')
  if (!toggle || !drawer) return

  const iconMenu = toggle.querySelector('.icon-menu')
  const iconClose = toggle.querySelector('.icon-close')

  function setDrawerState(open) {
    toggle.setAttribute('aria-expanded', String(open))
    toggle.setAttribute('aria-label', open ? 'Menue schliessen' : 'Menue oeffnen')
    drawer.classList.toggle('is-open', open)
    drawer.setAttribute('aria-hidden', String(!open))
    document.body.classList.toggle('menu-open', open)
    if (iconMenu && iconClose) {
      iconMenu.style.display = open ? 'none' : ''
      iconClose.style.display = open ? '' : 'none'
    }
  }

  toggle.addEventListener('click', () => {
    setDrawerState(!drawer.classList.contains('is-open'))
  })

  drawer.querySelectorAll('[data-menu-close], .nav-drawer-link, .nav-drawer-cta').forEach((node) => {
    node.addEventListener('click', () => setDrawerState(false))
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.classList.contains('is-open')) {
      setDrawerState(false)
    }
  })
}

function buildApiPath(token) {
  return `/api/leave-survey/${encodeURIComponent(token)}`
}

function createStateCard({ eyebrow, title, body, actions = [] }) {
  const card = document.createElement('div')
  card.className = 'survey-card'

  const eyebrowNode = document.createElement('span')
  eyebrowNode.className = 'meta'
  eyebrowNode.textContent = eyebrow

  const titleNode = document.createElement('h2')
  titleNode.textContent = title

  const bodyNode = document.createElement('p')
  bodyNode.textContent = body

  const actionsNode = document.createElement('div')
  actionsNode.className = 'survey-state-actions'

  actions.forEach((action) => {
    const link = document.createElement('a')
    link.className = `button ${action.variant === 'secondary' ? 'button-secondary' : 'button-primary'}`
    link.href = action.href
    link.textContent = action.label
    actionsNode.appendChild(link)
  })

  card.append(eyebrowNode, titleNode, bodyNode)
  if (actions.length > 0) {
    card.appendChild(actionsNode)
  }

  return card
}

function renderState(root, options) {
  root.replaceChildren(createStateCard(options))
}

function renderLoading(root, title = 'Wir bereiten dein Formular vor.') {
  renderState(root, {
    eyebrow: 'Wird geladen',
    title,
    body: 'Einen Moment bitte.',
  })
}

function resolveQuestions(bucket) {
  return BUCKET_QUESTIONS[bucket] ?? BUCKET_QUESTIONS.C
}

function createQuestionField(question) {
  const field = document.createElement('div')
  field.className = 'form-field'

  const label = document.createElement('label')
  label.className = 'form-label'
  label.setAttribute('for', question.id)
  label.textContent = question.label

  const textarea = document.createElement('textarea')
  textarea.className = 'survey-textarea'
  textarea.id = question.id
  textarea.name = question.id
  textarea.rows = 5
  textarea.placeholder = question.placeholder
  textarea.dataset.questionId = question.id
  textarea.required = question.required !== false

  field.append(label, textarea)
  return field
}

function isAllowedImage(file) {
  if (ALLOWED_IMAGE_TYPES.has(file.type)) return true
  const ext = file.name.toLowerCase().split('.').pop()
  return ALLOWED_EXTENSIONS.has(ext)
}

function setInputFiles(input, files) {
  if (typeof DataTransfer === 'undefined') return
  const dataTransfer = new DataTransfer()
  files.forEach((file) => dataTransfer.items.add(file))
  input.files = dataTransfer.files
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('read_error'))
    reader.readAsDataURL(file)
  })
}

function createStatusBanner(type, text) {
  const banner = document.createElement('div')
  banner.className = `status-banner ${type ? `is-${type}` : ''}`.trim()
  banner.textContent = text
  return banner
}

function renderUploadPreview(previewRoot, files, urls) {
  previewRoot.replaceChildren()

  if (files.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'survey-upload-empty'
    empty.textContent = 'Keine Bilder ausgewaehlt.'
    previewRoot.appendChild(empty)
    return
  }

  files.forEach((file, index) => {
    const figure = document.createElement('figure')
    figure.className = 'survey-upload-thumb'

    const image = document.createElement('img')
    image.src = urls[index]
    image.alt = ''
    image.loading = 'lazy'

    const caption = document.createElement('figcaption')
    caption.className = 'survey-upload-caption'
    caption.textContent = file.name

    figure.append(image, caption)
    previewRoot.appendChild(figure)
  })
}

function formatUploadFeedback(messages, acceptedCount) {
  if (messages.length === 0) {
    if (acceptedCount === 0) {
      return {
        text: 'Bis zu 5 Bilder, jeweils maximal 5 MB. Erlaubt: JPG, PNG, WEBP, GIF.',
        type: '',
      }
    }

    return {
      text: `${acceptedCount} Bild${acceptedCount === 1 ? '' : 'er'} bereit zum Upload.`,
      type: '',
    }
  }

  return {
    text: messages.join(' '),
    type: 'error',
  }
}

function createSurveyCard(token, data) {
  const card = document.createElement('div')
  card.className = 'survey-card'

  const intro = document.createElement('div')
  intro.className = 'survey-intro'

  const eyebrow = document.createElement('span')
  eyebrow.className = 'meta'
  eyebrow.textContent = 'Persoenliches Feedback'

  const title = document.createElement('h2')
  title.textContent = `Hallo ${data.display_name || 'du'}`

  const description = document.createElement('p')
  description.textContent = 'Danke, dass du dir noch kurz Zeit nimmst. Je konkreter dein Feedback ist, desto besser koennen wir daraus lernen.'

  intro.append(eyebrow, title, description)

  const form = document.createElement('form')
  form.className = 'survey-form'
  form.noValidate = false

  const questionGrid = document.createElement('div')
  questionGrid.className = 'survey-question-grid'

  resolveQuestions(data.user_bucket).forEach((question) => {
    questionGrid.appendChild(createQuestionField(question))
  })
  questionGrid.appendChild(createQuestionField(EXTRA_QUESTION))

  const uploadField = document.createElement('div')
  uploadField.className = 'form-field'

  const uploadLabel = document.createElement('label')
  uploadLabel.className = 'form-label'
  uploadLabel.setAttribute('for', 'survey-images')
  uploadLabel.textContent = 'Bilder hochladen (optional)'

  const uploadHint = document.createElement('p')
  uploadHint.className = 'form-hint'
  uploadHint.textContent = 'Wenn Screenshots oder Bilder helfen, kannst du sie hier direkt mitsenden.'

  const uploadPanel = document.createElement('div')
  uploadPanel.className = 'survey-upload-panel'

  const uploadMeta = document.createElement('div')
  uploadMeta.className = 'survey-upload-meta'
  uploadMeta.innerHTML = '<span>Max. 5 Bilder</span><span>Je Datei max. 5 MB</span><span>JPG, PNG, WEBP, GIF</span>'

  const fileInput = document.createElement('input')
  fileInput.className = 'survey-file-input'
  fileInput.id = 'survey-images'
  fileInput.name = 'images'
  fileInput.type = 'file'
  fileInput.accept = '.jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif'
  fileInput.multiple = true

  const uploadFeedback = document.createElement('div')
  uploadFeedback.className = 'survey-upload-feedback'
  uploadFeedback.textContent = 'Bis zu 5 Bilder, jeweils maximal 5 MB. Erlaubt: JPG, PNG, WEBP, GIF.'

  const previewRoot = document.createElement('div')
  previewRoot.className = 'survey-upload-grid'
  renderUploadPreview(previewRoot, [], [])

  uploadPanel.append(uploadMeta, fileInput, uploadFeedback, previewRoot)
  uploadField.append(uploadLabel, uploadHint, uploadPanel)

  const statusRoot = document.createElement('div')
  statusRoot.dataset.role = 'status'

  const submitRow = document.createElement('div')
  submitRow.className = 'survey-submit-row'

  const submitButton = document.createElement('button')
  submitButton.className = 'button button-primary survey-button'
  submitButton.type = 'submit'
  submitButton.textContent = 'Feedback absenden'

  const submitNote = document.createElement('p')
  submitNote.className = 'survey-submit-note'
  submitNote.textContent = 'Das Formular kann nur einmal abgeschickt werden.'

  submitRow.append(submitButton, submitNote)

  form.append(intro, questionGrid, uploadField, statusRoot, submitRow)
  card.appendChild(form)

  let selectedFiles = []

  async function updatePreview(files, messages = []) {
    const feedback = formatUploadFeedback(messages, files.length)
    uploadFeedback.textContent = feedback.text
    uploadFeedback.classList.toggle('is-error', feedback.type === 'error')

    const urls = await Promise.all(files.map((file) => readFileAsDataUrl(file)))
    renderUploadPreview(previewRoot, files, urls)
  }

  fileInput.addEventListener('change', async () => {
    const incoming = Array.from(fileInput.files || [])
    const accepted = []
    const messages = []
    let tooMany = false

    incoming.forEach((file) => {
      if (accepted.length >= MAX_FILES) {
        tooMany = true
        return
      }

      if (!isAllowedImage(file)) {
        messages.push(`"${file.name}" ist kein unterstuetztes Bildformat.`)
        return
      }

      if (file.size > MAX_FILE_SIZE) {
        messages.push(`"${file.name}" ist groesser als 5 MB.`)
        return
      }

      accepted.push(file)
    })

    if (tooMany || incoming.length > MAX_FILES) {
      messages.unshift('Es sind maximal 5 Bilder erlaubt.')
    }

    selectedFiles = accepted
    setInputFiles(fileInput, accepted)
    await updatePreview(accepted, messages)
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()

    if (!form.reportValidity()) return

    const answers = {}
    form.querySelectorAll('[data-question-id]').forEach((field) => {
      answers[field.dataset.questionId] = field.value.trim()
    })

    const body = new FormData()
    body.append('answers', JSON.stringify(answers))
    selectedFiles.forEach((file) => body.append('images', file, file.name))

    statusRoot.replaceChildren()
    submitButton.disabled = true
    submitButton.textContent = 'Wird gesendet...'

    try {
      const response = await fetch(buildApiPath(token), {
        method: 'POST',
        body,
      })

      if (response.ok) {
        renderState(document.querySelector('[data-survey-root]'), {
          eyebrow: 'Vielen Dank',
          title: 'Dein Feedback ist angekommen.',
          body: 'Wir lesen alles intern und nutzen es, um den Server sinnvoll zu verbessern.',
          actions: [
            { href: '/', label: 'Zur Startseite', variant: 'secondary' },
          ],
        })
        return
      }

      if (response.status === 404) {
        renderState(document.querySelector('[data-survey-root]'), {
          eyebrow: 'Link ungueltig',
          title: 'Dieser Link ist ungueltig oder abgelaufen.',
          body: 'Bitte nutze nur den aktuellen Link aus deiner Nachricht.',
          actions: [
            { href: '/', label: 'Zur Startseite', variant: 'secondary' },
          ],
        })
        return
      }

      if (response.status === 409) {
        renderState(document.querySelector('[data-survey-root]'), {
          eyebrow: 'Bereits abgeschickt',
          title: 'Danke, dein Feedback ist schon bei uns angekommen.',
          body: 'Der persoenliche Link kann nur einmal verwendet werden.',
          actions: [
            { href: '/', label: 'Zur Startseite', variant: 'secondary' },
          ],
        })
        return
      }

      if (response.status === 413) {
        statusRoot.replaceChildren(createStatusBanner('error', 'Mindestens eine Datei ist zu gross. Erlaubt sind maximal 5 Bilder mit je 5 MB.'))
        return
      }

      let message = 'Beim Absenden ist ein Fehler aufgetreten. Bitte versuche es in ein paar Minuten erneut.'
      try {
        const payload = await response.json()
        if (typeof payload?.error === 'string' && payload.error.trim()) {
          message = payload.error.trim()
        }
      } catch {
        // Fallback auf Standardtext
      }

      statusRoot.replaceChildren(createStatusBanner('error', message))
    } catch {
      statusRoot.replaceChildren(createStatusBanner('error', 'Die Verbindung ist gerade fehlgeschlagen. Bitte versuche es erneut.'))
    } finally {
      submitButton.disabled = false
      submitButton.textContent = 'Feedback absenden'
    }
  })

  return card
}

async function loadSurvey(root, token) {
  renderLoading(root)

  let response
  try {
    response = await fetch(buildApiPath(token), { method: 'GET' })
  } catch {
    renderState(root, {
      eyebrow: 'Verbindung fehlgeschlagen',
      title: 'Die Survey-Seite konnte nicht geladen werden.',
      body: 'Bitte versuche es in ein paar Minuten erneut.',
      actions: [
        { href: '/', label: 'Zur Startseite', variant: 'secondary' },
      ],
    })
    return
  }

  if (response.status === 404) {
    renderState(root, {
      eyebrow: 'Link ungueltig',
      title: 'Dieser Link ist ungueltig oder abgelaufen.',
      body: 'Bitte nutze nur den aktuellen Link aus deiner Nachricht.',
      actions: [
        { href: '/', label: 'Zur Startseite', variant: 'secondary' },
      ],
    })
    return
  }

  if (!response.ok) {
    renderState(root, {
      eyebrow: 'Fehler',
      title: 'Wir konnten dein Formular gerade nicht vorbereiten.',
      body: 'Bitte versuche es spaeter erneut.',
      actions: [
        { href: '/', label: 'Zur Startseite', variant: 'secondary' },
      ],
    })
    return
  }

  const payload = await response.json()

  if (payload?.already_submitted) {
    renderState(root, {
      eyebrow: 'Bereits abgeschickt',
      title: 'Danke, dein Feedback ist schon bei uns angekommen.',
      body: 'Der persoenliche Link kann nur einmal verwendet werden.',
      actions: [
        { href: '/', label: 'Zur Startseite', variant: 'secondary' },
      ],
    })
    return
  }

  root.replaceChildren(createSurveyCard(token, payload))
}

function boot() {
  document.documentElement.classList.add('js')
  syncYear()
  setupNavDrawer()

  const root = document.querySelector('[data-survey-root]')
  if (!root) return

  const token = new URLSearchParams(window.location.search).get('t')?.trim()
  if (!token) {
    renderState(root, {
      eyebrow: 'Kein Token gefunden',
      title: 'Dieser Link ist unvollstaendig.',
      body: 'Bitte oeffne den persoenlichen Survey-Link direkt aus der Nachricht.',
      actions: [
        { href: '/', label: 'Zur Startseite', variant: 'secondary' },
      ],
    })
    return
  }

  loadSurvey(root, token)
}

boot()
