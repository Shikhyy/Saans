import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Chapters } from './components/Chapters'
import { CityDialog } from './components/CityDialog'
import { CityStage } from './components/CityStage'
import { Close } from './components/Close'
import { Copilot } from './components/Copilot'
import { DayPlanner } from './components/DayPlanner'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { HomeLab } from './components/HomeLab'
import { Method } from './components/Method'
import { Nav } from './components/Nav'
import { WardMode } from './components/WardMode'
import { useReducedMotion } from './lib/hooks'
import { initMotion } from './lib/motion'
import { useApp } from './state/app'

gsap.registerPlugin(ScrollTrigger)

function currentPath(): string {
  const path = window.location.pathname.replace(/\/+$/, '')
  return path === '' ? '/' : path
}

export default function App() {
  const { language, t } = useApp()
  const reduced = useReducedMotion()
  const [path, setPath] = useState<string>(currentPath)
  const [cityOpen, setCityOpen] = useState(false)
  const lenisRef = useRef<Lenis | null>(null)
  const pendingHash = useRef<string | null>(null)

  const scrollToId = useCallback((id: string) => {
    const target = document.getElementById(id)
    if (!target) return
    if (lenisRef.current) lenisRef.current.scrollTo(target, { offset: -72 })
    else target.scrollIntoView({ block: 'start' })
  }, [])

  const navigate = useCallback(
    (to: string) => {
      const [rawPath, hash] = to.split('#')
      const nextPath = rawPath === '' || rawPath === undefined ? '/' : rawPath
      if (nextPath === path) {
        window.history.pushState({}, '', to)
        if (hash) scrollToId(hash)
        else window.scrollTo({ top: 0 })
        return
      }
      pendingHash.current = hash ?? null
      window.history.pushState({}, '', to)
      setPath(nextPath)
    },
    [path, scrollToId],
  )

  useEffect(() => {
    const hash = pendingHash.current
    pendingHash.current = null
    const frame = requestAnimationFrame(() => {
      if (hash) scrollToId(hash)
      else window.scrollTo({ top: 0 })
      ScrollTrigger.refresh()
    })
    return () => cancelAnimationFrame(frame)
  }, [path, scrollToId])

  useEffect(() => {
    const onPop = () => {
      setPath(currentPath())
      pendingHash.current = window.location.hash.slice(1) || null
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // One smooth-scroll engine for the whole document, driven by the GSAP ticker.
  useEffect(() => {
    if (reduced) return
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.92, smoothWheel: true })
    lenisRef.current = lenis
    const onScroll = () => ScrollTrigger.update()
    lenis.on('scroll', onScroll)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(tick)
      lenis.off('scroll', onScroll)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [reduced])

  // The motion layer. Rebuilt on route or language change so split text stays in sync with React.
  useLayoutEffect(() => {
    const cleanup = initMotion({ reduced })
    return cleanup
  }, [reduced, path, language])

  // Devanagari only travels over the wire when someone asks for Hindi.
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dataset.lang = language
    if (language === 'hi') {
      void import('@fontsource/mukta/400.css')
      void import('@fontsource/mukta/600.css')
    }
  }, [language])

  return (
    <>
      <a className="skip" href="#main">
        {t('common.skip')}
      </a>

      <Nav path={path} navigate={navigate} onOpenCity={() => setCityOpen(true)} />

      {path === '/method' ? (
        <Method />
      ) : (
        <main id="main">
          <div className="split" id="split">
            <CityStage />
            <div className="split__read">
              <Hero onPlan={() => scrollToId('day')} onOpenMethod={() => navigate('/method')} />
              <Chapters />
            </div>
          </div>
          <DayPlanner />
          <HomeLab />
          <WardMode />
          <Copilot />
          <Close />
        </main>
      )}

      <Footer navigate={navigate} />

      {cityOpen && <CityDialog onClose={() => setCityOpen(false)} />}
    </>
  )
}
