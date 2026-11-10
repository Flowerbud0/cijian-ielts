import {words,chapters,contextCount} from './content.js';
import {project,buildQueue,localDay,parseBackup,escapeHtml as h} from './core.js';
import {EventStore} from './store.js';
import {configured,getClient,signInWithGitHub,signOut,synchronize,oauthFailure} from './cloud.js';

const $=id=>document.getElementById(id), byId=new Map(words.map(w=>[w.id,w]));
let store, client=null,user=null, syncBusy=false,syncAgain=false,syncTimer,toastTimer;
let session=null,flipped=false,translated=false,selected=null,spell=false,spellAnswered=false,search='',authBusy=false,expandedChapters=false;
let authGeneration=0;
const theme=localStorage.getItem('cijian.theme')||'system';document.documentElement.dataset.theme=theme;
try{store=new EventStore();}catch(e){$('app').innerHTML=`<h1>记录需要检查</h1><p>${h(e.message)}</p><button class="lp-button" id="recover-raw">下载本机原始记录</button>`;$('recover-raw').onclick=()=>download('cijian-recovery.txt',localStorage.getItem('cijian.events.v1.guest')||'','text/plain');throw e;}

function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function state(){return project(store.events);}
function add(kind,id,value){store.add(kind,id,value);scheduleSync();}
function download(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function route(){return location.hash.slice(1)||'home';}
function saveSession(){if(session)sessionStorage.setItem('cijian.session.'+store.scope,JSON.stringify(session));else sessionStorage.removeItem('cijian.session.'+store.scope);}
function restoreSession(){try{session=JSON.parse(sessionStorage.getItem('cijian.session.'+store.scope)||'null');if(session&&(!Array.isArray(session.queue)||!Number.isInteger(session.index)||session.queue.some(id=>!byId.has(id))))session=null;}catch{session=null;}}
restoreSession();
function go(page){if(location.hash==='#'+page)render();else location.hash=page;}
function status(message){$('sync-status').textContent=message;$('sync-now').hidden=!user;}
function refreshStatus(){status(user?'已登录 · 尚未确认云端同步':'访客模式 · 记录仅存本机');$('account').textContent=user?'我的账号':'登录同步';}
function scheduleSync(){if(!user||!client)return;status('已保存到本机 · 等待同步');clearTimeout(syncTimer);syncTimer=setTimeout(sync,1500);}
async function sync(){
 if(!user||!client)return;
 if(syncBusy){syncAgain=true;return;}
 if(!navigator.onLine){status('离线 · 已保存到本机，联网后同步');return;}
 const currentStore=store,uid=user.id;syncBusy=true;status('正在同步…');
 try{await synchronize(currentStore,client);if(user?.id===uid&&store===currentStore){status('已同步 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}));if(route()!=='study')render();}}
 catch(e){if(user?.id===uid){status('同步未完成 · 本机记录仍保留');toast('同步未完成：'+e.message);}}
 finally{syncBusy=false;if(syncAgain){syncAgain=false;scheduleSync();}}
}
async function setUser(next){
 const generation=++authGeneration;if(next?.id===user?.id)return;
 let nextStore;try{nextStore=new EventStore(next?.id||'guest');}catch(e){$('app').textContent=e.message;toast('当前账号记录无法读取，请备份后检查。');return;}
 user=next||null;clearTimeout(syncTimer);session=null;flipped=false;selected=null;store=nextStore;restoreSession();
 refreshStatus();render();if(user&&generation===authGeneration)await sync();
}
async function initCloud(){
 if(!configured())return;
 const failure=oauthFailure(location.href);
 if(failure){const url=new URL(location.href);for(const key of ['error','error_code','error_description'])url.searchParams.delete(key);history.replaceState(null,'',url);}
 try{client=await getClient();const {data,error}=await client.auth.getSession();if(error)throw error;await setUser(data.session?.user||null);client.auth.onAuthStateChange((_event,s)=>{setTimeout(()=>setUser(s?.user||null),0);});}
 catch(e){status('同步服务暂不可用 · 本机记录可用');toast(e.message);}
 if(failure){openAccount();if($('auth-message'))$('auth-message').textContent=failure;else toast(failure);}
}

function start(chapter=0,mode='mixed',ids=null,spelling=false){
 const queue=ids||buildQueue(words,state(),{chapter,mode});
 if(!queue.length){toast(mode==='review'?'当前没有到期词。可以先学习新词。':'当前没有可学新词。可能已达到今日计划，或本章词条仍在整理。');return;}
 session={queue,index:0,chapter,mode,spelling,startedAt:Date.now()};flipped=false;translated=false;selected=null;spellAnswered=false;saveSession();go('study');
}
function render(){
 const page=route();document.querySelectorAll('nav a').forEach(a=>{if(a.hash==='#'+page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 if(page==='study')renderStudy();else if(page==='saved')renderSaved();else if(page==='settings')renderSettings();else if(page==='stats')renderStats();else renderHome();
}
function searchResults(){const q=search.trim().toLowerCase();if(!q)return '';const hits=words.filter(w=>w.word.toLowerCase().includes(q));return '<div class="word-list"><p class="lp-muted">匹配 '+hits.length+' 个词，显示前 30 个。点击可直接练习。</p>'+hits.slice(0,30).map(w=>`<button class="word-row lp-plain" data-practice="${h(w.id)}"><span><b>${h(w.word)}</b><br><span class="lp-muted">${h(w.meaning.slice(0,100))}</span></span><span class="lp-pill">${w.tokens.length?'语境词卡':'基础词卡'}</span></button>`).join('')+'</div>';}
function wordDetails(w){return `${w.collocation?`<div class="lp-block"><div class="lp-label">常用搭配</div><span class="lp-collocation">${h(w.collocation)}</span></div>`:''}${w.tokens.length?`<div class="lp-block"><div class="lp-label"><span>雅思语境 · 点击单词查看本句词义</span><button class="lp-iconbutton" data-speak="${h(w.tokens.map(t=>t.text).join(' '))}" aria-label="朗读整句">听</button></div><div class="lp-sentence">${sentenceHTML(w)}</div><div id="lookup-slot">${lookupHTML(w)}</div><button class="lp-link" id="translate" aria-expanded="${translated}">${translated?'收起':'展开'}整句翻译</button>${translated?`<p class="lp-translation">${h(w.translation)}</p>`:''}</div>`:'<p class="lp-muted mt">基础词卡 · 本词的语境例句与辨析仍在补充，可先练习释义、拼写并记录自己的例句。</p>'}${w.extra.length?`<details><summary>扩展学习 · 词形、搭配与辨析</summary><div class="lp-expansion">${w.extra.map(([label,text])=>`<p><b>${h(label)}</b><br>${h(text)}</p>`).join('')}</div></details>`:''}<p class="lp-muted source-note">${h(w.source)} · <a href="./sources.html" target="_blank" rel="noopener">来源说明</a></p>`;}
function chapterTiles(){const s=state();const query=search.trim().toLowerCase();let list=chapters.map((title,i)=>({title,id:i+1,entries:words.filter(w=>w.chapters.includes(i+1))}));if(query)list=list.filter(c=>c.title.includes(query)||c.entries.some(w=>w.word.includes(query)));else if(!expandedChapters)list=list.slice(0,6);return list.map(c=>{const learnt=c.entries.filter(w=>s.progress[w.id]).length;const due=c.entries.filter(w=>s.progress[w.id]?.due<=Date.now()).length;return `<button class="lp-chapter ${c.entries.length?'lp-current':''}" data-start="${c.id}" ${c.entries.length?'':'disabled'}><span class="lp-chapter-num">CHAPTER ${String(c.id).padStart(2,'0')}</span><span class="lp-chapter-title">${h(c.title)}</span><span class="lp-chapter-meta">${c.entries.length?`${c.entries.length} 个词 · 已学 ${learnt} · 待复习 ${due}`:'词条整理中'}</span>${c.entries.length?`<div class="lp-progressline"><div class="lp-progressfill" style="width:${learnt/c.entries.length*100}%"></div></div>`:''}<span class="lp-chapter-foot">${c.entries.length?'进入学习 →':'暂未开放'}</span></button>`;}).join('')||'<p class="lp-muted">没有匹配的章节或词条。</p>';}
function renderHome(){const s=state(),today=Object.values(s.firstStudy).filter(d=>d===localDay()).length,due=buildQueue(words,s,{mode:'review'}).length;
 $('app').innerHTML=`<div class="lp-hero"><div><div class="lp-overline">ONE WORD, IN CONTEXT</div><h1>按自己的节奏，<br>把单词放进语境。</h1><p class="lp-subtitle">今天新学 ${today} 词 · 待复习 ${due} 词</p><div class="row mt"><button class="lp-button lp-primary" data-start="0">${due?'先复习，再学新词':'开始学习'}</button><button class="lp-button" id="review-only">只复习</button>${session&&session.index<session.queue.length?'<button class="lp-button" id="resume">继续上次学习</button>':''}</div><p class="lp-muted mt">已收录 ${words.length.toLocaleString()} 个词目 · 22 章。${contextCount} 张词卡含原创语境例句，其余可先学习基础释义。</p></div><section class="lp-settings"><h3>我的学习节奏</h3><div class="lp-settings-top"><button class="lp-plain" data-mode="planned" aria-pressed="${s.settings.mode==='planned'}">每日计划</button><button class="lp-plain" data-mode="free" aria-pressed="${s.settings.mode==='free'}">自由背</button></div>${s.settings.mode==='planned'?`<label class="lp-field">每日新词<input id="daily-goal" type="number" min="1" max="200" value="${s.settings.goal}"></label>`:'<p class="lp-muted">不限新词数量，随时结束。</p>'}<p class="lp-muted">到期复习单独安排；未完成的新词目标不累计。</p></section></div><div class="lp-librarytop"><h2>章节词库</h2><input id="chapter-search" class="lp-search" type="search" placeholder="搜索章节或单词" value="${h(search)}" aria-label="搜索章节或单词"></div><div id="word-results">${searchResults()}</div><div id="chapter-tiles" class="lp-chapters">${chapterTiles()}</div>`;
 const more=document.createElement('button');more.className='lp-link';more.textContent=expandedChapters?'收起章节 ↑':'展开全部 22 章 ↓';more.onclick=()=>{expandedChapters=!expandedChapters;renderHome();};$('app').append(more);
 $('chapter-search').oninput=e=>{search=e.target.value;$('chapter-tiles').innerHTML=chapterTiles();$('word-results').innerHTML=searchResults();more.hidden=!!search;};
 $('daily-goal')?.addEventListener('change',e=>{const goal=Math.max(1,Math.min(200,Math.round(Number(e.target.value)||20)));try{add('settings','',{...s.settings,goal});renderHome();}catch(e){toast(e.message);}});
 $('review-only').onclick=()=>start(0,'review');$('resume')?.addEventListener('click',()=>go('study'));
}
function sentenceHTML(w){return w.tokens.map((t,i)=>`<button class="lp-token ${selected===i?'lp-selected':''}" data-token="${i}" aria-label="查看 ${h(t.text)} 的本句词义">${h(t.text)}</button>`).join(' ');}
function lookupId(t){return words.find(w=>w.word===t.lemma)?.id||'lookup:'+t.lemma;}
function lookupHTML(w){if(selected===null)return '';const t=w.tokens[selected];const id=lookupId(t);const bookmarked=state().bookmarks[id];return `<div class="lookup-inline"><div class="row between"><span class="lp-pill">本句词义</span><button class="lp-iconbutton" id="close-inline" aria-label="关闭词义">×</button></div><h2 class="lookupword">${h(t.text.replace(/[.,]/g,''))}</h2><p class="lp-muted">原形 / 短语：${h(t.lemma)}</p><p class="mt">${h(t.meaning)}</p><div class="row mt"><button class="lp-button" data-speak="${h(t.lemma)}">听发音</button><button class="lp-button" id="save-lookup" ${bookmarked?'disabled':''}>${bookmarked?'已加入生词本':'加入生词本'}</button></div></div>`;}
function renderStudy(){
 if(!session){$('app').innerHTML='<div class="empty"><h2>选择一个章节开始学习</h2><a href="#home">返回章节词库</a></div>';return;}
 if(session.index>=session.queue.length){$('app').innerHTML=`<div class="empty"><span class="lp-pill">本轮完成</span><h1>这一轮，先到这里。</h1><p class="lp-muted">已完成 ${session.queue.length} 个${session.spelling?'拼写':'回忆'}练习，记录已保存到本机。</p><div class="row"><button class="lp-button lp-primary" data-start="0">继续学习</button><a href="#home" class="lp-button">返回章节</a></div><p class="lp-muted">忘记的词会稍后再次进入复习，不会被标记为熟悉。</p></div>`;return;}
 const w=byId.get(session.queue[session.index]);spell=session.spelling;
 const s=state(),p=s.progress[w.id],bookmarked=s.bookmarks[w.id];
 $('app').innerHTML=`<div class="study-wrap"><div class="lp-breadcrumb"><a href="#home">← 章节词库</a><span>/ ${h(chapters[w.chapters[0]-1])}</span><span style="margin-left:auto">${session.index+1} / ${session.queue.length}</span></div><article class="lp-word-card"><div class="lp-word-top"><span>${spell?'拼写练习':p?'复习词':'新词'}</span><button class="lp-link" id="save-main">${bookmarked?'已收藏 ✓':'加入生词本'}</button></div>${spell?`<div class="lp-front"><h2>${h(w.meaning)}</h2><button class="lp-button mt" data-speak="${h(w.word)}">听单词</button><form id="spelling-form" class="stack mt"><input class="wideinput" id="spelling-input" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="输入英文拼写" placeholder="输入英文拼写" required><button class="lp-button lp-primary">检查拼写</button></form><div class="feedback" id="spelling-feedback" aria-live="polite"></div><button id="spell-next" class="lp-button mt" hidden>下一个</button></div>`:`<div class="lp-headword"><h1>${h(w.word)}</h1><button class="lp-iconbutton" data-speak="${h(w.word)}" aria-label="朗读当前单词">听</button></div><div class="lp-pron">${h(w.ipa||"音标待补充")}</div>${flipped?`<div class="lp-meaning"><small>${h(w.pos)}</small>${h(w.meaning)}</div>${wordDetails(w)}<details><summary>我的笔记${s.notes[w.id]?' · 已保存':''}</summary><textarea class="lp-note" id="note" maxlength="4000" placeholder="写下你的理解或例句…">${h(s.notes[w.id]||'')}</textarea><button class="lp-link" id="save-note">保存笔记</button></details><div class="lp-rating"><button class="lp-button" data-grade="again">忘记</button><button class="lp-button" data-grade="hard">模糊</button><button class="lp-button lp-primary" data-grade="good">认识</button></div><p class="review-help">按本次回忆评价 · 1 忘记 / 2 模糊 / 3 认识</p>`:'<div class="lp-front"><p>先回忆词义，再翻开答案。</p><button class="lp-button lp-primary" id="flip">翻开词卡</button><p class="review-help">也可以按空格翻卡</p></div>'}`}</article><div class="row between mt"><button class="lp-link" id="pause">暂停，稍后继续</button><button class="lp-link" id="feedback">反馈词条问题</button></div></div>`;
 $('flip')?.addEventListener('click',()=>{flipped=true;renderStudy();});
 $('translate')?.addEventListener('click',()=>{saveNote();translated=!translated;renderStudy();});
 $('save-main').onclick=()=>{add('bookmark',w.id,!bookmarked);renderStudy();};
 $('save-note')?.addEventListener('click',()=>{saveNote();toast('笔记已保存');});
 wireLookup(w);
 $('pause').onclick=()=>{saveNote();saveSession();go('home');};
 $('feedback').onclick=()=>{const issue=prompt('请描述这个词条的问题（仅下载反馈文件，不会自动发送）：');if(issue?.trim())download('词条反馈-'+w.word+'.json',JSON.stringify({word:w.word,id:w.id,issue:issue.trim(),version:'0.2.0'},null,2));};
 $('spelling-form')?.addEventListener('submit',e=>{e.preventDefault();if(spellAnswered)return;const correct=$('spelling-input').value.trim().toLowerCase()===w.word.toLowerCase();try{add('spelling',w.id,correct);spellAnswered=true;$('spelling-feedback').textContent=correct?'拼写正确 ✓':'正确拼写：'+w.word;$('spelling-form').querySelector('button').disabled=true;$('spell-next').hidden=false;}catch(e){toast(e.message);}});
 $('spell-next')?.addEventListener('click',()=>{session.index++;spellAnswered=false;saveSession();renderStudy();});
}
function wireLookup(w){$('close-inline')?.addEventListener('click',()=>{selected=null;$('lookup-slot').innerHTML='';document.querySelectorAll('.lp-token').forEach(b=>b.classList.remove('lp-selected'));});$('save-lookup')?.addEventListener('click',()=>{try{const t=w.tokens[selected],id=lookupId(t);add('bookmark',id,true);const context=`${t.lemma}：${t.meaning}\n原句：${w.tokens.map(x=>x.text).join(' ')}`;const old=state().notes[id]||'';if(!old.includes(context))add('note',id,(old?old+'\n\n':'')+context);$('lookup-slot').innerHTML=lookupHTML(w);wireLookup(w);toast('已加入生词本，并保留原句');}catch(e){toast(e.message);}});}
function saveNote(){const note=$('note');if(!note||!session)return;const id=session.queue[session.index];if(note.value!==(state().notes[id]||''))add('note',id,note.value);}
function rate(grade){if(!session||!flipped||session.spelling)return;try{saveNote();add('review',session.queue[session.index],grade);session.index++;flipped=false;translated=false;selected=null;saveSession();renderStudy();}catch(e){toast(e.message);}}
function renderSaved(){const s=state();const ids=Object.keys(s.bookmarks).filter(id=>s.bookmarks[id]);$('app').innerHTML=`<div class="row between"><div><h1>我的生词本</h1><p class="lp-subtitle">${ids.length} 个收藏 · 例句里遇到的词，也有自己的位置。</p></div><button class="lp-button" id="practice-saved">练习已收录词卡</button></div><div class="word-list">${ids.map(id=>{const w=byId.get(id);return `<div class="word-row"><div><h2>${h(w?.word||id.replace(/^lookup:/,''))}</h2><p class="lp-muted">${h(w?.meaning||s.notes[id]?.split('\n')[0]||'例句收藏词')}</p>${!w?`<details><summary>查看原句</summary><p>${h(s.notes[id]||'')}</p><p class="lp-muted">此词尚无完整词卡，暂不进入自动复习。</p></details>`:''}</div><div class="row"><button class="lp-button" data-speak="${h(w?.word||id.replace(/^lookup:/,''))}">听</button>${w?`<button class="lp-button" data-practice="${h(id)}">学习</button>`:''}<button class="lp-link" data-remove="${h(id)}">移出收藏</button></div></div>`;}).join('')||'<div class="empty"><p>还没有收藏。在词卡或例句查词处，点击“加入生词本”。</p><a href="#home">去学习</a></div>'}</div>`;$('practice-saved').onclick=()=>{const queue=ids.filter(id=>byId.has(id));if(!queue.length){toast('暂时没有已收录的完整词卡');return;}start(0,'saved',queue);};}
function renderStats(){const s=state();const learnt=Object.keys(s.progress).filter(id=>byId.has(id));const familiar=learnt.filter(id=>s.progress[id].streak>=3).length;const miss=Object.entries(s.spelling).filter(([,p])=>!p.lastCorrect).map(([id])=>id).filter(id=>byId.has(id));$('app').innerHTML=`<h1>学习记录</h1><p class="lp-subtitle">学过一次与多次回忆成功，分开记录。</p><div class="section mt"><div class="stat-values"><div><strong>${learnt.length}</strong>已学词条</div><div><strong>${familiar}</strong>连续三次认识</div><div><strong>${buildQueue(words,s,{mode:'review'}).length}</strong>到期复习</div></div></div><div class="row mt"><button class="lp-button lp-primary" id="spell-start">练习拼写</button><button class="lp-button" id="spell-mistakes">只练上次拼错的词（${miss.length}）</button></div><div class="word-list">${learnt.map(id=>{const p=s.progress[id],sp=s.spelling[id];return `<div class="word-row"><div><h3>${h(byId.get(id).word)}</h3><p class="lp-muted">回忆 ${p.count} 次 · 下次复习 ${h(new Date(p.due).toLocaleString('zh-CN'))}</p></div><span class="lp-muted">${sp?`拼写正确 ${sp.correct}/${sp.total}`:'尚未练习拼写'}</span></div>`;}).join('')||'<p class="lp-muted">完成一次回忆练习后，这里就会出现记录。</p>'}</div>`;$('spell-start').onclick=()=>start(0,'spelling',(learnt.length?learnt:words.map(w=>w.id)).slice(0,10),true);$('spell-mistakes').onclick=()=>{if(!miss.length){toast('暂无拼错的词');return;}start(0,'spelling',miss,true);};}
function renderSettings(){const s=state();$('app').innerHTML=`<h1>设置与备份</h1><p class="lp-subtitle">进度属于你，可以随时导出。</p><div class="settings-grid mt"><section class="section stack"><h2>阅读与发音</h2><label>界面外观<select id="theme"><option value="system">跟随系统</option><option value="light">柔和浅色</option><option value="dark">柔和深色</option></select></label><label>朗读速度<select id="speech-rate"><option value="0.75">较慢</option><option value="0.9">适中</option><option value="1">正常</option></select></label><p class="lp-muted">发音使用设备提供的英语语音，实际音色与设备有关。</p></section><section class="section stack"><h2>数据备份</h2><button class="lp-button" id="export">导出学习记录</button><label>合并导入词间备份<input class="wideinput" id="import" type="file" accept=".json,application/json"></label><p class="lp-muted">导入只合并记录，不会清空已有进度；同一条记录不会重复计数。</p><p id="import-status" aria-live="polite"></p></section><section class="section stack"><h2>当前账号</h2><p>${user?h(user.email||'已登录'):'访客 · 仅保存在当前浏览器'}</p><button class="lp-button" id="account-settings">${user?'管理同步':'登录同步'}</button><p class="lp-muted">${user?'每个账号的本机记录独立保存。访客记录需要主动选择合并。':'清理浏览器数据会移除本机记录，请定期导出备份。'}</p></section><section class="section stack"><h2>词库与复习</h2><p>${words.length.toLocaleString()} 个词目 · 22 章 · ${contextCount} 张语境词卡</p><p class="lp-muted">章节参照公开词目表，基础释义取自 ECDICT；不是教材原文或官方授权电子书。词典释义尚未逐条完成语境校订，其余词条例句与辨析仍在补充。</p><a href="./sources.html" target="_blank" rel="noopener">查看内容来源与覆盖情况</a><a href="./data/chapter-headwords.csv" download>下载章节词目表 CSV</a><p class="lp-muted">当前使用分级间隔复习：忘记约10分钟后再见，模糊约1天后复习，连续认识逐步延长间隔。尚不属于个性化预测算法。</p></section></div>`;
 $('theme').value=localStorage.getItem('cijian.theme')||'system';$('theme').onchange=e=>{localStorage.setItem('cijian.theme',e.target.value);document.documentElement.dataset.theme=e.target.value;};$('speech-rate').value=localStorage.getItem('cijian.speech-rate')||'.9';if(!$('speech-rate').value)$('speech-rate').value='0.9';$('speech-rate').onchange=e=>localStorage.setItem('cijian.speech-rate',e.target.value);
 $('export').onclick=()=>download('词间学习备份-'+localDay()+'.json',store.exportText());$('account-settings').onclick=openAccount;
 $('import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>20*1024*1024)throw Error('备份不能超过20MB');const rows=parseBackup(await file.text());const before=store.events.length;store.merge(rows);$('import-status').textContent='导入完成，新增 '+(store.events.length-before)+' 条记录。';scheduleSync();}catch(error){$('import-status').textContent='导入失败：'+error.message;}finally{e.target.value='';}};
}
function speak(text){if(!('speechSynthesis' in window)){toast('当前浏览器不支持语音朗读');return;}const u=new SpeechSynthesisUtterance(text);const voices=speechSynthesis.getVoices();u.voice=voices.find(v=>v.lang==='en-GB')||voices.find(v=>v.lang.startsWith('en'))||null;u.lang=u.voice?.lang||'en-GB';u.rate=Number(localStorage.getItem('cijian.speech-rate')||.9);u.onerror=e=>{if(e.error!=='interrupted'&&e.error!=='canceled')toast('语音未能播放，请检查系统英语语音和音量。');};speechSynthesis.cancel();speechSynthesis.speak(u);}
function openAccount(){
 const content=$('account-content');
 if(!configured()){content.innerHTML='<p class="mt">云同步服务尚未启用。你现在可以在访客模式下学习，进度会保存在本机。</p><p class="lp-muted mt">服务启用后，可以把访客记录合并到自己的账号。</p><button class="lp-button mt" id="account-export">先导出备份</button>';$('account-export').onclick=()=>download('词间学习备份-'+localDay()+'.json',store.exportText());}
 else if(user){content.innerHTML=`<p class="mt">${h(user.email||'已登录')}</p><div class="stack mt"><button class="lp-button" id="account-sync">立即同步</button><button class="lp-button" id="merge-guest">将本机访客记录合并到此账号</button><button class="lp-button" id="logout">退出账号</button></div><p class="lp-muted mt">退出后切换回访客记录，不会删除账号已保存的数据。</p>`;$('account-sync').onclick=sync;$('merge-guest').onclick=()=>{try{const guest=new EventStore();store.merge(guest.events);scheduleSync();toast('访客记录已合并到当前账号，正在安排同步');render();}catch(e){toast(e.message);}};$('logout').onclick=async()=>{try{await sync();await signOut();await setUser(null);$('account-dialog').close();toast('已退出账号');}catch(e){toast(e.message);}};}
 else {content.innerHTML='<p class="lp-muted mt">使用 GitHub 账号登录，在不同设备上同步你的学习记录。</p><button class="lp-button lp-primary mt" id="github-login">使用 GitHub 登录</button><p class="lp-muted mt">每位同学使用自己的 GitHub 账号。访客记录不会自动上传，登录后可以主动合并。</p><p class="mt" id="auth-message" aria-live="polite"></p>';
  $('github-login').onclick=async()=>{if(authBusy)return;authBusy=true;$('github-login').disabled=true;$('auth-message').textContent='正在前往 GitHub…';try{await signInWithGitHub();}catch(error){$('auth-message').textContent='登录未完成：'+error.message;authBusy=false;$('github-login').disabled=false;}};
 }

 if(!$('account-dialog').open)$('account-dialog').showModal();
}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;try{
 if(b.dataset.start!==undefined)start(Number(b.dataset.start));
 if(b.dataset.mode){const s=state();add('settings','',{...s.settings,mode:b.dataset.mode});renderHome();}
 if(b.dataset.grade)rate(b.dataset.grade);
 if(b.dataset.speak)speak(b.dataset.speak);
 if(b.dataset.token!==undefined){selected=Number(b.dataset.token);const w=byId.get(session.queue[session.index]);$('lookup-slot').innerHTML=lookupHTML(w);document.querySelectorAll('[data-token]').forEach(x=>x.classList.toggle('lp-selected',Number(x.dataset.token)===selected));wireLookup(w);}
 if(b.dataset.remove){add('bookmark',b.dataset.remove,false);renderSaved();}
 if(b.dataset.practice)start(0,'saved',[b.dataset.practice]);
 }catch(error){toast(error.message);}});
document.addEventListener('keydown',e=>{if(route()!=='study'||$('account-dialog').open||/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)||e.target.isContentEditable||session?.spelling)return;if(e.code==='Space'&&!flipped){e.preventDefault();flipped=true;renderStudy();}else if(flipped&&['1','2','3'].includes(e.key))rate(['again','hard','good'][Number(e.key)-1]);});
window.addEventListener('hashchange',()=>{saveNote();render();});
window.addEventListener('storage',e=>{if(e.key===store.key){try{store.load();if(route()!=='study')render();}catch(error){toast(error.message);}}});
window.addEventListener('online',sync);window.addEventListener('offline',()=>{if(user)status('离线 · 本机记录保留');});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();else{try{saveNote();}catch{}}});
$('account').onclick=openAccount;$('sync-now').onclick=sync;
$('wordbook-status').textContent=words.length.toLocaleString()+' 词 · '+contextCount+' 张语境词卡';
refreshStatus();render();initCloud();
