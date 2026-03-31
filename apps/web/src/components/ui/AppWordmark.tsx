import { APP_TITLE } from '@/lib/branding'

interface AppWordmarkProps {
  align?: 'left' | 'center'
  subtitle?: string
  titleClassName?: string
  subtitleClassName?: string
}

export function AppWordmark({
  align = 'center',
  subtitle,
  titleClassName,
  subtitleClassName,
}: AppWordmarkProps) {
  return (
    <div style={{ textAlign: align }}>
      <div
        className={titleClassName}
        style={{
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: '-0.05em',
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(34,139,230,0.85) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          lineHeight: 1,
        }}
      >
        {APP_TITLE}
      </div>
      {subtitle ? (
        <div
          className={subtitleClassName}
          style={{
            marginTop: 8,
            fontSize: 11.5,
            fontWeight: 500,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.28)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  )
}
