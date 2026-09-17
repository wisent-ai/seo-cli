<!-- wisent-banner:start -->
<p align="center">
  <img src="assets/readme-banner.webp" alt="seo-cli by Wisent" width="100%">
</p>
<!-- wisent-banner:end -->

<!-- wisent-readme-signals:start -->
[![Source](https://img.shields.io/badge/GitHub-Source-181717?logo=github)](https://github.com/wisent-ai/seo-cli) [![Issues](https://img.shields.io/badge/GitHub-Issues-181717?logo=github)](https://github.com/wisent-ai/seo-cli/issues) [![Wisent](https://img.shields.io/badge/Wisent-Website-0B0B0B)](https://wisent.com) [![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/qRjpkthq54) [![LinkedIn](https://img.shields.io/badge/LinkedIn-Follow-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/company/wisent-ai/) [![X](https://img.shields.io/badge/X-Follow-000000?logo=x&logoColor=white)](https://x.com/wisentai) [![Enterprise](https://img.shields.io/badge/Enterprise-Book%20a%20call-0B0B0B?logo=calendly)](https://calendly.com/lbartoszcze)
<!-- wisent-readme-signals:end -->

# SEO CLI

[![Release](https://img.shields.io/github/v/release/wisent-ai/seo-cli?display_name=tag&sort=semver)](https://github.com/wisent-ai/seo-cli/releases)
[![Downloads](https://img.shields.io/github/downloads/wisent-ai/seo-cli/total)](https://github.com/wisent-ai/seo-cli/releases)
[![License](https://img.shields.io/github/license/wisent-ai/seo-cli)](https://github.com/wisent-ai/seo-cli)
[![Discord](https://img.shields.io/badge/Discord-Join%20Wisent-5865F2?logo=discord&logoColor=white)](https://discord.gg/qRjpkthq54)

**SEO CLI is a deterministic technical and on-page SEO auditor for local HTML, public pages, and application-provided page snapshots.**

It extracts search metadata and reports concrete omissions without an account, hosted crawler, model, or proprietary score.

## Included

- title, meta description, robots, canonical, language, H1/H2, Open Graph, Twitter card, and JSON-LD inventory;
- explicit error, warning, and informational findings;
- local-file and credential-free HTTPS audit commands;
- a dependency-free JavaScript API suitable for server applications.

## Explicit non-goals

- SEO CLI does not claim rankings, traffic, keyword volume, backlink quality, or search-engine index state.
- It does not bypass authentication, robots controls, rate limits, or access restrictions.
- Length guidance is a presentation heuristic, not a ranking guarantee.
- A page audit does not replace Search Console, log, performance, accessibility, or conversion evidence.

## Quick start

Requires Node.js 20 or newer.

```bash
git clone https://github.com/wisent-ai/seo-cli.git
cd seo-cli
node src/cli.js audit --file ./page.html --url https://example.com/page
```

Audit a public page:

```bash
node src/cli.js audit --url https://example.com/
```

Use the library:

```js
import { auditHtml, auditSeoSnapshot } from '@wisent-ai/seo-cli'

const report = auditHtml(html, { url: 'https://example.com/' })
const renderedReport = auditSeoSnapshot({
  url: 'https://example.com/',
  title: documentTitle,
  description,
  canonical,
  language,
  h1: headings,
})
```

## Operational model

- **Input:** local HTML, a public HTTPS response, or a caller-built snapshot.
- **Output:** JSON containing the normalized snapshot, severity counts, and findings.
- **State:** none.
- **Credentials:** none accepted; authenticated collection belongs to the caller.
- **Cost:** local operation is unmetered.

## Project status and support

- **Maturity:** public development source, version `0.1.0`.
- **Issues:** [wisent-ai/seo-cli](https://github.com/wisent-ai/seo-cli/issues).
- **Security:** use private GitHub Security Advisories; never attach authenticated HTML or credentials to a public issue.
- **License:** Apache License 2.0; see [LICENSE](LICENSE).
