#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { auditHtml } from './index.js'

// The invocation itself is wrong: exit 2 with the usage; any other failure
// exits 1 with its own message (cli.md rule 10).
const EXIT_FAILURE = 1 // https://www.gnu.org/software/bash/manual/html_node/Exit-Status.html
const EXIT_USAGE = 2 // https://www.gnu.org/software/bash/manual/html_node/Exit-Status.html

class UsageError extends Error {}

function usage() {
  return `seo-cli

Usage:
  seo audit --file <page.html> [--url <canonical source URL>] [length bounds]
  seo audit --url <https://public.example/page> [length bounds]

Length bounds, each MIN-MAX characters, hold the title and the meta description
to the bounds you choose; without one, that length is not judged:
  --title-length <MIN-MAX>  --description-length <MIN-MAX>

The command prints a deterministic JSON audit to stdout; --text prints the same audit
as one path: value line per field.`
}

// The options audit reads; a misspelt or valueless one is refused by the
// parser, never ignored (rule 12).
const OPTIONS = {
  file: { type: 'string', multiple: true },
  url: { type: 'string', multiple: true },
  'title-length': { type: 'string', multiple: true },
  'description-length': { type: 'string', multiple: true },
  text: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
}

function invocation() {
  try {
    return parseArgs({ options: OPTIONS, allowPositionals: true, strict: true })
  } catch (error) {
    throw new UsageError(`${error.message}\n\n${usage()}`)
  }
}

// The one value of `--name`, refused when it is supplied more than once.
function single(values, name) {
  if (!Object.hasOwn(values, name)) return undefined
  const [first, ...repeated] = values[name]
  if (repeated.length) throw new UsageError(`--${name} may only be supplied once\n\n${usage()}`)
  return first
}

// The bounds `--name` declares as MIN-MAX whole characters, or none when it is not given.
function bounds(values, name) {
  const raw = single(values, name)
  if (raw === undefined) return undefined
  const match = raw.match(/^(?<min>\d+)-(?<max>\d+)$/u)
  const min = match ? Number(match.groups.min) : Number.NaN
  const max = match ? Number(match.groups.max) : Number.NaN
  if (!match || !Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) throw new UsageError(`--${name} must be MIN-MAX safe whole characters with MIN no larger than MAX, got ${raw}\n\n${usage()}`)
  return { min, max }
}

// The same result for people: one `path: value` line per field (cli.md rule 13).
function render(result, text) {
  if (!text) return JSON.stringify(result, null, '  ')
  const lines = []
  const walk = (node, path) => {
    if (Array.isArray(node) && node.length) node.forEach((item, index) => walk(item, `${path}[${index}]`))
    else if (node && typeof node === 'object' && Object.keys(node).length) for (const [key, item] of Object.entries(node)) walk(item, path ? `${path}.${key}` : key)
    else lines.push(path ? `${path}: ${JSON.stringify(node)}` : JSON.stringify(node))
  }
  walk(result, '')
  return lines.join('\n')
}

// The User-Agent names this package at the version it is published as.
async function userAgent() {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  return `seo-cli/${manifest.version}`
}

async function main() {
  const { values, positionals } = invocation()
  const [command, ...extra] = positionals
  if (!command || values.help) {
    console.log(usage())
    return
  }
  if (command !== 'audit') throw new UsageError(`Unknown command: ${command}\n\n${usage()}`)
  if (extra.length) throw new UsageError(`seo audit takes no arguments besides its options; got ${extra.join(' ')}\n\n${usage()}`)
  const file = single(values, 'file')
  const target = single(values, 'url')
  const lengths = { title: bounds(values, 'title-length'), description: bounds(values, 'description-length') }
  let html
  if (file) {
    html = await readFile(file, 'utf8')
  } else if (target) {
    let url
    try {
      url = new URL(target)
    } catch (error) {
      throw new UsageError(`--url ${JSON.stringify(target)} is not a URL: ${error.message}`)
    }
    if (url.protocol !== 'https:' || url.username || url.password) throw new UsageError('--url must be a credential-free HTTPS URL')
    const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': await userAgent() } })
    if (!response.ok) throw new Error(`Fetch of ${url} returned HTTP ${response.status}`)
    html = await response.text()
  } else {
    throw new UsageError(`audit requires --file or --url\n\n${usage()}`)
  }
  console.log(render(auditHtml(html, { url: target, lengths }), values.text))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = error instanceof UsageError ? EXIT_USAGE : EXIT_FAILURE
})
