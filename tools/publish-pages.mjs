import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if(!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !token) throw new Error('GitHub Actions repository and token are required.');
const base = `https://api.github.com/repos/${repository}/pages`;
const commit = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();

async function api(url,method='GET') {
  const endpoint = new URL(url);
  if(endpoint.origin !== 'https://api.github.com' || !endpoint.pathname.startsWith(`/repos/${repository}/pages`)) throw new Error('Unexpected Pages API URL.');
  const response = await fetch(endpoint,{method,
    headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'},
    signal:AbortSignal.timeout(20000)});
  const data = await response.json();
  if(method === 'POST' && response.status === 409) return {url:base+'/builds/latest'};
  if(!response.ok) throw new Error(`Pages ${method} returned HTTP ${response.status}: ${data.message || 'request failed'}`);
  return data;
}

const pages = await api(base);
if(pages.build_type !== 'legacy' || pages.source?.branch !== 'main' || pages.source?.path !== '/') {
  throw new Error('Configure Settings > Pages to publish from the main branch, / (root).');
}
// Explicitly request a native Pages build, including after a snapshot commit made by GITHUB_TOKEN.
await api(base+'/builds','POST');
// Query the documented endpoint directly; GitHub may return a repository-ID URL in the response.
const statusURL = base+'/builds/latest';
console.log(`Requested native Pages publishing for ${commit.slice(0,7)}.`);
let previous = '';
for(let attempt=0;attempt<60;attempt++) {
  const build = await api(statusURL);
  const state = `${build.status}/${build.commit || ''}`;
  if(state !== previous) {console.log(`Pages build: ${build.status}`);previous=state;}
  if(build.status === 'built' && build.commit === commit) {
    console.log(`Published: ${pages.html_url}`);
    process.exit(0);
  }
  if(build.status === 'errored') throw new Error(build.error?.message || 'Native Pages build failed.');
  await delay(5000);
}
throw new Error('Native Pages build did not finish for the requested commit within five minutes.');
