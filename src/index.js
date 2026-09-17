// Result pages show about 15-65 characters of a title and 70-170 of a description.
const TITLE_MIN = 15
const TITLE_MAX = 65
const DESCRIPTION_MIN = 70
const DESCRIPTION_MAX = 170

function clean(value) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim()
}

function decode(value) {
  return clean(value)
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'iu'))
  const [, doubleQuoted, singleQuoted, bare] = match ?? []
  return decode(doubleQuoted ?? singleQuoted ?? bare ?? '')
}

function firstTag(html, pattern) {
  const match = html.match(pattern)
  return decode(match?.[1]?.replace(/<[^>]+>/gu, ' ') ?? '')
}

function metaContent(html, matcher) {
  for (const match of html.matchAll(/<meta\b[^>]*>/giu)) {
    const tag = match[0]
    if (matcher(tag)) return attribute(tag, 'content')
  }
  return ''
}

function linkHref(html, rel) {
  for (const match of html.matchAll(/<link\b[^>]*>/giu)) {
    const tag = match[0]
    if (attribute(tag, 'rel').toLowerCase().split(/\s+/u).includes(rel)) return attribute(tag, 'href')
  }
  return ''
}

function allTagText(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'giu'))]
    .map((match) => decode(match[1].replace(/<[^>]+>/gu, ' ')))
    .filter(Boolean)
}

export function extractSeoSnapshot(html, options = {}) {
  const source = String(html ?? '')
  const htmlTag = source.match(/<html\b[^>]*>/iu)?.[0] ?? ''
  return {
    url: clean(options.url) || null,
    title: firstTag(source, /<title\b[^>]*>([\s\S]*?)<\/title>/iu),
    description: metaContent(source, (tag) => attribute(tag, 'name').toLowerCase() === 'description'),
    robots: metaContent(source, (tag) => attribute(tag, 'name').toLowerCase() === 'robots'),
    canonical: linkHref(source, 'canonical'),
    language: attribute(htmlTag, 'lang'),
    h1: allTagText(source, 'h1'),
    h2: allTagText(source, 'h2'),
    openGraph: {
      title: metaContent(source, (tag) => attribute(tag, 'property').toLowerCase() === 'og:title'),
      description: metaContent(source, (tag) => attribute(tag, 'property').toLowerCase() === 'og:description'),
      image: metaContent(source, (tag) => attribute(tag, 'property').toLowerCase() === 'og:image'),
    },
    twitterCard: metaContent(source, (tag) => attribute(tag, 'name').toLowerCase() === 'twitter:card'),
    jsonLdCount: [...source.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>/giu)].length,
  }
}

export function auditSeoSnapshot(input = {}) {
  const snapshot = {
    url: clean(input.url) || null,
    title: clean(input.title),
    description: clean(input.description),
    robots: clean(input.robots),
    canonical: clean(input.canonical),
    language: clean(input.language),
    h1: Array.isArray(input.h1) ? input.h1.map(clean).filter(Boolean) : [],
    h2: Array.isArray(input.h2) ? input.h2.map(clean).filter(Boolean) : [],
    openGraph: input.openGraph && typeof input.openGraph === 'object' ? input.openGraph : {},
    twitterCard: clean(input.twitterCard),
    jsonLdCount: Number.isInteger(input.jsonLdCount) ? input.jsonLdCount : 0,
  }
  const findings = []
  const add = (code, severity, message) => findings.push({ code, severity, message })
  if (!snapshot.title) add('title_missing', 'error', 'The document has no title.')
  else if (snapshot.title.length < TITLE_MIN || snapshot.title.length > TITLE_MAX) add('title_length', 'warning', `Title length is ${snapshot.title.length}; keep it between ${TITLE_MIN} and ${TITLE_MAX} characters.`)
  if (!snapshot.description) add('description_missing', 'error', 'The document has no meta description.')
  else if (snapshot.description.length < DESCRIPTION_MIN || snapshot.description.length > DESCRIPTION_MAX) add('description_length', 'warning', `Description length is ${snapshot.description.length}; keep it between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX} characters.`)
  if (!snapshot.canonical) add('canonical_missing', 'warning', 'The document has no canonical URL.')
  if (!snapshot.language) add('language_missing', 'warning', 'The html element has no language.')
  if (snapshot.h1.length === 0) add('h1_missing', 'error', 'The document has no H1 heading.')
  if (snapshot.h1.length > 1) add('h1_multiple', 'warning', `The document has ${snapshot.h1.length} H1 headings.`)
  if (/\bnoindex\b/iu.test(snapshot.robots)) add('robots_noindex', 'info', 'The document asks search engines not to index it.')
  if (!clean(snapshot.openGraph.title) || !clean(snapshot.openGraph.description)) add('open_graph_incomplete', 'warning', 'Open Graph title or description is missing.')
  if (!snapshot.twitterCard) add('twitter_card_missing', 'info', 'Twitter card metadata is missing.')
  return {
    snapshot,
    summary: {
      errors: findings.filter((finding) => finding.severity === 'error').length,
      warnings: findings.filter((finding) => finding.severity === 'warning').length,
      info: findings.filter((finding) => finding.severity === 'info').length,
    },
    findings,
  }
}

export function auditHtml(html, options = {}) {
  return auditSeoSnapshot(extractSeoSnapshot(html, options))
}
