export const DAY = 86400000;
export const STEPS = [DAY, 3*DAY, 7*DAY, 14*DAY, 30*DAY, 60*DAY];
export const KINDS = ['review','spelling','bookmark','note','settings'];
export function localDay(time=Date.now()) {
 const d=new Date(time);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function validateEvent(e) {
 if(!e||typeof e!=='object'||Array.isArray(e)||!KINDS.includes(e.kind))throw Error('无法识别的学习记录');
 if(typeof e.id!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(e.id)||!Number.isSafeInteger(e.at)||e.at<0||e.at>Date.now()+DAY)throw Error('记录编号或时间无效');
 if(typeof e.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(e.day)||typeof e.wordId!=='string'||e.wordId.length>160)throw Error('记录格式无效');
 if(e.kind==='review'&&!['again','hard','good'].includes(e.value))throw Error('回忆评价无效');
 if(['spelling','bookmark'].includes(e.kind)&&typeof e.value!=='boolean')throw Error('记录值无效');
 if(e.kind==='note'&&(typeof e.value!=='string'||e.value.length>4000))throw Error('笔记过长');
 if(e.kind==='settings'&&(!e.value||!['planned','free'].includes(e.value.mode)||!Number.isInteger(e.value.goal)||e.value.goal<1||e.value.goal>200))throw Error('学习设置无效');
 return {id:e.id,at:e.at,day:e.day,wordId:e.wordId,kind:e.kind,value:e.kind==='settings'?{mode:e.value.mode,goal:e.value.goal}:e.value};
}
export function mergeEvents(...collections) {
 const map=new Map(); for(const entries of collections) for(const raw of entries){const e=validateEvent(raw);const previous=map.get(e.id);if(previous&&JSON.stringify(previous)!==JSON.stringify(e))throw Error('发现冲突记录，请保留备份后检查');map.set(e.id,e);}
 return [...map.values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
}
export function nextReview(previous,grade,at) {
 const p=previous||{count:0,step:-1,streak:0,due:0,last:0};
 const step=grade==='good'?Math.min(p.step+1,STEPS.length-1):grade==='hard'?Math.max(0,p.step-1):-1;
 const interval=grade==='again'?10*60000:grade==='hard'?DAY:STEPS[step];
 return {count:p.count+1,step,streak:grade==='good'?p.streak+1:0,due:at+interval,last:at,grade};
}
export function project(events) {
 const out={progress:{},spelling:{},bookmarks:{},notes:{},settings:{mode:'planned',goal:20},firstStudy:{},reviewsByDay:{}};
 for(const e of mergeEvents(events)){
  if(e.kind==='review'){out.progress[e.wordId]=nextReview(out.progress[e.wordId],e.value,e.at);out.firstStudy[e.wordId]??=e.day;out.reviewsByDay[e.day]=(out.reviewsByDay[e.day]||0)+1;}
  if(e.kind==='spelling'){const old=out.spelling[e.wordId]||{correct:0,total:0};out.spelling[e.wordId]={correct:old.correct+Number(e.value),total:old.total+1,lastCorrect:e.value};}
  if(e.kind==='bookmark')out.bookmarks[e.wordId]=e.value;
  if(e.kind==='note')out.notes[e.wordId]=e.value;
  if(e.kind==='settings')out.settings=e.value;
 }
 return out;
}
export function buildQueue(words,state,{chapter=0,mode='mixed',now=Date.now(),day=localDay(now)}={}) {
 const candidates=words.filter(w=>!chapter||w.chapters.includes(chapter));
 const due=candidates.filter(w=>state.progress[w.id]&&state.progress[w.id].due<=now).sort((a,b)=>state.progress[a.id].due-state.progress[b.id].due);
 if(mode==='review')return due.map(w=>w.id);
 const learntToday=Object.values(state.firstStudy).filter(d=>d===day).length;
 const limit=state.settings.mode==='free'?Infinity:Math.max(0,state.settings.goal-learntToday);
 const fresh=candidates.filter(w=>!state.progress[w.id]).slice(0,limit);
 return (mode==='new'?fresh:[...due,...fresh]).map(w=>w.id);
}
export function parseBackup(text) {
 if(text.length>20*1024*1024)throw Error('备份超过20MB');
 let data;try{data=JSON.parse(text);}catch{throw Error('不是有效的JSON备份');}
 if(data.app!=='cijian'||data.version!==1||!Array.isArray(data.events)||data.events.length>50000)throw Error('不是支持的词间备份');
 return mergeEvents(data.events);
}
export function escapeHtml(value) {return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
