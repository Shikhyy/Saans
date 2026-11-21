import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * One motion system for the whole page.
 *
 * Entrances are driven by an IntersectionObserver rather than a scroll trigger: an observer fires
 * however the reader arrives at a section — a flick, an anchor jump, a restored scroll position —
 * where a scroll-range trigger can be skipped in a single large jump and leave content hidden.
 * ScrollTrigger is kept only for the scrubbed parallax, which genuinely needs scroll progress.
 *
 * Rules: transform and opacity only; every entrance runs once; content is visible without script
 * and under reduced motion; split text keeps an unsplit accessible name; cleanup restores the DOM.
 */

gsap.registerPlugin(ScrollTrigger)

const EASE = 'power4.out'

function splitWords(element: HTMLElement): HTMLElement[] {
  const text = element.textContent ?? ''
  if (element.dataset.motionSplit === 'true') {
    return Array.from(element.querySelectorAll<HTMLElement>('.motion-word'))
  }
  element.dataset.motionOriginal = text
  element.dataset.motionSplit = 'true'
  element.setAttribute('aria-label', text.trim())
  element.textContent = ''

  const words: HTMLElement[] = []
  for (const part of text.split(/(\s+)/)) {
    if (!part.trim()) {
      element.appendChild(document.createTextNode(part))
      continue
    }
    const mask = document.createElement('span')
    mask.className = 'motion-word-mask'
    mask.setAttribute('aria-hidden', 'true')
    const word = document.createElement('span')
    word.className = 'motion-word'
    word.textContent = part
    mask.appendChild(word)
    element.appendChild(mask)
    words.push(word)
  }
  return words
}

function restoreSplits(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-motion-split="true"]').forEach((element) => {
    const original = element.dataset.motionOriginal
    if (original !== undefined) element.textContent = original
    delete element.dataset.motionSplit
    delete element.dataset.motionOriginal
    element.removeAttribute('aria-label')
  })
}

export interface MotionOptions {
  reduced: boolean
}

export function initMotion({ reduced }: MotionOptions): () => void {
  const root = document.documentElement
  const targets = '[data-motion], [data-reveal], [data-reveal-item], [data-image-reveal]'

  if (reduced) {
    root.classList.remove('has-motion')
    gsap.set(targets, { clearProps: 'all' })
    return () => undefined
  }

  root.classList.add('has-motion')

  const tweens: gsap.core.Tween[] = []
  const timelines: gsap.core.Timeline[] = []
  const plays = new Map<Element, { play: () => void; finish: () => void }>()
  const cleanups: (() => void)[] = []

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const entryPlay = plays.get(entry.target)
        if (!entryPlay) continue
        plays.delete(entry.target)
        observer.unobserve(entry.target)
        // A section the reader has already gone past lands in its final state at once, so a fast
        // flick or an anchor jump never leaves a half-faded block behind.
        if (entry.boundingClientRect.top < 0) entryPlay.finish()
        else entryPlay.play()
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0 },
  )

  const enqueue = (element: Element, animation: gsap.core.Tween | gsap.core.Timeline): void => {
    plays.set(element, { play: () => animation.play(), finish: () => animation.progress(1) })
    observer.observe(element)
  }

  // 1. Headlines, word by word, out of a mask.
  gsap.utils.toArray<HTMLElement>('[data-motion="words"]').forEach((element) => {
    const words = splitWords(element)
    gsap.set(element, { autoAlpha: 1 })
    const tween = gsap.fromTo(
      words,
      { yPercent: 110, autoAlpha: 0 },
      { yPercent: 0, autoAlpha: 1, duration: 0.95, ease: EASE, stagger: 0.05, paused: true },
    )
    tweens.push(tween)
    enqueue(element, tween)
  })

  // 2. Every section's parts, in reading order. These travel but never fade: a block of text
  //    must be readable the instant it is on screen, however fast the reader arrives at it.
  gsap.utils.toArray<HTMLElement>('[data-reveal-group]').forEach((group) => {
    const items = group.querySelectorAll<HTMLElement>('[data-reveal-item]')
    if (items.length === 0) return
    gsap.set(group, { autoAlpha: 1 })
    const tween = gsap.fromTo(
      items,
      { y: 28 },
      { y: 0, duration: 0.9, ease: EASE, stagger: 0.08, paused: true },
    )
    tweens.push(tween)
    enqueue(group, tween)
  })

  gsap.utils.toArray<HTMLElement>('[data-reveal]:not([data-reveal-item])').forEach((element) => {
    gsap.set(element, { autoAlpha: 1 })
    const tween = gsap.fromTo(
      element,
      { y: 26 },
      { y: 0, duration: 0.9, ease: EASE, paused: true },
    )
    tweens.push(tween)
    enqueue(element, tween)
  })

  // 3. Photographs open from the bottom edge, then settle.
  gsap.utils.toArray<HTMLElement>('[data-image-reveal]').forEach((figure) => {
    const media = figure.querySelector<HTMLElement>('img, canvas')
    gsap.set(figure, { autoAlpha: 1 })
    const timeline = gsap.timeline({ paused: true })
    timeline
      .fromTo(
        figure,
        { clipPath: 'inset(0 0 100% 0)' },
        { clipPath: 'inset(0 0 0% 0)', duration: 1.15, ease: EASE },
      )
      .fromTo(
        media ?? figure,
        { scale: 1.1, autoAlpha: 0.6 },
        { scale: 1, autoAlpha: 1, duration: 1.3, ease: EASE },
        0,
      )
    timelines.push(timeline)
    enqueue(figure, timeline)
  })

  // 4. One moving picture: the closing plate drifts slower than the page.
  const context = gsap.context(() => {
    const wide = window.matchMedia('(min-width: 901px)').matches
    if (!wide) return
    gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((layer) => {
      const speed = Number(layer.dataset.parallax ?? '0.12')
      const section = layer.closest<HTMLElement>('[data-parallax-section]') ?? layer
      gsap.to(layer, {
        yPercent: -speed * 100,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.2,
          invalidateOnRefresh: true,
        },
      })
    })
  })

  // 5. Feedback: the primary action leans towards the pointer.
  if (!window.matchMedia('(pointer: coarse)').matches) {
    gsap.utils.toArray<HTMLElement>('[data-magnetic]').forEach((element) => {
      const strength = Number(element.dataset.magnetic ?? '0.16')
      const xTo = gsap.quickTo(element, 'x', { duration: 0.45, ease: 'power3.out' })
      const yTo = gsap.quickTo(element, 'y', { duration: 0.45, ease: 'power3.out' })
      const move = (event: PointerEvent) => {
        const rect = element.getBoundingClientRect()
        xTo((event.clientX - rect.left - rect.width / 2) * strength)
        yTo((event.clientY - rect.top - rect.height / 2) * strength)
      }
      const leave = () => {
        xTo(0)
        yTo(0)
      }
      element.addEventListener('pointermove', move)
      element.addEventListener('pointerleave', leave)
      cleanups.push(() => {
        element.removeEventListener('pointermove', move)
        element.removeEventListener('pointerleave', leave)
        gsap.set(element, { x: 0, y: 0 })
      })
    })
  }

  const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 180)

  return () => {
    window.clearTimeout(refresh)
    observer.disconnect()
    plays.clear()
    for (const tween of tweens) tween.kill()
    for (const timeline of timelines) timeline.kill()
    for (const cleanup of cleanups) cleanup()
    context.revert()
    gsap.set(targets, { clearProps: 'all' })
    restoreSplits(document)
    root.classList.remove('has-motion')
  }
}
