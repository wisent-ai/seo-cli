export type SeoSnapshot = {
  url?: string | null
  title?: string
  description?: string
  robots?: string
  canonical?: string
  language?: string
  h1?: string[]
  h2?: string[]
  openGraph?: { title?: string; description?: string; image?: string }
  twitterCard?: string
  jsonLdCount?: number
}

export type SeoFinding = { code: string; severity: 'error' | 'warning' | 'info'; message: string }
export type SeoAudit = {
  snapshot: Required<Omit<SeoSnapshot, 'url'>> & { url: string | null }
  summary: { errors: number; warnings: number; info: number }
  findings: SeoFinding[]
}

export function extractSeoSnapshot(html: string, options?: { url?: string }): SeoSnapshot
export function auditSeoSnapshot(snapshot?: SeoSnapshot): SeoAudit
export function auditHtml(html: string, options?: { url?: string }): SeoAudit
