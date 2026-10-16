export type SeoSnapshot = {
  url?: string | null
  title?: string | null
  description?: string | null
  robots?: string | null
  canonical?: string | null
  language?: string | null
  h1?: string[]
  h2?: string[]
  openGraph?: { title?: string | null; description?: string | null; image?: string | null }
  twitterCard?: string | null
  jsonLdCount?: number | null
}

/** Inclusive bounds, in characters, a caller holds a text to. */
export type LengthBounds = { min: number; max: number }
/** The lengths an audit judges: only those the caller declares. */
export type SeoLengths = { title?: LengthBounds; description?: LengthBounds }

export type SeoFinding = { code: string; severity: 'error' | 'warning' | 'info'; message: string }
export type SeoAudit = {
  /** Every field the page or snapshot does not state is null. */
  snapshot: {
    url: string | null
    title: string | null
    description: string | null
    robots: string | null
    canonical: string | null
    language: string | null
    h1: string[]
    h2: string[]
    openGraph: { title: string | null; description: string | null; image: string | null }
    twitterCard: string | null
    jsonLdCount: number | null
  }
  summary: { errors: number; warnings: number; info: number }
  findings: SeoFinding[]
}

export function extractSeoSnapshot(html: string, options?: { url?: string }): SeoSnapshot
export function auditSeoSnapshot(snapshot?: SeoSnapshot, lengths?: SeoLengths): SeoAudit
export function auditHtml(html: string, options?: { url?: string; lengths?: SeoLengths }): SeoAudit
