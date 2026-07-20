const fs = require('fs');
const vm = require('vm');
const files = ['outputs/todo-app/js/schema.js','outputs/todo-app/js/store.js','outputs/todo-app/js/sync.js'];
const mem = { todos: [], meta: {} };
const fakeDb = {
  async getAllTodos(){ return mem.todos.map(t => Object.assign({}, t)); },
  async putTodo(todo){ const i=mem.todos.findIndex(t=>t.id===todo.id); if(i>=0) mem.todos[i]=Object.assign({},todo); else mem.todos.unshift(Object.assign({},todo)); },
  async putTodos(todos){ mem.todos = todos.map(t=>Object.assign({},t)); },
  async deleteTodo(id){ mem.todos = mem.todos.filter(t=>t.id!==id); },
  async clearTodos(){ mem.todos=[]; },
  async getMeta(key, fallback){ return Object.prototype.hasOwnProperty.call(mem.meta,key) ? JSON.parse(JSON.stringify(mem.meta[key])) : fallback; },
  async setMeta(key,value){ mem.meta[key]=JSON.parse(JSON.stringify(value)); return value; },
  async exportAll(){ return {version:2, todos:mem.todos.map(t=>Object.assign({},t)), settings: mem.meta.settings||null}; },
  async importAll(payload, mode){
    const todos=(payload.todos||[]).map(t=>Object.assign({},t));
    if(mode==='replace') mem.todos = todos; else mem.todos = mem.todos.concat(todos);
    if(payload.settings) mem.meta.settings = Object.assign({}, payload.settings);
  }
};
const localStorageData = {};
const ctx = {
  console, Date, Math, String, Array, Object, Set, Map, Number, Boolean, JSON, RegExp, Promise,
  window: { crypto: { randomUUID: () => 'id-' + Math.random().toString(16).slice(2) } },
};
ctx.global = ctx.window;
ctx.window.localStorage = {
  getItem: (k)=> Object.prototype.hasOwnProperty.call(localStorageData,k)?localStorageData[k]:null,
  setItem: (k,v)=>{ localStorageData[k]=String(v); },
  removeItem: (k)=>{ delete localStorageData[k]; }
};
// fake fetch for gist
let remote = null;
ctx.fetch = async (url, options={}) => {
  const method = (options.method || 'GET').toUpperCase();
  if (url.includes('/gists') && method === 'POST') {
    remote = { id: 'gist123', updated_at: new Date().toISOString(), files: { 'nova-todo-sync.json': { content: options.body } } };
    // body already stringified content object
    const parsed = JSON.parse(options.body);
    remote.files['nova-todo-sync.json'].content = parsed.files['nova-todo-sync.json'].content;
    return { ok:true, status:201, text: async()=>JSON.stringify(remote) };
  }
  if (url.includes('/gists/') && method === 'GET') {
    if (!remote) return { ok:false, status:404, text: async()=>JSON.stringify({message:'Not Found'}) };
    return { ok:true, status:200, text: async()=>JSON.stringify(remote) };
  }
  if (url.includes('/gists/') && method === 'PATCH') {
    const parsed = JSON.parse(options.body);
    remote.files['nova-todo-sync.json'].content = parsed.files['nova-todo-sync.json'].content;
    remote.updated_at = new Date().toISOString();
    return { ok:true, status:200, text: async()=>JSON.stringify(remote) };
  }
  return { ok:false, status:500, text: async()=>JSON.stringify({message:'unknown '+url}) };
};
vm.createContext(ctx);
for (const f of files) vm.runInContext(fs.readFileSync(f,'utf8'), ctx);

(async () => {
  const storeA = ctx.window.NovaStore.createStore(fakeDb);
  await storeA.init();
  await storeA.addTodo({ text: '设备A任务', priority:'high', tags:['同步'] });
  await storeA.setSyncConfig({ enabled:true, provider:'gist', token:'t', autoSync:false });
  const syncA = ctx.window.NovaSync.createSync(storeA);
  const pushRes = await syncA.syncNow('push');
  if (!pushRes.ok) throw new Error('push failed');
  if (!remote) throw new Error('remote missing');

  // device B empty db different memory - reuse same remote via fetch mock, new mem
  const memB = { todos: [], meta: {} };
  const dbB = {
    async getAllTodos(){ return memB.todos.map(t => Object.assign({}, t)); },
    async putTodo(todo){ const i=memB.todos.findIndex(t=>t.id===todo.id); if(i>=0) memB.todos[i]=Object.assign({},todo); else memB.todos.unshift(Object.assign({},todo)); },
    async putTodos(todos){ memB.todos = todos.map(t=>Object.assign({},t)); },
    async deleteTodo(id){ memB.todos = memB.todos.filter(t=>t.id!==id); },
    async clearTodos(){ memB.todos=[]; },
    async getMeta(key, fallback){ return Object.prototype.hasOwnProperty.call(memB.meta,key) ? JSON.parse(JSON.stringify(memB.meta[key])) : fallback; },
    async setMeta(key,value){ memB.meta[key]=JSON.parse(JSON.stringify(value)); return value; },
    async exportAll(){ return {version:2, todos:memB.todos.map(t=>Object.assign({},t)), settings: memB.meta.settings||null}; },
    async importAll(payload, mode){
      const todos=(payload.todos||[]).map(t=>Object.assign({},t));
      if(mode==='replace') memB.todos = todos; else memB.todos = memB.todos.concat(todos);
      if(payload.settings) memB.meta.settings = Object.assign({}, payload.settings);
    }
  };
  const storeB = ctx.window.NovaStore.createStore(dbB);
  await storeB.init();
  await storeB.addTodo({ text: '设备B本地任务', priority:'low' });
  await storeB.setSyncConfig({ enabled:true, provider:'gist', token:'t', remoteId: pushRes.remoteId });
  const syncB = ctx.window.NovaSync.createSync(storeB);
  const syncRes = await syncB.syncNow('sync');
  if (!syncRes.ok) throw new Error('sync failed');
  const snapB = storeB.getSnapshot();
  const texts = snapB.todos.map(t => t.text).sort();
  if (!texts.includes('设备A任务') || !texts.includes('设备B本地任务')) throw new Error('merge missing todos: '+texts.join(','));
  // token should remain local
  if (!storeB.getSyncConfig().token) throw new Error('token lost');
  // remote payload should not include token
  const remotePayload = JSON.parse(remote.files['nova-todo-sync.json'].content);
  if (remotePayload.settings && remotePayload.settings.sync && remotePayload.settings.sync.token) throw new Error('token leaked');
  console.log(JSON.stringify({ ok:true, remoteId: pushRes.remoteId, todosB: texts, merged: syncRes.merged, syncStatus: snapB.syncStatus }, null, 2));
})().catch(err => { console.error('FAIL', err); process.exit(1); });
