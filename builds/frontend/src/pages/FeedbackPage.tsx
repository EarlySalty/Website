import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'

export default function FeedbackPage() {
  const { user, login } = useAuth()
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Submit to API
    console.log('Feedback submitted:', message)
    setSubmitted(true)
    setMessage('')
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Feedback</h1>
        <p className="text-gray-400 mb-6">Please login with Discord to submit feedback.</p>
        <button
          onClick={login}
          className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-3 rounded font-medium transition"
        >
          Login with Discord
        </button>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-4">Feedback Submitted!</h1>
        <p className="text-gray-400 mb-6">Thank you for your feedback.</p>
        <button
          onClick={() => setSubmitted(false)}
          className="text-accent-cyan hover:underline"
        >
          Submit another
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Feedback</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Your Feedback</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="w-full bg-bg-card border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent-violet"
            placeholder="Tell us what's on your mind..."
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-accent-violet hover:bg-accent-violet/80 text-white py-3 rounded font-medium transition"
        >
          Submit Feedback
        </button>
      </form>
    </div>
  )
}