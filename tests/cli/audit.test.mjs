// `seo audit` as a person runs it, on a real public page. The run reads the
// page named by SEO_TEST_PAGE (an https URL; the journey refuses to start
// without it), once through `seo audit --url` and once from a copy saved in a
// run-owned directory, and checks that:
//   - the audit of the saved copy is the audit of the fetched page;
//   - --text prints one `path: value` line per leaf of the JSON audit, each
//     value JSON-spelled and equal to the leaf at that path, so null, empty
//     strings, empty lists and empty objects stay distinct;
//   - help exits 0; an unknown command, an unknown option, a repeated
//     --file, an option without its value and a URL that is not credential-free
//     HTTPS exit 2 before anything is read or fetched; a file that cannot be
//     read exits 1 with its cause.
//
//   SEO_TEST_PAGE=https://<public page> node --test tests/cli/audit.test.mjs
//
// With SEO_TEST_DEFECT and SEO_TEST_CRITERION named together, a run on
// committed source that passes every case writes criterion.json under
// .build/real-tests/audit/<stamp>/.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { constants, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const cli = join(root, 'src', 'cli.js')
const page = process.env.SEO_TEST_PAGE?.trim()
assert.ok(page, 'SEO_TEST_PAGE names the public https page the journey audits')
const defectId = process.env.SEO_TEST_DEFECT?.trim()
const criterion = process.env.SEO_TEST_CRITERION?.trim()
assert.equal(Boolean(defectId), Boolean(criterion),
  'SEO_TEST_DEFECT and SEO_TEST_CRITERION are named together or not at all')

// The shell's statuses (https://www.gnu.org/software/bash/manual/html_node/Exit-Status.html).
const SUCCEEDED = 0
const FAILURE = 1 // https://www.gnu.org/software/bash/manual/html_node/Exit-Status.html
const USAGE = 2 // https://www.gnu.org/software/bash/manual/html_node/Exit-Status.html

const commands = []
function git(...args) {
  const run = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  assert.equal(run.status, SUCCEEDED, run.stderr)
  commands.push({ executable: 'git', args, exit: run.status })
  return run.stdout
}
const revision = git('rev-parse', 'HEAD').trim()
const uncommitted = git('status', '--porcelain', '--', 'src', 'tests/cli')
assert.ok(!defectId || uncommitted === '', 'commit the CLI and this test before qualification')

const scratch = join(root, '.build', 'tests', randomUUID())
mkdirSync(scratch, { recursive: true })
after(() => rmSync(scratch, { recursive: true, force: true }))

const runs = []
function seo(...args) {
  const run = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' })
  runs.push({ args, exit: run.status, stderr: run.stderr, stdoutSha256: createHash('sha256').update(run.stdout).digest('hex') })
  return run
}

// Every leaf of `node` with its path, spelled as --text spells paths.
function leaves(node, path) {
  if (Array.isArray(node) && node.length) return node.flatMap((item, index) => leaves(item, `${path}[${index}]`))
  if (node && typeof node === 'object' && Object.keys(node).length) {
    return Object.entries(node).flatMap(([key, item]) => leaves(item, path ? `${path}.${key}` : key))
  }
  return [[path, node]]
}

const observed = {}
const registered = []
const completed = []
function journey(name, body) {
  registered.push(name)
  test(name, async () => {
    await body()
    completed.push(name)
  })
}

const response = await fetch(page, { redirect: 'follow' })
assert.ok(response.ok, `${page} answered HTTP ${response.status}`)
const html = await response.text()
const saved = join(scratch, 'page.html')
writeFileSync(saved, html)

journey('the saved copy audits as the fetched page does', () => {
  const fetched = seo('audit', '--url', page)
  assert.equal(fetched.status, SUCCEEDED, fetched.stderr)
  const local = seo('audit', '--file', saved, '--url', page)
  assert.equal(local.status, SUCCEEDED, local.stderr)
  assert.deepEqual(JSON.parse(local.stdout), JSON.parse(fetched.stdout))
  observed.page = page
  observed.htmlSha256 = createHash('sha256').update(html).digest('hex')
})

journey('--text prints one JSON-spelled line per leaf of the audit', () => {
  const json = seo('audit', '--file', saved, '--url', page)
  const text = seo('audit', '--file', saved, '--url', page, '--text')
  assert.equal(text.status, SUCCEEDED, text.stderr)
  const expected = leaves(JSON.parse(json.stdout), '')
  const lines = text.stdout.trimEnd().split('\n')
  assert.equal(lines.length, expected.length)
  expected.forEach(([path, value], index) => {
    const prefix = `${path}: `
    assert.ok(lines[index].startsWith(prefix), `${lines[index]} does not name ${path}`)
    assert.deepEqual(JSON.parse(lines[index].slice(prefix.length)), value)
  })
  observed.textLines = lines.length
})

journey('help exits 0 and wrong invocations exit 2 before reading or fetching', () => {
  const help = seo('--help')
  assert.equal(help.status, SUCCEEDED)
  assert.ok(help.stdout.includes('seo audit --file <page.html>'), help.stdout)
  const insecure = new URL(page)
  insecure.protocol = 'http:'
  for (const args of [
    ['crawl', '--file', saved],
    ['audit', '--file', saved, '--depth', page],
    ['audit', '--file', saved, '--file', saved],
    ['audit', '--file', '--text'],
    ['audit'],
    ['audit', '--url', insecure.href],
  ]) {
    const run = seo(...args)
    assert.equal(run.status, USAGE, `${args.join(' ')}: ${run.stderr}`)
    assert.equal(run.stdout, '', `${args.join(' ')} printed an audit`)
  }
})

journey('a file that cannot be read exits 1 with its cause', () => {
  const missing = join(scratch, 'missing.html')
  const run = seo('audit', '--file', missing)
  assert.equal(run.status, FAILURE, run.stderr)
  assert.ok(run.stderr.includes('ENOENT') && run.stderr.includes(missing), run.stderr)
})

after(() => {
  if (!defectId || completed.length !== registered.length) return
  const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
  const out = join(root, '.build', 'real-tests', 'audit', new Date().toISOString().replace(/[:.]/g, ''))
  mkdirSync(out, { recursive: true })
  const path = join(out, 'criterion.json')
  writeFileSync(path, `${JSON.stringify({
    defectId,
    criterion,
    sourceRevision: revision,
    result: 'passed',
    binarySha256: digest(process.execPath),
    testSha256: digest(fileURLToPath(import.meta.url)),
    observedFinalState: { cases: completed, observed, runs },
    commands,
  }, null, '  ')}\n`, { mode: constants.S_IRUSR | constants.S_IWUSR })
  console.log(`criterion report: ${path}`)
})
