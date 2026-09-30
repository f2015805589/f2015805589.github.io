import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createInterface} from 'node:readline/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(path.join(root,'content-config.json'),'utf8'));
const dataFile = path.join(root,'assets','content.json');
const localDirectory = path.join(root,'.local');
const profileURL = `https://www.zhihu.com/people/${encodeURIComponent(config.zhihuUser)}/posts`;
const now = new Date().toISOString();
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';
let content;
try { content = JSON.parse(await readFile(dataFile,'utf8')); }
catch { content = {schemaVersion:1,github:{user:config.githubUser,repos:[]},zhihu:{user:config.zhihuUser,articles:[]}}; }

async function request(url, extraHeaders={}) {
  const response = await fetch(url,{headers:{'User-Agent':userAgent,...extraHeaders},signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}
function plainText(value) {
  return String(value||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
}
function normalizeArticle(item) {
  const id=String(item.id||'');
  if(!/^\d+$/.test(id) || !item.title) return null;
  const author=item.author?.url_token;
  if(author && author!==config.zhihuUser) return null;
  const time=Number(item.updated||item.updated_time||item.created||item.created_time||0);
  return {id,title:plainText(item.title),url:`https://zhuanlan.zhihu.com/p/${id}`,excerpt:plainText(item.excerpt||item.excerpt_new).slice(0,140),publishedAt:time?new Date(time*1000).toISOString():null};
}
function extractInitialData(html) {
  const match=html.match(/<script\b[^>]*\bid=["']js-initialData["'][^>]*>([\s\S]*?)<\/script>/i);
  if(!match) return [];
  const initial=JSON.parse(match[1]);
  const entities=initial.initialState?.entities||initial.entities||{};
  return Object.values(entities.articles||{}).filter(article=>article.author?.url_token===config.zhihuUser).map(normalizeArticle).filter(Boolean);
}
async function playwrightModule() {
  // This optional path lets an existing local Playwright installation be reused without copying it into the site.
  if(process.env.PORTFOLIO_MODULE_DIR) return createRequire(import.meta.url)(path.join(process.env.PORTFOLIO_MODULE_DIR,'playwright'));
  return import('playwright');
}
function launchOptions(headless) {
  return {headless,...(process.env.PORTFOLIO_BROWSER_PATH?{executablePath:process.env.PORTFOLIO_BROWSER_PATH}:{})};
}
async function login() {
  const {chromium}=await playwrightModule();
  await mkdir(localDirectory,{recursive:true});
  const browser=await chromium.launch(launchOptions(false));
  try {
    const context=await browser.newContext({locale:'zh-CN'});
    const page=await context.newPage();
    await page.goto(profileURL,{waitUntil:'domcontentloaded',timeout:30000});
    console.log('请在打开的独立浏览器中自行登录知乎。登录后，回到这个终端按 Enter。');
    const input=createInterface({input:process.stdin,output:process.stdout});
    await input.question('');
    input.close();
    if(new URL(page.url()).pathname.startsWith('/account/unhuman') || new URL(page.url()).pathname.startsWith('/signin')) throw new Error('登录尚未完成，请重新运行 zhihu:login。');
    await context.storageState({path:path.join(localDirectory,'zhihu-session.json')});
    console.log('登录状态已保存在 .local/zhihu-session.json。现在可以运行 npm run sync。');
  } finally { await browser.close(); }
}
async function browserArticles() {
  const {chromium}=await playwrightModule();
  await mkdir(localDirectory,{recursive:true});
  let storageState=process.env.ZHIHU_STORAGE_STATE;
  if(process.env.ZHIHU_SESSION_JSON) {
    storageState=path.join(localDirectory,'zhihu-session.json');
    await writeFile(storageState,process.env.ZHIHU_SESSION_JSON,{mode:0o600});
  } else if(!storageState) {
    const localState=path.join(localDirectory,'zhihu-session.json');
    try { await readFile(localState); storageState=localState; } catch { /* Anonymous public-page access. */ }
  }
  const browser=await chromium.launch(launchOptions(true));
  try {
    const context=await browser.newContext({locale:'zh-CN',viewport:{width:1280,height:900},...(storageState?{storageState}:{})});
    const page=await context.newPage();
    await page.goto(profileURL,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>document.querySelector('.List-item a[href*="zhuanlan.zhihu.com/p/"]')||location.pathname.startsWith('/account/unhuman')||location.pathname.startsWith('/signin'),null,{timeout:12000}).catch(()=>{});
    if(new URL(page.url()).pathname.startsWith('/account/unhuman')||new URL(page.url()).pathname.startsWith('/signin')) throw new Error('Zhihu requires login/security verification');
    const initial=extractInitialData(await page.content());
    if(initial.length) return initial;
    const rows=await page.evaluate(()=>[...document.querySelectorAll('.List-item')].map(row=>{
      const link=row.querySelector('.ContentItem-title a[href*="zhuanlan.zhihu.com/p/"]');
      if(!link) return null;
      return {id:new URL(link.href).pathname.split('/').pop(),title:link.textContent,excerpt:row.querySelector('.RichContent-inner')?.textContent};
    }).filter(Boolean));
    const articles=rows.map(normalizeArticle).filter(Boolean);
    if(!articles.length) throw new Error('No readable public article list in the profile page');
    return articles;
  } finally { await browser.close(); }
}
if(process.argv.includes('--login')) { await login(); process.exit(0); }

try {
  const repos=[];
  const headers={Accept:'application/vnd.github+json',...(process.env.GITHUB_TOKEN?{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`}:{})};
  for(let page=1;page<=20;page++) {
    const batch=await (await request(`https://api.github.com/users/${encodeURIComponent(config.githubUser)}/repos?sort=updated&per_page=100&page=${page}`,headers)).json();
    if(!Array.isArray(batch)) throw new Error('Unexpected GitHub response');
    repos.push(...batch.filter(repo=>!repo.private&&repo.owner?.login?.toLowerCase()===config.githubUser.toLowerCase()).map(repo=>({name:repo.name,url:repo.html_url,description:repo.description||'',language:repo.language,stars:repo.stargazers_count||0,fork:!!repo.fork,archived:!!repo.archived,updatedAt:repo.updated_at})));
    if(batch.length<100) break;
    if(page===20) throw new Error('Public repository pagination limit exceeded');
  }
  content.github={user:config.githubUser,syncedAt:now,status:'ok',repos};
  console.log(`GitHub: read ${repos.length} public repositories.`);
} catch(error) {
  content.github={...content.github,checkedAt:now,status:'unavailable'};
  console.warn(`GitHub sync unavailable (${error.message}); retaining the last snapshot.`);
}

let articles;
try {
  // Try the requested public profile first, followed by its public API and a normal browser render.
  try { articles=extractInitialData(await (await request(profileURL,{Accept:'text/html'})).text()); } catch { /* Use the next public read route. */ }
  if(!articles?.length) {
    try {
      const response=await (await request(`https://www.zhihu.com/api/v4/members/${encodeURIComponent(config.zhihuUser)}/articles?limit=20&offset=0`,{Accept:'application/json'})).json();
      if(!Array.isArray(response.data)) throw new Error('No public article data');
      articles=response.data.map(normalizeArticle).filter(Boolean);
    } catch { articles=await browserArticles(); }
  }
  content.zhihu={user:config.zhihuUser,profileURL,syncedAt:now,status:'ok',articles:articles.slice(0,config.maxArticles||8)};
  console.log(`Zhihu: read ${content.zhihu.articles.length} public articles.`);
} catch(error) {
  content.zhihu={...content.zhihu,user:config.zhihuUser,profileURL,checkedAt:now,status:'blocked'};
  console.warn(`Zhihu profile cannot be read anonymously (${error.message}); retaining existing article records.`);
}
if(Array.isArray(config.manualArticles) && config.manualArticles.length) {
  const unique=new Map((content.zhihu.articles||[]).map(article=>[article.url,article]));
  for(const article of config.manualArticles) {
    const url=new URL(article.url);
    if(url.protocol!=='https:'||url.hostname!=='zhuanlan.zhihu.com'||!/^\/p\/\d+\/?$/.test(url.pathname)||!article.title) continue;
    unique.set(url.href,{id:url.pathname.split('/').filter(Boolean).pop(),title:plainText(article.title),url:url.href,excerpt:plainText(article.excerpt).slice(0,140),publishedAt:article.publishedAt||null});
  }
  content.zhihu.articles=[...unique.values()].slice(0,config.maxArticles||8);
}
await mkdir(path.dirname(dataFile),{recursive:true});
const json=JSON.stringify(content,null,2);
await writeFile(dataFile,json+'\n');
await writeFile(path.join(root,'assets','content-data.js'),'window.PORTFOLIO_CONTENT = '+json.replace(/</g,'\\u003c')+';\n');
console.log('Public content snapshot saved. No login state is included in site assets.');
