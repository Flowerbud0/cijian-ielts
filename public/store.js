import {mergeEvents,validateEvent,localDay} from './core.js';
export class EventStore {
 constructor(scope='guest',storage=localStorage){this.storage=storage;this.scope=scope;this.events=[];this.load();}
 get key(){return 'cijian.events.v1.'+this.scope;}
 load(){const raw=this.storage.getItem(this.key);if(!raw){this.events=[];return;}try{const rows=JSON.parse(raw);if(!Array.isArray(rows))throw Error('invalid');this.events=mergeEvents(rows);}catch{throw Error('本机学习记录无法读取。请先导出原始记录，勿清空浏览器数据。');}}
 merge(rows){const disk=JSON.parse(this.storage.getItem(this.key)||'[]');const next=mergeEvents(this.events,disk,rows);try{this.storage.setItem(this.key,JSON.stringify(next));}catch{throw Error('本机存储已满或不可用，本次修改未保存。请导出备份。');}this.events=next;return next;}
 add(kind,wordId,value){const event=validateEvent({id:crypto.randomUUID(),kind,wordId,value,at:Date.now(),day:localDay()});this.merge([event]);return event;}
 exportText(){return JSON.stringify({app:'cijian',version:1,exportedAt:new Date().toISOString(),scope:this.scope,events:this.events},null,2);}
}
