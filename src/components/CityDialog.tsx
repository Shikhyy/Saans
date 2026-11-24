import { useCallback, useEffect, useRef, useState } from 'react'
import { searchCities, type CityResult } from '../data/api'
import { useApp } from '../state/app'

/**
 * The city picker. One field, six results, keyboard first. Choosing a place writes only
 * coordinates, a name and a timezone into the household profile — there is nothing else to store.
 */
export function CityDialog({ onClose }: { onClose: () => void }) {
  const { t, tf, updateProfile, profile } = useApp()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CityResult[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle')
  const panelRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const restoreRef = useRef<Element | null>(null)

  useEffect(() => {
    restoreRef.current = document.activeElement
    inputRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      const target = restoreRef.current
      if (target instanceof HTMLElement) target.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, input, a[href], [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setStatus('idle')
      return
    }
    const controller = new AbortController()
    setStatus('loading')
    const timer = window.setTimeout(() => {
      searchCities(term, controller.signal)
        .then((places) => {
          if (controller.signal.aborted) return
          setResults(places)
          setStatus(places.length === 0 ? 'empty' : 'idle')
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setStatus('error')
        })
    }, 280)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  const choose = useCallback(
    (place: CityResult) => {
      updateProfile({
        city: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: place.timezone || 'auto',
      })
      onClose()
    },
    [onClose, updateProfile],
  )

  return (
    <div
      className="dialog"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="city-dialog-title"
        ref={panelRef}
      >
        <div className="dialog__head">
          <h2 className="dialog__title" id="city-dialog-title">
            {t('nav.city')}
          </h2>
          <button className="btn btn--quiet" type="button" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>

        <p className="note">{tf('common.cityNote', { city: profile.city })}</p>

        <form
          className="search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            const first = results[0]
            if (first) choose(first)
          }}
        >
          <label className="sr-only" htmlFor="city-input">
            {t('common.search')}
          </label>
          <input
            id="city-input"
            ref={inputRef}
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Delhi, Patna, Ludhiana…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="btn btn--primary" type="submit" disabled={results.length === 0}>
            {t('common.search')}
          </button>
        </form>

        <div className="results" aria-live="polite">
          {status === 'loading' && <p className="note">{t('common.searching')}</p>}
          {status === 'empty' && <p className="note">{t('common.noMatch')}</p>}
          {status === 'error' && <p className="note">{t('common.error')}</p>}
          {results.map((place) => (
            <button className="result" key={place.id} type="button" onClick={() => choose(place)}>
              <span>{place.name}</span>
              <span className="result__meta">
                {[place.admin1, place.country].filter(Boolean).join(', ')}
              </span>
            </button>
          ))}
        </div>

        <p className="note">{t('common.cityPrivacy')}</p>
      </div>
    </div>
  )
}
