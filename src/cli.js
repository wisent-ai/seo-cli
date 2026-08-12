#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { auditHtml } from './index.js'

function usage() {
  return `seo-cli

Usage:
  seo audit --file <page.html> [--url <canonical source URL>]
  seo audit --url <https://public.example/page>

The command prints a deterministic JSON audit to stdout.`
}

function value(args, name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : null
}

async function main() {
  const args = process.argv.slice(2)
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    console.log(usage())
    return
  }
  if (args[0] !== 'audit') throw new Error(`Unknown command: ${args[0]}\n\n${usage()}`)
  const file = value(args, '--file')
  const target = value(args, '--url')
  let html
  if (file) {
    html = await readFile(file, 'utf8')
  } else if (target) {
    const url = new URL(target)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('--url must be a credential-free HTTPS URL')
    const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'seo-cli/0.1' } })
    if (!response.ok) throw new Error(`Fetch returned HTTP ${response.status}`)
    html = await response.text()
  } else {
    throw new Error('audit requires --file or --url')
  }
  console.log(JSON.stringify(auditHtml(html, { url: target }), null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
