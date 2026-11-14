#!/usr/bin/env node
// india-mcp over stdio (newline-delimited JSON-RPC), for Claude Desktop, Cursor and other local MCP clients.
//   npx -y india-mcp
// Also a tiny command line:  npx india-mcp search "solar" --state Gujarat --min 50000000
import { createInterface } from 'node:readline';
import { handleBody, VERSION } from '../src/server.js';
import { makeApi, callTool } from '../src/tools.js';

const api = makeApi({ base: process.env.INDIA_MCP_API || undefined });
const argv = process.argv.slice(2);

if (argv[0] === '--version' || argv[0] === '-v') {
  console.log(VERSION);
} else if (argv[0] === 'search' || argv[0] === 'coverage' || argv[0] === 'tender') {
  // CLI mode for quick checks.
  const flag = (n) => { const i = argv.indexOf(`--${n}`); return i > 0 ? argv[i + 1] : undefined; };
  const nums = (v) => (v == null ? undefined : Number(v));
  const call = argv[0] === 'coverage' ? callTool('tender_coverage', {}, api)
    : argv[0] === 'tender' ? callTool('get_tender', { id: argv[1] }, api)
      : callTool('search_tenders', {
        query: argv.slice(1).filter((a, i, all) => !a.startsWith('--') && !(all[i - 1] || '').startsWith('--')).join(' ') || undefined,
        state: flag('state'), sector: flag('sector'), buyer: flag('buyer'), sort: flag('sort'),
        min_value_inr: nums(flag('min')), max_value_inr: nums(flag('max')), closes_within_days: nums(flag('closes')),
        published_within_days: nums(flag('new')), limit: nums(flag('limit')),
      }, api);
  call.then((r) => { console.log(r.content[0].text); process.exit(r.isError ? 1 : 0); });
} else if (argv[0] === '--help' || argv[0] === '-h') {
  console.log(`india-mcp ${VERSION}: Indian government tenders for AI apps (MCP).
  npx -y india-mcp                       run as an MCP server over stdio
  npx india-mcp search solar --state Gujarat --min 50000000 --closes 30 --sort value
  npx india-mcp tender <id>
  npx india-mcp coverage`);
} else {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const send = (m) => process.stdout.write(`${JSON.stringify(m)}\n`);
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); return; }
    const out = await handleBody(msg, api).catch((e) => ({ jsonrpc: '2.0', id: msg?.id ?? null, error: { code: -32603, message: e.message } }));
    if (out) send(out);
  });
}
