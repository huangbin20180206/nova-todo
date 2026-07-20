const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname);
function load() {
  const files = [
    path.join(root, 'js/schema.js'),
    path.join(root, 'js/store.js'),
    path.join(root, 'js/sync.js')
  ];
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
    window: { crypto: { randomUUID: () => 'id-' + Math.random().toString(16).slice(2) }, setInterval, clearInterval, setTimeout, clearTimeout },
  setInterval, clearInterval, setTimeout, clearTimeout,
  };
  ctx.global = ctx.window;
  ctx.window.setInterval = setInterval;
  ctx.window.clearInterval = clearInterval;
  ctx.window.setTimeout = setTimeout;
  ctx.window.clearTimeout = clearTimeout;
  ctx.window.localStorage = {
    getItem: (k)=> Object.prototype.hasOwnProperty.call(localStorageData,k)?localStorageData[k]:null,
    setItem: (k,v)=>{ localStorageData[k]=String(v); },
    removeItem: (k)=>{ delete localStorageData[k]; }
  };
  let remote = null;
  ctx.fetch = async (url, options={}) => {
    const method = (options.method || 'GET').toUpperCase();
    if (url.includes('/gists') && method === 'POST') {
      remote = { id: 'gist123', updated_at: new Date().toISOString(), files: { 'nova-todo-sync.json': { content: options.body } } };
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
  return { ctx, mem, fakeDb, getRemote: () => remote, setRemote: (r)=>{ remote=r; } };
}

(async () => {
  const { ctx, fakeDb, getRemote } = load();
  const storeA = ctx.window.NovaStore.createStore(fakeDb);
  await storeA.init();
  const created = await storeA.addTodo({ text: '设备A任务', priority:'high', tags:['同步'] });
  await storeA.setSyncConfig({ enabled:true, provider:'gist', token:'t', autoSync:false });
  const syncA = ctx.window.NovaSync.createSync(storeA);
  const pushRes = await syncA.syncNow('push');
  if (!pushRes.ok) throw new Error('push failed');

  // device B
  const { ctx: ctxB } = (() => {
    // rebuild independent memory by reloading modules into new context through load clone
    return { ctx };
  })();

  // Create independent store B with separate mem
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
  let snapB = storeB.getSnapshot();
  let texts = snapB.todos.map(t => t.text).sort();
  if (!texts.includes('设备A任务') || !texts.includes('设备B本地任务')) throw new Error('merge missing todos: '+texts.join(','));
  if (!storeB.getSyncConfig().token) throw new Error('token lost');
  const remotePayload = JSON.parse(getRemote().files['nova-todo-sync.json'].content);
  if (remotePayload.settings && remotePayload.settings.sync && remotePayload.settings.sync.token) throw new Error('token leaked');

  // delete on A should not resurrect on B after mutual sync
  await storeA.deleteTodo(created.todo.id);
  const pushDel = await syncA.syncNow('push');
  if (!pushDel.ok) throw new Error('push delete failed');
  const pullDel = await syncB.syncNow('sync');
  if (!pullDel.ok) throw new Error('pull delete failed');
  snapB = storeB.getSnapshot();
  texts = snapB.todos.map(t => t.text);
  if (texts.includes('设备A任务')) throw new Error('deleted todo resurrected');
  if (!(snapB.tombstones || []).some(t => t.id === created.todo.id && t.entity === 'todo')) throw new Error('tombstone missing on B');

  // export should strip token
  await storeB.setSyncConfig({ token: 'secret-token' });
  const exported = await storeB.exportData();
  if (exported.settings && exported.settings.sync && exported.settings.sync.token) throw new Error('export token leak');

  // conflict-check: same id different content
  const sharedId = "conflict-todo-1";
  const now = Date.now();
  await storeA.applySyncPayload({
    todos: [{ id: sharedId, text: "本机版", updatedAt: now - 1000, createdAt: now - 2000, listId: "list-inbox", completed:false, archived:false, pinned:false, priority:"medium", tags:[], subtasks:[], notes:"", repeat:"none", remindEnabled:false, remindTime:"09:00" }],
    lists: storeA.getSnapshot().lists,
    templates: [],
    tagLibrary: [],
    tombstones: storeA.getSnapshot().tombstones || [],
    settings: storeA.getSnapshot().settings
  }, { mode: "replace" });
  await syncA.syncNow("push");
  await storeB.applySyncPayload({
    todos: [
      { id: sharedId, text: "远端旧版", updatedAt: now - 5000, createdAt: now - 6000, listId: "list-inbox", completed:false, archived:false, pinned:false, priority:"medium", tags:[], subtasks:[], notes:"", repeat:"none", remindEnabled:false, remindTime:"09:00" },
      { id: "b-only", text: "设备B本地任务", updatedAt: now, createdAt: now, listId: "list-inbox", completed:false, archived:false, pinned:false, priority:"low", tags:[], subtasks:[], notes:"", repeat:"none", remindEnabled:false, remindTime:"09:00" }
    ],
    lists: storeB.getSnapshot().lists,
    templates: [],
    tagLibrary: [],
    tombstones: storeB.getSnapshot().tombstones || [],
    settings: storeB.getSnapshot().settings
  }, { mode: "replace" });
  await storeB.setSyncConfig({ enabled:true, provider:"gist", token:"t", remoteId: pushRes.remoteId });
  const conflictSync = await syncB.syncNow("sync");
  if (!conflictSync.ok) throw new Error("conflict sync failed");
  const after = storeB.getSnapshot();
  const winner = after.todos.find(t => t.id === sharedId);
  if (!winner || winner.text !== "本机版") throw new Error("LWW winner wrong: " + (winner && winner.text));
  const conflicts = conflictSync.conflicts || after.syncStatus.lastConflicts || [];
  if (!conflicts.some(c => c.id === sharedId)) throw new Error("conflict not recorded for todo");
  if (conflicts.some(c => c.entity === "list" && c.localLabel === c.remoteLabel)) throw new Error("false list conflict");
  const cleared = await storeB.clearTombstones({ onlyExpired: true });
  if (!cleared.ok) throw new Error("clear expired failed");
  console.log(JSON.stringify({
    ok:true,
    remoteId: pushRes.remoteId,
    todosB: after.todos.map(t=>t.text).sort(),
    tombstones: (after.tombstones||[]).length,
    conflicts: conflicts.length,
    schemaVersion: after.schemaVersion,
    syncStatus: after.syncStatus
  }, null, 2));

})().catch(err => { console.error('FAIL', err); process.exit(1); });
