// Deploys the hosted connector (Cloudflare Worker "india-mcp") and sets its MCP_FEED_KEY secret.
//   node deploy.mjs              deploy code
//   node deploy.mjs --secrets    deploy and (re)set the secret from ~/.secrets/india-mcp.txt
// Needs ~/.secrets/cloudflare.txt (ACCOUNT=..., TOKEN=...). Uses the wrangler installed in ../tender-platform.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const secretsDir = path.join(os.homedir(), '.secrets');
const readKV = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*(\w+)\s*[=:]\s*(\S+)\s*$/)).filter(Boolean).map((m) => [m[1].toUpperCase(), m[2]]));
const cf = readKV(path.join(secretsDir, 'cloudflare.txt'));
const wrangler = path.join(os.homedir(), 'tender-platform', 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler');
const env = { ...process.env, CLOUDFLARE_API_TOKEN: cf.TOKEN, CLOUDFLARE_ACCOUNT_ID: cf.ACCOUNT, WRANGLER_SEND_METRICS: 'false' };

const out = execFileSync(`"${wrangler}" deploy`, { cwd: path.dirname(fileURLToPath(import.meta.url)), shell: true, env, encoding: 'utf8' });
console.log(out.split('\n').filter((l) => /https:\/\/|Uploaded|Deployed|Current Version/i.test(l)).join('\n'));

if (process.argv.includes('--secrets')) {
  // Wrangler's `secret put` is flaky on this network, so use the REST API.
  const value = fs.readFileSync(path.join(secretsDir, 'india-mcp.txt'), 'utf8').trim();
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cf.ACCOUNT}/workers/scripts/india-mcp/secrets`, {
    method: 'PUT', headers: { Authorization: `Bearer ${cf.TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'MCP_FEED_KEY', text: value, type: 'secret_text' }),
  });
  const j = await r.json();
  console.log('secret MCP_FEED_KEY:', j.success ? 'set' : JSON.stringify(j.errors));
}
