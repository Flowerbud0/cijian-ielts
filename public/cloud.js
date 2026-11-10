import {cloudConfig} from './config.js';
import {validateEvent,mergeEvents} from './core.js';
let clientPromise;
export function configured(){return Boolean(cloudConfig.url&&cloudConfig.publishableKey);}
function validateConfig(){
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cloudConfig.url))throw Error('同步服务地址未配置正确');
 const key=cloudConfig.publishableKey;
 if(key.startsWith('sb_secret_'))throw Error('禁止在网页使用服务端密钥');
 if(key.split('.').length===3){try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.role!=='anon')throw Error('invalid');}catch{throw Error('这里只允许公开的 anon / publishable key');}}
 else if(!key.startsWith('sb_publishable_'))throw Error('同步服务公开密钥无效');
}
export async function getClient(){
 if(!configured())throw Error('云同步尚未配置，当前可以使用访客学习和本地备份。');
 validateConfig();
 if(!clientPromise)clientPromise=import('https://esm.sh/@supabase/supabase-js@2.119.0').then(({createClient})=>createClient(cloudConfig.url,cloudConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}})).catch(error=>{clientPromise=null;throw error;});
 return clientPromise;
}
export function loginRedirect(href){const url=new URL(href);url.search='';url.hash='';return url.href;}
export function oauthFailure(href){const url=new URL(href);if(!url.searchParams.has('error'))return '';return url.searchParams.get('error_code')==='bad_oauth_state'?'本次登录请求已过期，请重新点击“使用 GitHub 登录”。':'GitHub 登录未完成，请重试；如果刚才取消了授权，可以继续使用访客模式。';}
export async function signInWithGitHub(){const c=await getClient();const {error}=await c.auth.signInWithOAuth({provider:'github',options:{redirectTo:loginRedirect(window.location.href)}});if(error)throw error;}
export async function signOut(){const c=await getClient();const {error}=await c.auth.signOut({scope:'local'});if(error)throw error;}
export async function synchronize(store,client){
 const scope=store.scope;
 const {data:{user},error:authError}=await client.auth.getUser();if(authError)throw authError;
 if(!user||user.id!==scope)throw Error('登录身份已改变，请重新登录后同步。');
 const remote=[];
 for(let offset=0;;offset+=1000){
  const {data,error}=await client.from('learning_events').select('id,kind,word_id,value,occurred_at,day_key').eq('user_id',scope).order('id').range(offset,offset+999);
  if(error)throw error;
  for(const row of data)remote.push(validateEvent({id:row.id,kind:row.kind,wordId:row.word_id,value:row.value,at:row.occurred_at,day:row.day_key}));
  if(data.length<1000)break;if(offset>=49000)throw Error('记录较多，请导出备份并升级同步分页方案。');
 }
 const combined=mergeEvents(store.events,remote); // Validates all data before writing anything.
 store.merge(combined);
 const ids=new Set(remote.map(e=>e.id));const pending=store.events.filter(e=>!ids.has(e.id));
 for(let i=0;i<pending.length;i+=100){const rows=pending.slice(i,i+100).map(e=>({user_id:scope,id:e.id,kind:e.kind,word_id:e.wordId,value:e.value,occurred_at:e.at,day_key:e.day}));const {error}=await client.from('learning_events').upsert(rows,{onConflict:'user_id,id',ignoreDuplicates:true});if(error)throw error;}
 return {uploaded:pending.length,downloaded:remote.length};
}
