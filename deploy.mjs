// Deploys the hosted connector to Cloudflare Pages (project "india-mcp" -> https://india-mcp.pages.dev) and sets the
// MCP_FEED_KEY secret from ~/.secrets/india-mcp.txt.
//   node deploy.mjs
// Needs ~/.secrets/cloudflare.txt (ACCOUNT=..., TOKEN=...). Uses the wrangler installed in ../tender-platform.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJECT = 'india-mcp';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const secretsDir = path.join(os.homedir(), '.secrets');
const readKV = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*(\w+)\s*[=:]\s*(\S+)\s*$/)).filter(Boolean).map((m) => [m[1].toUpperCase(), m[2]]));
const cf = readKV(path.join(secretsDir, 'cloudflare.txt'));
const api = async (p, init = {}) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cf.ACCOUNT}/${p}`, {
    ...init, headers: { Authorization: `Bearer ${cf.TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const j = await r.json();
  if (!j.success) throw new Error(`${p}: ${JSON.stringify(j.errors).slice(0, 300)}`);
  return j.result;
};

const projects = await api('pages/projects');
if (!projects.some((p) => p.name === PROJECT)) {
  await api('pages/projects', { method: 'POST', body: JSON.stringify({ name: PROJECT, production_branch: 'main' }) });
  console.log('created Pages project', PROJECT);
}
const key = fs.readFileSync(path.join(secretsDir, 'india-mcp.txt'), 'utf8').trim();
await api(`pages/projects/${PROJECT}`, {
  method: 'PATCH',
  body: JSON.stringify({ deployment_configs: { production: {
    env_vars: { MCP_FEED_KEY: { type: 'secret_text', value: key }, API_BASE: { type: 'plain_text', value: 'https://tenderdesk-020.pages.dev/api/open-tenders' } },
    compatibility_date: '2025-06-01',
  } } }),
});

const wrangler = path.join(os.homedir(), 'tender-platform', 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler');
const out = execFileSync(`"${wrangler}" pages deploy pages --project-name ${PROJECT} --branch main --commit-dirty=true`, {
  cwd: ROOT, shell: true, encoding: 'utf8',
  env: { ...process.env, CLOUDFLARE_API_TOKEN: cf.TOKEN, CLOUDFLARE_ACCOUNT_ID: cf.ACCOUNT, WRANGLER_SEND_METRICS: 'false' },
});
console.log(out.split('\n').filter((l) => /https:\/\/|Success|Uploaded|Deployment/i.test(l)).join('\n'));
const proj = await api(`pages/projects/${PROJECT}`);
console.log(`LIVE: https://${proj.subdomain}`);
