# MCP server — let an AI agent build reports

`server.js` exposes the report builder to AI agents over MCP (no dependencies). It talks to the running
dashboard's HTTP API, so validation, permissions and the audit log all apply. Reports are created as
**drafts only** — there is no submit/approve tool; a human approves.

Tools: `list_templates`, `get_template_skeleton`, `list_indicators`, `create_report`, `update_report`,
`get_report`, `list_reports`.

Env: `RB_URL` (default `http://localhost:3000`), `RB_USER`, `RB_PASS` (account the agent logs in as —
prefer a dedicated `employee` account so the audit log separates agent work).

## Claude Code / local clients (stdio)

```
claude mcp add hadiyah-reports -e RB_URL=http://localhost:3000 -e RB_USER=agent -e RB_PASS=PASTE_PASSWORD_HERE -- node /path/to/mcp/server.js
```

## ChatGPT / remote clients (HTTP)

ChatGPT connectors can't send a static auth header, so the URL carries a secret.

```
MCP_HTTP_PORT=8765 MCP_SECRET=PASTE_24+_CHAR_RANDOM_SECRET RB_USER=agent RB_PASS=PASTE_PASSWORD_HERE node mcp/server.js
cloudflared tunnel --url http://127.0.0.1:8765
```

Connector URL: `https://<tunnel-host>/mcp/<MCP_SECRET>`, authentication: none.
Only the MCP port is exposed, not the dashboard. Switch to OAuth before exposing a production dashboard.

## Check

```
RB_USER=admin RB_PASS=PASTE_PASSWORD_HERE node mcp/selftest.js   # creates one "[MCP selftest]" draft
```
