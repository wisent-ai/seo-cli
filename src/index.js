// What a page states about itself for search, and what it omits. A field the
// page does not state is null; nothing is filled in for it.

/** `value` with its whitespace collapsed, or null when it is not text or holds none. */
function clean(value) {
  if (typeof value !== 'string') return null
  const text = value.replace(/\s+/gu, ' ').trim()
  return text ? text : null
}

function decode(value) {
  const text = clean(value)
  if (text === null) return null
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
}

/** The value of attribute `name` in `tag`, or null when the tag does not carry it. */
function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)'|(?<bare>[^\\s>]+))`, 'iu'))
  if (!match) return null
  const { double, single, bare } = match.groups
  return decode([double, single, bare].find((value) => value !== undefined))
}

function firstTag(html, pattern) {
  const match = html.match(pattern)
  return match ? decode(match.groups.inner.replace(/<[^>]+>/gu, ' ')) : null
}

/** The lowercase value of attribute `name`, for comparing a tag's role. */
function role(tag, name) {
  const value = attribute(tag, name)
  return value === null ? null : value.toLowerCase()
}

function metaContent(html, matcher) {
  for (const { groups } of html.matchAll(/(?<tag><meta\b[^>]*>)/giu)) {
    if (matcher(groups.tag)) return attribute(groups.tag, 'content')
  }
  return null
}

function linkHref(html, rel) {
  for (const { groups } of html.matchAll(/(?<tag><link\b[^>]*>)/giu)) {
    const rels = role(groups.tag, 'rel')
    if (rels !== null && rels.split(/\s+/u).includes(rel)) return attribute(groups.tag, 'href')
  }
  return null
}

function allTagText(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>(?<inner>[\\s\\S]*?)<\\/${tag}>`, 'giu'))]
    .map(({ groups }) => decode(groups.inner.replace(/<[^>]+>/gu, ' ')))
    .filter((text) => text !== null)
}

export function extractSeoSnapshot(html, options = {}) {
  if (typeof html !== 'string') throw new TypeError('extractSeoSnapshot needs the page HTML as text')
  const htmlTag = html.match(/(?<tag><html\b[^>]*>)/iu)
  return {
    url: clean(options.url),
    title: firstTag(html, /<title\b[^>]*>(?<inner>[\s\S]*?)<\/title>/iu),
    description: metaContent(html, (tag) => role(tag, 'name') === 'description'),
    robots: metaContent(html, (tag) => role(tag, 'name') === 'robots'),
    canonical: linkHref(html, 'canonical'),
    language: htmlTag ? attribute(htmlTag.groups.tag, 'lang') : null,
    h1: allTagText(html, 'h1'),
    h2: allTagText(html, 'h2'),
    openGraph: {
      title: metaContent(html, (tag) => role(tag, 'property') === 'og:title'),
      description: metaContent(html, (tag) => role(tag, 'property') === 'og:description'),
      image: metaContent(html, (tag) => role(tag, 'property') === 'og:image'),
    },
    twitterCard: metaContent(html, (tag) => role(tag, 'name') === 'twitter:card'),
    jsonLdCount: [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>/giu)].length,
  }
}

function texts(value) {
  return Array.isArray(value) ? value.map(clean).filter((text) => text !== null) : []
}

/**
 * The audit of a snapshot. A title or description is held to a length only
 * when the caller declares the bounds (`lengths.title`, `lengths.description`,
 * each `{ min, max }` characters): search engines publish no such limit, so
 * none is assumed.
 */
export function auditSeoSnapshot(input = {}, lengths = {}) {
  const openGraph = input.openGraph && typeof input.openGraph === 'object' ? input.openGraph : {}
  const snapshot = {
    url: clean(input.url),
    title: clean(input.title),
    description: clean(input.description),
    robots: clean(input.robots),
    canonical: clean(input.canonical),
    language: clean(input.language),
    h1: texts(input.h1),
    h2: texts(input.h2),
    openGraph: {
      title: clean(openGraph.title),
      description: clean(openGraph.description),
      image: clean(openGraph.image),
    },
    twitterCard: clean(input.twitterCard),
    jsonLdCount: Number.isInteger(input.jsonLdCount) ? input.jsonLdCount : null,
  }
  const findings = []
  const add = (code, severity, message) => findings.push({ code, severity, message })
  const measure = (field, label, bounds) => {
    const text = snapshot[field]
    if (!bounds || text === null) return
    if (text.length < bounds.min || text.length > bounds.max) {
      add(`${field}_length`, 'warning', `${label} length is ${text.length}; the declared bounds are ${bounds.min} to ${bounds.max} characters.`)
    }
  }
  if (snapshot.title === null) add('title_missing', 'error', 'The document has no title.')
  measure('title', 'Title', lengths.title)
  if (snapshot.description === null) add('description_missing', 'error', 'The document has no meta description.')
  measure('description', 'Description', lengths.description)
  if (snapshot.canonical === null) add('canonical_missing', 'warning', 'The document has no canonical URL.')
  if (snapshot.language === null) add('language_missing', 'warning', 'The html element has no language.')
  const [firstHeading, ...moreHeadings] = snapshot.h1
  if (firstHeading === undefined) add('h1_missing', 'error', 'The document has no H1 heading.')
  if (moreHeadings.length) add('h1_multiple', 'warning', `The document has ${snapshot.h1.length} H1 headings.`)
  if (snapshot.robots !== null && /\bnoindex\b/iu.test(snapshot.robots)) add('robots_noindex', 'info', 'The document asks search engines not to index it.')
  if (snapshot.openGraph.title === null || snapshot.openGraph.description === null) add('open_graph_incomplete', 'warning', 'Open Graph title or description is missing.')
  if (snapshot.twitterCard === null) add('twitter_card_missing', 'info', 'Twitter card metadata is missing.')
  const count = (severity) => findings.filter((finding) => finding.severity === severity).length
  return {
    snapshot,
    summary: { errors: count('error'), warnings: count('warning'), info: count('info') },
    findings,
  }
}

export function auditHtml(html, options = {}) {
  return auditSeoSnapshot(extractSeoSnapshot(html, options), options.lengths)
}
