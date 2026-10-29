/** Shared layout primitives used across landing sections. */
import type { ReactNode, HTMLAttributes } from 'react'

/** Full-width section with scroll-margin so sticky nav doesn't hide the heading. */
export function Section({
  id,
  children,
  className = '',
  ...rest
}: HTMLAttributes<HTMLElement> & { id?: string; children: ReactNode; className?: string }) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-heading` : undefined}
      className={className}
      style={{ scrollMarginTop: '72px' }}
      {...rest}
    >
      {children}
    </section>
  )
}

/** Page-width container: max 1120px, 24px side padding. */
export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{ maxWidth: 1120, margin: '0 auto', paddingLeft: 24, paddingRight: 24 }}
    >
      {children}
    </div>
  )
}

/** Two-tone headline: first part ivory, second part muted. */
export function TwoTone({
  first,
  muted,
  as: Tag = 'h2',
  id,
  style,
}: {
  first: string
  muted: string
  as?: 'h1' | 'h2' | 'h3'
  id?: string
  style?: React.CSSProperties
}) {
  return (
    <Tag id={id} style={{ margin: 0, ...style }}>
      <span style={{ color: 'var(--text)' }}>{first} </span>
      <span style={{ color: 'var(--text-muted)' }}>{muted}</span>
    </Tag>
  )
}

/** Uppercase section label. */
export function Label({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--paid)',
        margin: 0,
      }}
    >
      {children}
    </p>
  )
}

/** Surface card with radius and 1px border. */
export function Card({
  children,
  radius = 28,
  padding = 28,
  style,
  className = '',
}: {
  children: ReactNode
  radius?: number
  padding?: number
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: radius,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** Primary green CTA button (renders as <a> or <button>). */
export function PrimaryButton({
  href,
  children,
  style,
}: {
  href?: string
  children: ReactNode
  style?: React.CSSProperties
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    padding: '0 28px',
    background: 'var(--paid)',
    color: '#0B0B0C',
    fontWeight: 700,
    fontSize: 15,
    borderRadius: 24,
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    minWidth: 140,
    ...style,
  }
  if (href) {
    return <a href={href} style={base}>{children}</a>
  }
  return <button type="button" style={base}>{children}</button>
}

/** Ghost outline button. */
export function OutlineButton({
  href,
  children,
}: {
  href?: string
  children: ReactNode
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    padding: '0 28px',
    background: 'transparent',
    color: 'var(--text)',
    fontWeight: 600,
    fontSize: 15,
    borderRadius: 24,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    minWidth: 140,
  }
  if (href) return <a href={href} style={base}>{children}</a>
  return <button type="button" style={base}>{children}</button>
}
