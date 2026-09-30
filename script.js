(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let renderer = null;
  let ambientRenderer = null;
  let toastTimer;

  function showToast(message) {
    const toast = $('.toast');
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 3000);
  }


  let endEntry = null;
  function startEntry(replay = false) {
    if (endEntry || (!replay && reducedMotion.matches)) return;
    const gate = $('#entry-gate');
    const previousFocus = document.activeElement;
    const backgrounds = $$('#main, .site-header, .site-footer, .back-top');
    gate.hidden = false;
    gate.classList.remove('leaving');
    document.body.classList.add('gate-open');
    backgrounds.forEach(element => { element.inert = true; });
    gate.tabIndex = -1;
    gate.focus({ preventScroll: true });
    const progress = $('#entry-progress');
    const percentage = $('#entry-percentage');
    const status = $('#entry-status');
    let ready = 0;
    let fontsReady = !document.fonts;
    let displayed = 0;
    let frame = 0;
    let finishTimer = 0;
    const began = performance.now();
    const duration = reducedMotion.matches ? 200 : 3000;
    const assets = ['avatar.jpg', 'unrealengine.svg', 'unity.svg', 'godotengine.svg', 'autumn-cover.svg', 'spring-cover.svg'];
    assets.forEach(name => {
      const image = new Image();
      let settled = false;
      const settle = () => { if (!settled) { settled = true; ready++; } };
      image.onload = settle;
      image.onerror = settle;
      image.src = './assets/' + name;
      setTimeout(settle, 4500);
    });
    document.fonts?.ready.then(() => { fontsReady = true; });
    function finish(skipped = false) {
      if (!endEntry) return;
      endEntry = null;
      cancelAnimationFrame(frame);
      clearTimeout(finishTimer);
      percentage.textContent = '100';
      progress.setAttribute('aria-valuenow', '100');
      $('span', progress).style.width = '100%';
      status.textContent = skipped ? '开始浏览' : '加载完成';
      gate.classList.add('leaving');
      document.body.classList.remove('gate-open');
      backgrounds.forEach(element => { element.inert = false; });
      setTimeout(() => {
        gate.hidden = true;
        gate.classList.remove('leaving');
        if (replay && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
        renderer?.redraw();
        ambientRenderer?.redraw();
      }, reducedMotion.matches ? 20 : 850);
    }
    endEntry = () => finish(true);
    function tick(now) {
      if (!endEntry) return;
      const visualProgress = Math.min(1, (now - began) / duration);
      // The resource share tracks real local assets; the final share tracks the entrance sequence.
      const target = 55 * ready / assets.length + (fontsReady ? 10 : 0) + 15 + 20 * visualProgress;
      displayed = Math.min(target, displayed + (target - displayed) * 0.08 + 0.1);
      const number = displayed > 99.4 && target >= 100 ? 100 : Math.min(99, Math.floor(displayed));
      percentage.textContent = String(number).padStart(2, '0');
      progress.setAttribute('aria-valuenow', String(number));
      $('span', progress).style.width = displayed + '%';
      status.textContent = number < 35 ? '加载页面' : number < 75 ? '准备内容' : number < 100 ? '即将就绪' : '加载完成';
      if (number === 100) finishTimer = setTimeout(() => finish(), 180);
      else frame = requestAnimationFrame(tick);
    }
    progress.setAttribute('aria-valuenow', '0');
    $('span', progress).style.width = '0%';
    percentage.textContent = '00';
    status.textContent = '载入视觉资源';
    frame = requestAnimationFrame(tick);
  }
  $('#entry-skip').addEventListener('click', () => endEntry?.());
  $('.entry-replay').addEventListener('click', () => startEntry(true));
  $('#entry-gate').addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); endEntry?.(); }
    if (event.key === 'Tab') { event.preventDefault(); $('#entry-skip').focus(); }
  });

  const menuToggle = $('.menu-toggle');
  const navigation = $('#navigation');
  function closeMenu() {
    navigation.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', '展开导航');
  }
  menuToggle.addEventListener('click', () => {
    const open = !navigation.classList.contains('open');
    navigation.classList.toggle('open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? '收起导航' : '展开导航');
  });
  $$('.navigation a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  window.matchMedia('(min-width: 681px)').addEventListener('change', closeMenu);

  const navLinks = $$('.navigation a');
  const pageSections = $$('#main > section[id]').filter(section => section.id !== 'home');
  let scrollScheduled = false;
  function updateScroll() {
    scrollScheduled = false;
    const total = document.documentElement.scrollHeight - window.innerHeight;
    const progress = total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0;
    $('.scroll-progress').style.transform = `scaleX(${progress})`;
    $('.back-top').classList.toggle('visible', window.scrollY > 550);
    let activeId = '';
    pageSections.forEach(section => { if (section.getBoundingClientRect().top < window.innerHeight * 0.38) activeId = section.id; });
    navLinks.forEach(link => {
      const active = link.getAttribute('href') === '#' + activeId;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
  }
  function scheduleScroll() {
    if (!scrollScheduled) { scrollScheduled = true; requestAnimationFrame(updateScroll); }
  }
  window.addEventListener('scroll', scheduleScroll, { passive: true });
  window.addEventListener('resize', scheduleScroll, { passive: true });
  $('.back-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' }));
  updateScroll();

  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -15px 0px' });
    $$('.reveal').forEach(element => {
      element.classList.add('reveal-pending');
      revealObserver.observe(element);
    });
  }

  $$('[data-filter]').forEach(button => button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    $$('[data-filter]').forEach(item => {
      const active = item === button;
      item.classList.toggle('selected', active);
      item.setAttribute('aria-pressed', String(active));
    });
    let count = 0;
    $$('.work-card').forEach(card => {
      const visible = filter === 'all' || card.dataset.season === filter;
      card.hidden = !visible;
      if (visible) { count++; card.classList.add('is-visible'); }
    });
    $('#filter-status').textContent = `显示 ${count} 个作品集`;
    scheduleScroll();
  }));

  const skillTabs = $$('.skill-tab');
  function selectSkill(tab, focus = false) {
    skillTabs.forEach(item => {
      const selected = item === tab;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
    });
    if (focus) tab.focus();
  }
  skillTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectSkill(tab));
    tab.addEventListener('keydown', event => {
      let target = index;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') target = (index + 1) % skillTabs.length;
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') target = (index + skillTabs.length - 1) % skillTabs.length;
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = skillTabs.length - 1;
      else return;
      event.preventDefault();
      selectSkill(skillTabs[target], true);
    });
  });
  const narrowScreen = window.matchMedia('(max-width: 680px)');
  function updateTabOrientation() { $('.skill-tabs').setAttribute('aria-orientation', narrowScreen.matches ? 'horizontal' : 'vertical'); }
  narrowScreen.addEventListener('change', updateTabOrientation);
  updateTabOrientation();

  const dialogs = $$('.modal');
  function updateModalState() {
    document.body.classList.toggle('modal-open', dialogs.some(dialog => dialog.open));
    renderer?.redraw();
    ambientRenderer?.redraw();
  }
  function openDialog(dialog) {
    dialogs.forEach(item => { if (item !== dialog && item.open) item.close(); });
    dialog.showModal();
    updateModalState();
  }
  function closeDialog(dialog) {
    dialog.close();
    updateModalState();
  }
  dialogs.forEach(dialog => {
    $('.modal-close', dialog).addEventListener('click', () => closeDialog(dialog));
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(dialog); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog);
    });
    dialog.addEventListener('close', () => {
      updateModalState();
    });
  });
  $$('.resume-trigger').forEach(link => link.addEventListener('click', event => {
    const dialog = $('#resume-dialog');
    if (typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    closeMenu();
    openDialog(dialog);
    $('.resume-pages').scrollTop = 0;
  }));

  $('#copy-wechat').addEventListener('click', async event => {
    const value = 'f2015805589';
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        success = true;
      }
    } catch { /* Fall back for file://, denied clipboard permission, or older browsers. */ }
    if (!success) {
      const input = document.createElement('textarea');
      input.value = value;
      input.setAttribute('readonly', '');
      input.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
      document.body.append(input);
      input.select();
      try { success = document.execCommand('copy'); } catch { success = false; }
      input.remove();
      event.currentTarget?.focus();
      $('#copy-wechat').focus({ preventScroll: true });
    }
    showToast(success ? '微信号已复制：' + value : '微信号：' + value + '，请长按或手动复制');
  });

  const snapshot = window.PORTFOLIO_CONTENT || {github:{user:'f2015805589',repos:[]},zhihu:{articles:[]}};
  const githubUser = snapshot.github?.user || 'f2015805589';
  const websiteRepository = `${githubUser}.github.io`.toLowerCase();
  const isProjectRepository = repo => String(repo.name || '').toLowerCase() !== websiteRepository;
  let repositories = (snapshot.github?.repos || []).filter(isProjectRepository);
  let repoFilter = 'original';
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function arrowIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('class','icon');
    svg.setAttribute('aria-hidden','true');
    const use = document.createElementNS('http://www.w3.org/2000/svg','use');
    use.setAttribute('href','#icon-arrow');
    svg.append(use);
    return svg;
  }
  function dateLabel(value) {
    if (!value || !Number.isFinite(Date.parse(value))) return '';
    return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  }
  function trustedURL(value, host, fallback) {
    try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === host ? url.href : fallback; }
    catch { return fallback; }
  }
  function renderRepositories() {
    const grid = $('#repo-grid');
    const sorted = [...repositories].sort((a,b) => (Date.parse(b.updatedAt)||0) - (Date.parse(a.updatedAt)||0));
    const visible = sorted.filter(repo => repoFilter === 'all' || !repo.fork);
    $('#repo-count').textContent = String(visible.length).padStart(2,'0');
    const cards = visible.map(repo => {
      const card = element('a','repo-card');
      card.href = trustedURL(repo.url,'github.com',`https://github.com/${githubUser}/${encodeURIComponent(repo.name)}`);
      card.target = '_blank'; card.rel = 'noopener noreferrer';
      const top = element('div','repo-top');
      top.append(element('span','',repo.fork ? 'FORK / PUBLIC' : repo.archived ? 'ARCHIVED / PUBLIC' : 'SOURCE / PUBLIC'),arrowIcon());
      card.append(top,element('h4','repo-title',repo.name),element('p','repo-description',repo.description || '查看仓库源码、文档与更新记录。'));
      const meta = element('div','repo-meta');
      const language = element('span','repo-language');
      language.append(element('i','language-dot'),document.createTextNode(repo.language || '未标注语言'));
      const colors = {'C++':'#a9c8f5',Python:'#e9d585',JavaScript:'#eee087','C#':'#b5e89c',GLSL:'#c1a5ea'};
      $('i',language).style.background = colors[repo.language] || '#9cb9a5';
      meta.append(language,element('span','repo-stars','☆ ' + Number(repo.stars || 0)));
      card.append(meta);
      const date = dateLabel(repo.updatedAt);
      if (date) card.append(element('div','repo-updated','更新 / ' + date));
      return card;
    });
    if (!cards.length) {
      const empty = element('a','feed-empty','查看我的 GitHub 公开项目 ↗');
      empty.href = `https://github.com/${githubUser}?tab=repositories`;
      empty.target = '_blank'; empty.rel = 'noopener noreferrer'; cards.push(empty);
    }
    grid.replaceChildren(...cards);
  }
  $$('[data-repo-filter]').forEach(button => button.addEventListener('click', () => {
    repoFilter = button.dataset.repoFilter;
    $$('[data-repo-filter]').forEach(item => { const active = item === button; item.classList.toggle('selected',active); item.setAttribute('aria-pressed',String(active)); });
    renderRepositories();
  }));
  function renderArticles() {
    const articles = snapshot.zhihu?.articles || [];
    if (!articles.length) return;
    const rows = articles.map((article,index) => {
      const row = element('a','article-row');
      row.href = trustedURL(article.url,'zhuanlan.zhihu.com','https://www.zhihu.com/people/shen-feng-60-57/posts');
      row.target = '_blank'; row.rel = 'noopener noreferrer';
      const copy = element('div','article-copy');
      copy.append(element('h4','',article.title));
      if (article.excerpt) copy.append(element('p','',article.excerpt));
      const date = dateLabel(article.publishedAt);
      if (date) { const time = element('time','',date); time.dateTime = article.publishedAt; copy.append(time); }
      row.append(element('span','article-number',String(index + 1).padStart(2,'0')),copy,arrowIcon());
      return row;
    });
    $('#article-list').replaceChildren(...rows);
    $('#article-count').textContent = String(articles.length).padStart(2,'0');
    const date = dateLabel(snapshot.zhihu.syncedAt);
    $('#zhihu-sync-note').textContent = date ? '文章更新于 ' + date : '来自我的知乎文章。';
  }
  renderRepositories();
  renderArticles();
  if (snapshot.github?.syncedAt && repositories.length) $('#github-sync-note').textContent = '公开项目按最近更新时间排序 · 更新于 ' + dateLabel(snapshot.github.syncedAt);
  async function refreshRepositories() {
    if (!/^https?:$/.test(location.protocol) || !navigator.onLine) return;
    try {
      const result = [];
      for (let page = 1; page <= 20; page++) {
        const response = await fetch(`https://api.github.com/users/${encodeURIComponent(githubUser)}/repos?sort=updated&per_page=100&page=${page}`,{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(8000)});
        if (!response.ok) throw new Error('GitHub unavailable');
        const batch = await response.json();
        if (!Array.isArray(batch)) throw new Error('Unexpected response');
        result.push(...batch.filter(repo => !repo.private && repo.owner?.login?.toLowerCase() === githubUser.toLowerCase() && isProjectRepository(repo)).map(repo => ({name:repo.name,url:repo.html_url,description:repo.description||'',language:repo.language,stars:repo.stargazers_count||0,fork:!!repo.fork,archived:!!repo.archived,updatedAt:repo.updated_at})));
        if (batch.length < 100) break;
        if (page === 20) throw new Error('Pagination limit reached');
      }
      repositories = result;
      renderRepositories();
      $('#github-sync-note').textContent = '公开项目按最近更新时间排序 · 已更新';
    } catch { /* The bundled public snapshot stays visible when GitHub is temporarily unavailable. */ }
  }
  if ('IntersectionObserver' in window) {
    const contentObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { contentObserver.disconnect(); refreshRepositories(); }
    },{rootMargin:'250px'});
    contentObserver.observe($('#open-source'));
  } else { refreshRepositories(); }

  function createRenderer() {
    const canvas = $('#shader-canvas');
    const viewport = $('#lab-viewport');
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'low-power', premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL unavailable');

    const vertexSource = `
      attribute vec2 aPosition;
      void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
    `;
    const fragmentSource = `
      precision highp float;
      uniform vec2 uResolution;
      uniform vec2 uRotation;
      uniform vec3 uAccent;
      uniform float uRoughness;
      uniform vec2 uPointer;
      uniform float uPulse;
      mat3 rx(float a) {
        float c=cos(a),s=sin(a);
        return mat3(1.,0.,0., 0.,c,s, 0.,-s,c);
      }
      mat3 ry(float a) {
        float c=cos(a),s=sin(a);
        return mat3(c,0.,-s, 0.,1.,0., s,0.,c);
      }
      float shape(vec3 p) {
        vec3 q = rx(uRotation.y) * ry(uRotation.x) * p;
        float a = atan(q.y,q.x);
        return length(vec2(length(q.xy)-0.97,q.z))-0.29;
      }
      vec3 normalAt(vec3 p) {
        vec2 e=vec2(0.003,0.);
        return normalize(vec3(shape(p+e.xyy)-shape(p-e.xyy),shape(p+e.yxy)-shape(p-e.yxy),shape(p+e.yyx)-shape(p-e.yyx)));
      }
      void main() {
        vec2 uv=(2.0*gl_FragCoord.xy-uResolution)/uResolution.y;
        vec3 ro=vec3(0.,0.,4.7);
        vec3 rd=normalize(vec3(uv,-3.15));
        float t=0.;
        float d=1.;
        for(int i=0;i<64;i++) {
          d=shape(ro+rd*t);
          if(d<0.003 || t>7.0) break;
          t+=d*0.9;
        }
        if(t>7.0 || d>0.012) { gl_FragColor=vec4(0.); return; }
        vec3 p=ro+rd*t;
        vec3 n=normalAt(p);
        vec3 v=-rd;
        vec3 reflected=reflect(rd,n);
        vec3 light=normalize(vec3(-2.+uPointer.x*2.5,3.5+uPointer.y*2.,4.));
        vec3 fill=normalize(vec3(3.,0.5,2.));
        float nv=max(dot(n,v),0.);
        float fresnel=pow(1.-nv,3.);
        float wrap=max(dot(n,light)*0.6+0.4,0.);
        float filmPhase=dot(reflected,vec3(.55,.8,-.35))*0.65+nv*.35;
        vec3 film=0.5+0.5*cos(6.28318*(filmPhase+vec3(0.,.23,.48)));
        vec3 base=mix(uAccent*.65,film,.32);
        float spec=pow(max(dot(n,normalize(light+v)),0.),mix(170.,8.,uRoughness));
        float spec2=pow(max(dot(n,normalize(fill+v)),0.),mix(90.,6.,uRoughness));
        float ao=clamp(0.72+0.25*length(p.xy),0.6,1.);
        vec3 color=base*(.16+wrap*.7)*ao;
        color+=vec3(.82,1.,.68)*spec*1.8*(1.-uRoughness*.55);
        color+=vec3(.61,.55,1.)*spec2*.65;
        color+=mix(vec3(.32,.43,.62),uAccent,.45)*fresnel*.65;
        float stripe=pow(max(sin(reflected.y*3.+reflected.x*1.5),0.),20.);
        color+=vec3(.62,.74,.86)*stripe*(1.-uRoughness)*.42;
        float softbox=pow(max(1.-abs(reflected.y-.32)*4.,0.),4.);
        color+=vec3(1.1,1.25,1.02)*softbox*.55;
        float pulse=sin(uPulse*3.14159);
        color+=uAccent*pulse*(.15+.4*max(sin(atan(p.y,p.x)*2.-uPulse*12.),0.));
        color=color/(color+vec3(.6));
        color=pow(color,vec3(.9));
        vec3 local=rx(uRotation.y)*ry(uRotation.x)*p;
        float phi=atan(local.y,local.x);
        float theta=atan(local.z,length(local.xy)-0.97);
        float meridian=1.-smoothstep(.018,.047,abs(sin(phi*12.)));
        float parallel=1.-smoothstep(.018,.047,abs(sin(theta*7.)));
        float wire=max(meridian,parallel);
        float grey=dot(color,vec3(.299,.587,.114));
        vec3 graphite=mix(vec3(.54+grey*.4),vec3(.27,.30,.26),wire*.7);
        gl_FragColor=vec4(graphite,1.);
      }
    `;
    function compile(source, type) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const reason = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(reason);
      }
      return shader;
    }
    const vertex = compile(vertexSource, gl.VERTEX_SHADER);
    const fragment = compile(fragmentSource, gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader link failed');
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniforms = Object.fromEntries(['uResolution', 'uRotation', 'uAccent', 'uRoughness', 'uPointer', 'uPulse'].map(name => [name, gl.getUniformLocation(program, name)]));
    let yaw = -0.35;
    let pitch = 0.55;
    let autoRotate = !reducedMotion.matches;
    let visible = true;
    let frame = 0;
    let lastTimestamp = 0;
    let lastDraw = 0;
    let contextLost = false;
    let disposed = false;
    let pointer = [0, 0];
    let targetPointer = [0, 0];
    let scrollValue = window.scrollY * 0.002;
    let targetScroll = scrollValue;
    let pulseStarted = -2000;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.25);
      const rect = viewport.getBoundingClientRect();
      const width = Math.min(760, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(width * rect.height / Math.max(rect.width, 1)));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    function draw() {
      if (contextLost || disposed) return;
      resize();
      gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
      gl.uniform2f(uniforms.uRotation, yaw + pointer[0] * 0.32 + scrollValue * 0.2, pitch + pointer[1] * 0.22 + Math.sin(scrollValue) * 0.08);
      gl.uniform3fv(uniforms.uAccent, [0.72, 0.95, 0.48]);
      gl.uniform1f(uniforms.uRoughness, 0.13);
      gl.uniform2f(uniforms.uPointer, pointer[0], pointer[1]);
      gl.uniform1f(uniforms.uPulse, Math.min(1, Math.max(0, (performance.now() - pulseStarted) / 1400)));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    function canAnimate() { return (autoRotate || performance.now() - pulseStarted < 1400) && visible && !document.hidden && !document.body.classList.contains('modal-open') && !document.body.classList.contains('gate-open') && !contextLost && !disposed; }
    function tick(timestamp) {
      frame = 0;
      const elapsed = lastTimestamp ? Math.min((timestamp - lastTimestamp) / 1000, 0.05) : 0;
      lastTimestamp = timestamp;
      if (canAnimate() && autoRotate) yaw += elapsed * 0.10;
      pointer[0] += (targetPointer[0] - pointer[0]) * 0.1;
      pointer[1] += (targetPointer[1] - pointer[1]) * 0.1;
      scrollValue += (targetScroll - scrollValue) * 0.12;
      if (timestamp - lastDraw > 31) { draw(); lastDraw = timestamp; }
      if (canAnimate()) frame = requestAnimationFrame(tick);
    }
    function redraw() {
      if (disposed || contextLost) return;
      if (!frame) { lastTimestamp = 0; draw(); if (canAnimate()) frame = requestAnimationFrame(tick); }
    }
    function resetModel() {
      yaw = -0.35;
      pitch = 0.55;
      pointer = [0, 0];
      pulseStarted = -2000;
      autoRotate = !reducedMotion.matches;
      redraw();
    }
    function pulse() { pulseStarted = performance.now(); redraw(); }
    function trackPointer(x, y) {
      targetPointer = [x / window.innerWidth * 2 - 1, 1 - y / window.innerHeight * 2];
      if (reducedMotion.matches) { pointer = [...targetPointer]; }
      redraw();
    }
    window.addEventListener('pointermove', event => trackPointer(event.clientX,event.clientY), {passive:true});
    window.addEventListener('touchmove', event => { if(event.touches[0]) trackPointer(event.touches[0].clientX,event.touches[0].clientY); }, {passive:true});
    window.addEventListener('scroll', () => { targetScroll = window.scrollY * 0.002; if(reducedMotion.matches) scrollValue = targetScroll; redraw(); }, {passive:true});
    window.addEventListener('pointerdown', event => { if (!event.target.closest('a,button,input,summary,dialog,#entry-gate')) pulse(); }, {passive:true});
    canvas.addEventListener('dblclick', resetModel);
    canvas.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pulse(); return; }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'ArrowLeft') yaw -= 0.12;
      if (event.key === 'ArrowRight') yaw += 0.12;
      if (event.key === 'ArrowUp') pitch = Math.max(-1.5, pitch - 0.12);
      if (event.key === 'ArrowDown') pitch = Math.min(1.5, pitch + 0.12);
      redraw();
    });
    const resizeObserver = new ResizeObserver(redraw);
    resizeObserver.observe(viewport);
    let visibilityObserver;
    if ('IntersectionObserver' in window) {
      visibilityObserver = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; redraw(); }, { threshold: 0 });
      visibilityObserver.observe(viewport);
    }
    document.addEventListener('visibilitychange', redraw);
    reducedMotion.addEventListener('change', () => { autoRotate = !reducedMotion.matches; redraw(); });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      contextLost = true;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      showRendererFallback();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      disposed = true;
      resizeObserver.disconnect();
      visibilityObserver?.disconnect();
      // Keep the dependable fallback until the next page load after a GPU reset.
    });
    window.addEventListener('pagehide', () => { if (frame) cancelAnimationFrame(frame); frame = 0; });
    window.addEventListener('pageshow', redraw);
    $('#model-fallback').classList.add('webgl-ready');
    redraw();
    return { redraw };
  }
  function showRendererFallback() {
    $('#model-fallback').classList.remove('webgl-ready');
    $('.lab').classList.add('renderer-fallback');
    $('#shader-canvas').hidden = true;
    $('#shader-canvas').tabIndex = -1;
    $('#canvas-hint').textContent = '线框预览';
  }

  function createAmbientBackground() {
    const canvas = $('#ambient-canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let target = {x:width * .72,y:height * .42};
    let pointer = {...target};
    let scroll = window.scrollY;
    let displayedScroll = scroll;
    let lastScroll = scroll;
    let impulse = 0;
    let frame = 0;
    let lastDraw = 0;
    let lastTimestamp = 0;
    let time = 0;
    let lastRipple = 0;
    let lastTrail = 0;
    let lastInteraction = 0;
    const ripples = [];
    const trail = [];
    const points = Array.from({length:40},(_,i)=>({x:((i*137+91)%997)/997,y:((i*223+17)%991)/991}));
    const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
    const wrap = (value,range) => ((value % range) + range) % range;

    function canAnimate() {
      return !document.hidden && !document.body.classList.contains('gate-open') && !document.body.classList.contains('modal-open') && !reducedMotion.matches;
    }
    function resize() {
      width = window.innerWidth; height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.round(width*ratio); canvas.height = Math.round(height*ratio);
      context.setTransform(ratio,0,0,ratio,0,0);
      redraw();
    }
    function draw() {
      context.clearRect(0,0,width,height);
      const now = performance.now();
      const mobile = width < 680;
      const motion = displayedScroll * .055;
      const count = mobile ? 14 : 22;
      while(ripples.length && now-ripples[0].born>1600) ripples.shift();
      while(trail.length && now-trail[0].born>460) trail.shift();
      const waves = reducedMotion.matches ? [] : ripples.map(ripple=>({
        ...ripple, age:clamp((now-ripple.born)/1600,0,1),
        radius:12+(1-Math.pow(1-clamp((now-ripple.born)/1600,0,1),2))*(mobile?130:180)
      }));
      const curvePoint = (line,y) => {
        const baseX = width*(.12+line/(count-1)*.92);
        const amplitude = (mobile?24:52)*(1+line/count*.32);
        let x = baseX + Math.sin((y+motion)/height*4.5+time*.4+line*.15)*amplitude;
        x += Math.cos(y/height*2.6-time*.21+line*.24)*18 + impulse*4;
        const proximity = Math.exp(-Math.pow((y-pointer.y)/190,2)-Math.pow((baseX-pointer.x)/(mobile?160:270),2));
        x += (pointer.x-baseX)*proximity*.24;
        for(const wave of waves) {
          const distance = Math.hypot(x-wave.x,y-wave.y);
          x += (x-wave.x)/Math.max(1,distance)*Math.exp(-Math.pow((distance-wave.radius)/32,2))*12*(1-wave.age);
        }
        return {x,y};
      };
      function strokeCurve(line,start,end) {
        context.beginPath();
        for(let y=start;y<end;y+=18) {
          const point = curvePoint(line,y);
          if(y===start) context.moveTo(point.x,y); else context.lineTo(point.x,y);
        }
        const endPoint = curvePoint(line,end);
        context.lineTo(endPoint.x,end);
        context.stroke();
      }
      // Fine contour lines share one flow field. Their density increases toward the hero object.
      context.lineWidth = .65;
      for(let line=0;line<count;line++) {
        const strength = .07+Math.sin(line/count*Math.PI/2)*.09;
        context.strokeStyle = `rgba(93,112,81,${strength})`;
        strokeCurve(line,-32,height+32);
        // Short line segments travel along the same contours; there is no glow or blur.
        if(line%3===1) {
          const head = wrap(time*(mobile?37:50)+line*height*.21+motion,height+180)-90;
          context.strokeStyle = `rgba(79,104,65,${mobile ? .29 : .34})`;
          context.lineWidth = .95;
          strokeCurve(line,head,head+(mobile?42:62));
          const point = curvePoint(line,head+(mobile?42:62));
          context.fillStyle = 'rgba(71,95,57,.38)';
          context.fillRect(point.x-1,point.y-1,2,2);
          context.lineWidth = .65;
        }
      }

      // Three horizontal drafting guides drift independently of the contour field.
      context.setLineDash([1,15]);
      context.lineDashOffset = -time*9;
      context.strokeStyle = 'rgba(90,108,79,.065)';
      context.lineWidth = .7;
      for(let row=0;row<3;row++) {
        const y = wrap(height*(.24+row*.29)-motion*.24,height);
        context.beginPath();
        context.moveTo(0,y);
        context.bezierCurveTo(width*.3,y+Math.sin(time*.3+row)*20,width*.7,y-impulse*3,width,y+7);
        context.stroke();
      }
      context.setLineDash([]);
      context.lineDashOffset = 0;

      points.slice(0,mobile?24:40).forEach((point,i)=>{
        const x = point.x*width + Math.sin(time*.25+i)*12+(pointer.x-width/2)*.018;
        const y = wrap(point.y*height-motion*(.3+point.x)+Math.cos(time*.3+i)*8,height);
        const near = Math.max(0,1-Math.hypot(x-pointer.x,y-pointer.y)/200);
        context.strokeStyle = `rgba(91,112,78,${.14+near*.19})`;
        context.lineWidth = .7;
        context.beginPath();context.moveTo(x-2.5,y);context.lineTo(x+2.5,y);context.moveTo(x,y-2.5);context.lineTo(x,y+2.5);context.stroke();
      });

      for(const wave of waves) {
        context.strokeStyle = `rgba(81,106,67,${.23*Math.pow(1-wave.age,1.8)})`;
        context.lineWidth = .65;
        context.beginPath();
        context.ellipse(wave.x,wave.y,wave.radius,wave.radius*.77,-.25,.15,Math.PI*1.7);
        context.stroke();
      }
      if(!reducedMotion.matches) {
        for(let i=1;i<trail.length;i++) {
          const age = clamp((now-trail[i].born)/460,0,1);
          context.strokeStyle = `rgba(81,106,67,${.21*(1-age)})`;
          context.lineWidth = .65;
          context.beginPath();context.moveTo(trail[i-1].x,trail[i-1].y);context.lineTo(trail[i].x,trail[i].y);context.stroke();
        }
      }
    }
    function tick(timestamp) {
      frame = 0;
      const elapsed = lastTimestamp ? Math.min((timestamp-lastTimestamp)/1000,.05) : 0;
      lastTimestamp = timestamp;
      const easing = 1-Math.exp(-elapsed*9);
      pointer.x += (target.x-pointer.x)*easing;
      pointer.y += (target.y-pointer.y)*easing;
      displayedScroll += (scroll-displayedScroll)*easing;
      impulse *= Math.exp(-elapsed*3.5);
      if(canAnimate()) time += elapsed;
      if(timestamp-lastDraw>32) { draw(); lastDraw=timestamp; }
      if(canAnimate()) frame=requestAnimationFrame(tick); else lastTimestamp=0;
    }
    function redraw() {
      if(!frame) { draw(); lastTimestamp=0; if(canAnimate()) frame=requestAnimationFrame(tick); }
    }
    function addRipple(x,y,force=false) {
      const now = performance.now();
      if(!canAnimate() || now-lastRipple<(force?110:160)) return;
      const previous = ripples[ripples.length-1];
      if(!force && previous && Math.hypot(x-previous.x,y-previous.y)<42) return;
      ripples.push({x,y,born:now});
      if(ripples.length>(width<680?5:8)) ripples.shift();
      lastRipple = now;
    }
    function track(x,y) {
      target={x,y};
      const now=performance.now();
      lastInteraction=now;
      if(reducedMotion.matches) pointer={...target};
      else {
        addRipple(x,y);
        if(now-lastTrail>20) {trail.push({x,y,born:now});if(trail.length>24)trail.shift();lastTrail=now;}
      }
      redraw();
    }
    window.addEventListener('pointermove',event=>track(event.clientX,event.clientY),{passive:true});
    window.addEventListener('touchmove',event=>{const touch=event.touches[0];if(touch)track(touch.clientX,touch.clientY);},{passive:true});
    window.addEventListener('pointerdown',event=>{if(!event.target.closest('a,button,input,summary,dialog,#entry-gate'))addRipple(event.clientX,event.clientY,true);redraw();},{passive:true});
    window.addEventListener('scroll',()=>{
      scroll=window.scrollY;
      const movement=scroll-lastScroll;
      impulse=clamp(impulse+movement*.022,-8,8);
      lastScroll=scroll;
      if(reducedMotion.matches) displayedScroll=scroll;
      else if(Math.abs(movement)>5 && performance.now()-lastInteraction>250) addRipple(width*.72,height*.58,true);
      redraw();
    },{passive:true});
    window.addEventListener('resize',resize,{passive:true});
    document.addEventListener('visibilitychange',redraw);
    reducedMotion.addEventListener('change',redraw);
    window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;});
    window.addEventListener('pageshow',redraw);
    resize();
    return {redraw};
  }
  try { renderer = createRenderer(); } catch { showRendererFallback(); }
  try { ambientRenderer = createAmbientBackground(); } catch { /* Content remains available without the background canvas. */ }
  startEntry();
})();
