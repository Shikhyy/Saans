import { useEffect, useState } from 'react'
import { useApp } from '../state/app'
import type { Language } from '../lib/i18n'

export interface NavProps {
  path: string
  navigate: (to: string) => void
  onOpenCity: () => void
}

export function Nav({ path, navigate, onOpenCity }: NavProps) {
  const { profile, updateProfile, t, language } = useApp()
  const [solid, setSolid] = useState(false)
  const [away, setAway] = useState(false)

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 80)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // The footer is its own menu. Keeping the fixed bar on top of it duplicates every link and
  // covers the wordmark, so the bar leaves as the footer arrives.
  useEffect(() => {
    const footer = document.querySelector('footer')
    if (!footer) return
    const observer = new IntersectionObserver(
      ([entry]) => setAway(Boolean(entry?.isIntersecting)),
      { threshold: 0.12 },
    )
    observer.observe(footer)
    return () => observer.disconnect()
  }, [path])

  const go = (to: string) => (event: React.MouseEvent) => {
    event.preventDefault()
    navigate(to)
  }

  const nextLanguage: Language = language === 'en' ? 'hi' : 'en'

  return (
    <header
      className="nav"
      data-solid={solid || path !== '/'}
      data-away={away}
      inert={away || undefined}
    >
      <div className="shell nav__inner">
        <a className="nav__mark" href="/" onClick={go('/')} aria-label="SAANS home">
          SAANS
        </a>
        <nav className="nav__links" aria-label="Sections">
          <a href="/#day" onClick={go('/#day')}>
            {t('nav.day')}
          </a>
          <a href="/#home" onClick={go('/#home')}>
            {t('nav.home')}
          </a>
          <a href="/#ward" onClick={go('/#ward')}>
            {t('nav.ward')}
          </a>
          <a href="/method" onClick={go('/method')}>
            {t('nav.method')}
          </a>
        </nav>
        <div className="nav__actions">
          <button className="chip" type="button" onClick={onOpenCity}>
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none">
              <path
                d="M8 15s5-4.6 5-8.5A5 5 0 1 0 3 6.5C3 10.4 8 15 8 15Z"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <circle cx="8" cy="6.4" r="1.9" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            {profile.city}
          </button>
          <button
            className="chip"
            type="button"
            onClick={() => updateProfile({ language: nextLanguage })}
            aria-label={`Switch language to ${nextLanguage === 'hi' ? 'Hindi' : 'English'}`}
          >
            {t('nav.language')}
          </button>
        </div>
      </div>
    </header>
  )
}
