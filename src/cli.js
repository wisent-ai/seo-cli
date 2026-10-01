#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { auditHtml } from './index.js'

// The invocation itself is wrong: exit 2 with the usage; any other failure
// exits 1 with its own message (cli.md rule 10).
class UsageError extends Error {}

function usage() {
  return `seo-cli

Usage:
  seo audit --file <page.html> [--url <canonical source URL>]
  seo audit --url <https://public.example/page>

The command prints a deterministic JSON audit to stdout; --text prints the same audit
as one path: value line per field.`
}

function value(args, name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : null
}

// The same result for people: one `path: value` line per field (cli.md rule 13).
function render(result, text) {
  if (!text) return JSON.stringify(result, null, 2)
  const lines = []
  const walk = (node, path) => {
    if (Array.isArray(node) && node.length) node.forEach((item, index) => walk(item, `${path}[${index}]`))
    else if (node && typeof node === 'object' && Object.keys(node).length) for (const [key, item] of Object.entries(node)) walk(item, path ? `${path}.${key}` : key)
    else lines.push(path ? `${path}: ${node === null || typeof node === 'object' ? '-' : node}` : String(node))
  }
  walk(result, '')
  return lines.join('\n')
}

async function main() {
  const args = process.argv.slice(2)
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    console.log(usage())
    return
  }
  if (args[0] !== 'audit') throw new UsageError(`Unknown command: ${args[0]}\n\n${usage()}`)
  const file = value(args, '--file')
  const target = value(args, '--url')
  let html
  if (file) {
    html = await readFile(file, 'utf8')
  } else if (target) {
    let url
    try {
      url = new URL(target)
    } catch {
      throw new UsageError(`--url ${JSON.stringify(target)} is not a URL`)
    }
    if (url.protocol !== 'https:' || url.username || url.password) throw new UsageError('--url must be a credential-free HTTPS URL')
    const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'seo-cli/0.1' } })
    if (!response.ok) throw new Error(`Fetch returned HTTP ${response.status}`)
    html = await response.text()
  } else {
    throw new UsageError(`audit requires --file or --url\n\n${usage()}`)
  }
  console.log(render(auditHtml(html, { url: target }), args.includes('--text')))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = error instanceof UsageError ? 2 : 1
})
