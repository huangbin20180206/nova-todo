const fs = require('fs');
const vm = require('vm');
const storeSrc = fs.readFileSync('outputs/todo-app/js/store.js','utf8');
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
vm.createContext(ctx);
vm.runInContext(storeSrc, ctx);

function assert(cond, msg){ if(!cond) throw new Error(msg); }

(async () => {
  const store = ctx.window.NovaStore.createStore(fakeDb);
  await store.init();

  // parse quick
  const parsed = store.parseQuick('明天 交报告 #工作 !! | 写大纲 / 发邮件');
  assert(parsed.ok, 'parse ok');
  assert(parsed.payload.text === '交报告', 'parse text');
  assert(parsed.payload.subtasks.length === 2, 'parse subtasks');

  // add with subtasks/notes
  const created = await store.addTodo({
    text: '写周报', notes: '含数据复盘', priority: 'high', tags: ['工作'],
    listId: 'list-work', remindEnabled: true, remindTime: '09:30',
    dueDate: store.todayKey(),
    subtasks: [{text:'收集数据'},{text:'写结论'}]
  });
  assert(created.ok, 'create todo');

  // search by subtask
  await store.setSettings({ search: '收集数据' });
  let snap = store.getSnapshot();
  assert(snap.visibleTodos.some(t => t.id === created.todo.id), 'search subtask');

  // recent searches
  await store.pushRecentSearch('收集数据');
  await store.pushRecentSearch('周报');
  snap = store.getSnapshot();
  assert(snap.recentSearches[0] === '周报', 'recent search order');

  // template save/apply/delete
  const tpl = await store.saveTemplate({ todoId: created.todo.id, name: '周报模板' });
  assert(tpl.ok && tpl.template.name === '周报模板', 'save template');
  const applied = await store.applyTemplate(tpl.template.id);
  assert(applied.ok && applied.todo.text === '写周报', 'apply template');
  const del = await store.deleteTemplate(tpl.template.id);
  assert(del.ok, 'delete template');

  // reminders upcoming
  snap = store.getSnapshot();
  assert((snap.upcomingReminders||[]).some(t => t.remindEnabled), 'upcoming reminders');

  // backup still works
  const bak = await store.createBackup('wave2');
  assert(bak.ok && bak.count >= 1, 'backup');

  // bulk attrs still work
  store.selectVisible();
  const bp = await store.bulkSetPriority('urgent');
  assert(bp.ok, 'bulk priority');

  console.log(JSON.stringify({
    ok: true,
    todos: store.getSnapshot().todos.length,
    recent: store.getSnapshot().recentSearches,
    templates: store.getSnapshot().templates.length,
    reminders: store.getSnapshot().upcomingReminders.length,
    visibleOnSubtaskSearch: store.getSnapshot().visibleTodos.length
  }, null, 2));
})().catch(err => { console.error('FAIL', err); process.exit(1); });
