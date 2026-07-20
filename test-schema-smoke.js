const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname);
const files = [path.join(root,'js/schema.js'), path.join(root,'js/store.js')];
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
const localStorageData = {
  'todo-app.v1': JSON.stringify({ todos: [{ id:'legacy-1', text:'旧数据任务', completed:false, createdAt:1 }] })
};
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
vm.createContext(ctx);
for (const f of files) vm.runInContext(fs.readFileSync(f,'utf8'), ctx);

(async () => {
  const store = ctx.window.NovaStore.createStore(fakeDb);
  const snap = await store.init();
  if (!snap.todos.some(t => t.text === '旧数据任务')) throw new Error('legacy not migrated');
  if ((snap.schemaVersion || 0) < 4) throw new Error('schema version missing');
  if (!mem.meta.schemaVersion) throw new Error('schemaVersion not persisted');

  mem.todos = [{ id:'x', text:'坏数据', listId:'missing-list', tags:'工作,生活', completed:0 }];
  mem.meta.schemaVersion = 1;
  mem.meta.lists = [{ id:'list-work', name:'工作', icon:'💼', order:1 }];
  mem.meta.tombstones = [];
  const store2 = ctx.window.NovaStore.createStore(fakeDb);
  const snap2 = await store2.init();
  const todo = snap2.todos.find(t => t.text === '坏数据');
  if (!todo) throw new Error('todo missing');
  if (!Array.isArray(todo.subtasks)) throw new Error('subtasks not normalized');
  if (!Array.isArray(todo.tags)) throw new Error('tags not normalized');
  if (todo.listId === 'missing-list') throw new Error('orphan list not repaired');
  if ((snap2.schemaVersion || 0) < 4) throw new Error('schema not upgraded to v4');

  await store2.saveTemplate({ text:'模板A', name:'模板A', priority:'high', tags:['工作'] });
  await store2.pushRecentSearch('坏数据');
  const snap3 = store2.getSnapshot();
  if (!(snap3.templates||[]).length) throw new Error('templates broken');
  if (!(snap3.recentSearches||[]).includes('坏数据')) throw new Error('recent search broken');
  if (!Array.isArray(snap3.tombstones)) throw new Error('tombstones missing');

  console.log(JSON.stringify({
    ok: true,
    schemaVersion: snap3.schemaVersion,
    todos: snap3.todos.length,
    templates: snap3.templates.length,
    recent: snap3.recentSearches,
    listId: todo.listId,
    tags: todo.tags,
    tombstones: snap3.tombstones.length
  }, null, 2));
})().catch(err => { console.error('FAIL', err); process.exit(1); });
