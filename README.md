# OpenFEC — Federal Election Commission Campaign Finance

The Federal Election Commission's openFEC API. All federal campaign finance data: candidates (presidential, congressional), committees (campaign, PAC, super PAC, party), individual contributions, expenditures, independent expenditures, debt. Free, requires a free API key.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Why this matters for AI agents

For political research, lobbying-spend analysis, or "where does this PAC's money go?" questions, OpenFEC is the canonical source. Government-mandated reporting; what's publicly disclosed flows here. Pair with the [Lobbying Activity recipe](/docs/recipes/lobbying-activity) for full political-footprint mapping.

Common flows:

- **Candidate / committee lookup.** "Find committees associated with a candidate" → search by name.
- **Contribution patterns.** "Who contributed to this PAC?" → committee contribution detail.
- **Where the money went.** "What did this committee spend on?" → committee disbursement detail.
- **Independent expenditures.** "Who's spending against this candidate?" → IE search.

## Auth

Free key from https://api.open.fec.gov/developers/. Pass via `_apiKey`. Rate-limited; the key gives generous limits.

## Committee types

| Type | What it is |
|---|---|
| Authorized candidate committee | A campaign for federal office |
| PAC (Political Action Committee) | Limited contributions ($5,000/cycle) |
| Super PAC (independent-expenditure-only) | Unlimited fundraising, no candidate coordination |
| Hybrid PAC (Carey committee) | Both regular PAC and super PAC functions |
| Party committee | National / state / local party committees |
| 527 / 501(c)(4) | Don't appear in FEC data; tax-only filings |

For corporate / executive political activity, you typically care about the corporate PAC (regular) and any associated super PACs.

## Reporting cycles

Federal campaign finance is reported by **cycle**: Jan 1 of year T to Dec 31 of T+1 for two-year cycles (House: every 2yr, Senate: every 6yr). Filings are quarterly during election years, semi-annually in off-years.

| Common cycle filters | What it captures |
|---|---|
| `cycle=2024` | All activity in 2023-2024 |
| `cycle=2026` | All activity in 2025-2026 |

## Common pitfalls

- **Itemization thresholds.** Individual contributions <$200 don't have to be itemized — only the aggregate appears. So "who contributed to X?" misses small donors.
- **Bundling.** A single donor can contribute to many committees, often via "bundlers." OpenFEC has individual contributions; bundling relationships are inferred, not reported.
- **Soft money / 527s / dark money.** OpenFEC doesn't have 501(c)(4) social welfare orgs that engage in political activity. For those, IRS Form 990 (separate pack: `propublica-nonprofit`) is the closest analog.
- **Super PAC coordination is restricted, not eliminated.** Super PACs report all activity but can't legally coordinate with candidates. In practice, "single-candidate super PAC" is a common pattern that's technically arms-length.
- **Candidate vs. committee.** A candidate has a candidate ID (Cxxxxxxxx); their authorized committee has a separate committee ID. Same-name searches need disambiguation.
- **Cycle alignment for lookups.** Searching for activity in 2023 alone misses things — most reports cover the full 2023-2024 cycle. Filter by cycle, not by year.

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "open-fec": {
      "url": "https://gateway.pipeworx.io/open-fec/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Open Fec data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
