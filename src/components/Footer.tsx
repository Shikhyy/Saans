import { useApp } from '../state/app'

export interface FooterProps {
  navigate: (to: string) => void
}

const CREDITS = [
  'Delhi Smog, AnkClix, CC BY-SA 4.0',
  'Smog at New Delhi Railway station, Sumita Roy Dutta, CC BY-SA 4.0',
  'Smog in the Gurgaon area near Delhi, CC BY-SA 4.0',
  'Chulha, North India, Hk31122002, CC BY-SA 4.0',
  'Humayun’s Tomb in winter fog, Rohit Agarwal, CC BY-SA 4.0',
]

export function Footer({ navigate }: FooterProps) {
  const { t, tf, profile } = useApp()

  const go = (to: string) => (event: React.MouseEvent) => {
    event.preventDefault()
    navigate(to)
  }

  return (
    <footer className="footer">
      <div className="footer__plate">
        <img
          src="/img/tomb-900.jpg"
          srcSet="/img/tomb-520.jpg 520w, /img/tomb-900.jpg 900w, /img/tomb-1600.jpg 1600w"
          sizes="(max-width: 900px) 100vw, 50vw"
          width={900}
          height={600}
          alt="Humayun’s Tomb in Delhi behind palm trees on a foggy winter morning."
          loading="lazy"
          decoding="async"
        />
      </div>

      <div className="footer__menu">
        <p className="footer__mark">SAANS</p>

        <nav className="footer__links" aria-label={t('footer.menu')}>
          <a href="/#day" onClick={go('/#day')}>
            {t('nav.day')}
          </a>
          <a href="/#home" onClick={go('/#home')}>
            {t('nav.home')}
          </a>
          <a href="/#ward" onClick={go('/#ward')}>
            {t('nav.ward')}
          </a>
          <a href="/#plan" onClick={go('/#plan')}>
            {t('plan.title')}
          </a>
          <a href="/method" onClick={go('/method')}>
            {t('nav.method')}
          </a>
        </nav>

        <div className="footer__blocks">
          <div>
            <h3>{t('footer.data')}</h3>
            <a href="/method#data" onClick={go('/method#data')}>
              {t('footer.sources')}
            </a>
            <br />
            <a href="/method#security" onClick={go('/method#security')}>
              {t('footer.security')}
            </a>
            <br />
            <a href="/method#access" onClick={go('/method#access')}>
              {t('footer.access')}
            </a>
          </div>
          <div>
            <h3>{t('footer.pictures')}</h3>
            <ul className="credits">
              {CREDITS.map((credit) => (
                <li key={credit}>{credit}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="footer__legal">
          <p>{tf('footer.reading', { city: profile.city })}</p>
          <p>{t('footer.disclaimer')}</p>
          <p>{t('footer.credit')}</p>
        </div>
      </div>
    </footer>
  )
}
