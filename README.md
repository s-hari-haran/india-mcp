# India Tenders MCP

**Ask Claude, ChatGPT or Cursor about Indian government tenders.** An MCP server over about 50,000 open public-procurement tenders from CPPP, GeM, defence, 27+ state e-procurement portals, PSUs and large companies, refreshed every morning. Free, no sign-up, no API key.

```
You:    What are the biggest open solar power plant tenders over ₹10 crore?
Claude: 1. Rooftop solar for 1 lakh consumers (PM Surya Ghar), WBSEDCL, West Bengal
           ₹303 crore · EMD ₹6.06 crore · bids close 9 Dec 2026 · link …
```

Most Indian tenders sit on 40+ separate government portals, many behind CAPTCHAs, with no search across them and no API. This connector gives your AI one place to search them.

## Connect in 30 seconds

**Connector URL:** `https://india-mcp.pages.dev/mcp`

<details open><summary><b>Claude</b> (claude.ai, desktop and mobile)</summary>

1. **Settings → Connectors → Add custom connector**
2. Name `India Tenders`, URL above → **Add**
3. Ask: *"Road construction tenders in Karnataka above ₹10 crore"*
</details>

<details><summary><b>ChatGPT</b></summary>

1. **Settings → Apps & Connectors → Advanced settings →** turn on **Developer mode**
2. **Apps & Connectors → Create**: name `India Tenders`, URL above, **No authentication** → **Create**
3. In a chat, choose it under **+ → More**, then ask your question
</details>

<details><summary><b>Claude Code</b></summary>

```bash
claude mcp add --transport http india-tenders https://india-mcp.pages.dev/mcp
```
</details>

<details><summary><b>Cursor, VS Code, Windsurf, Claude Desktop</b> (config file)</summary>

Remote (nothing to install):
```json
{ "mcpServers": { "india-tenders": { "url": "https://india-mcp.pages.dev/mcp" } } }
```
Local over stdio (Node 18+):
```json
{ "mcpServers": { "india-tenders": { "command": "npx", "args": ["-y", "india-mcp"] } } }
```
</details>

## Tools

| Tool | What it does |
|---|---|
| `search_tenders` | Search by words, state, kind of work, buyer, value (₹) and closing / publishing date; sort by deadline, value or newest |
| `get_tender` | Full listing for one tender: buyer, department, location, value, EMD, fee, dates, work description, reference number |
| `tender_coverage` | Portals and states covered, open tenders per source, last refresh, sector names |
| `search` / `fetch` | Simple pair used by ChatGPT deep research |

Search understands Indian procurement shorthand: AMC, CAMC, O&M, EPC, CCTV, BESS, RTS and more.

Kinds of work: `roads-buildings`, `water-sewage`, `electrical-power`, `solar-renewable`, `railways-metro`, `computers-cctv`, `software-it`, `medical-health`, `manpower-security`, `vehicles-transport`, `consultancy`, `furniture-supplies`, `agriculture-food`, `machinery-spare-parts`, `lab-scientific-equipment`, `chemicals-industrial-supplies`, `printing-signage`, `defence-security-equipment`, `mining-minerals`, `waste-management`, `real-estate-ppp`.

## Things to ask

- "New tenders from Indian Railways for CCTV or AMC this week"
- "Water supply tenders in Tamil Nadu under ₹50 lakh closing in 10 days"
- "Which states have the most open solar tenders right now?"
- "Summarise tender `<id>`: scope, EMD, deadline and who can bid"
- "Compare the three biggest open hospital construction tenders"

## Command line

```bash
npx india-mcp search solar --state Gujarat --min 50000000 --closes 30 --sort value
npx india-mcp tender "wbtenders.gov.in:2026_WBSED_1049133_1"
npx india-mcp coverage
```

## Free use and bulk data

- Up to 25 tenders per call, first 100 matches per search, 100 searches an hour per person.
- Each tender links to [TenderDesk](https://tenderdesk-020.pages.dev) for AI briefs, morning alerts and bid tracking.
- Need thousands of rows, scheduled exports or a data pipeline? Use the [India Government Tenders Scraper on Apify](https://apify.com/tenderdata-india/gepnic-tenders).

## How it works

```
AI app ──MCP──▶ india-mcp (Cloudflare Worker or local npx) ──HTTPS──▶ TenderDesk open-tenders API ──▶ daily-refreshed tender index
```

This repo is the MCP server: plain JavaScript, no dependencies, about 400 lines (`src/tools.js`, `src/server.js`, `src/worker.js`). It speaks MCP over Streamable HTTP (stateless JSON) and stdio, protocol versions 2024-11-05 to 2025-06-18. All tools are read-only.

```bash
npm test                 # protocol and tool tests (mock + live)
npm test -- --offline    # without network
```

## Notes

- Listings are collected from public procurement portals. Always confirm details and download documents from the official portal before bidding.
- Sources that need a CAPTCHA or disallow automated access are collected only where permitted.
- Privacy: no account and no personal data. See [/privacy](https://india-mcp.pages.dev/privacy).

## License

MIT. Issues and pull requests welcome.
