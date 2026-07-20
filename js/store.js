(function (global) {
  "use strict";
  const PRIORITY_RANK = { urgent: 4, high: 3, medium: 2, low: 1 };
  const VIEW_LABELS = { all: "全部任务", active: "进行中", completed: "已完成", today: "今日到期", overdue: "已逾期", archived: "归档", scheduled: "重复任务" };
  const REPEAT_OPTIONS = ["none", "daily", "weekly", "monthly"];
  const TAG_PALETTE = [
    { bg: "rgba(109, 124, 255, 0.18)", border: "rgba(109, 124, 255, 0.42)", text: "#c7d2fe" },
    { bg: "rgba(34, 211, 238, 0.16)", border: "rgba(34, 211, 238, 0.4)", text: "#a5f3fc" },
    { bg: "rgba(52, 211, 153, 0.16)", border: "rgba(52, 211, 153, 0.4)", text: "#a7f3d0" },
    { bg: "rgba(251, 191, 36, 0.16)", border: "rgba(251, 191, 36, 0.42)", text: "#fde68a" },
    { bg: "rgba(251, 113, 133, 0.16)", border: "rgba(251, 113, 133, 0.42)", text: "#fecdd3" },
    { bg: "rgba(167, 139, 250, 0.16)", border: "rgba(167, 139, 250, 0.42)", text: "#ddd6fe" },
    { bg: "rgba(56, 189, 248, 0.16)", border: "rgba(56, 189, 248, 0.4)", text: "#bae6fd" },
    { bg: "rgba(244, 114, 182, 0.16)", border: "rgba(244, 114, 182, 0.4)", text: "#fbcfe8" }
  ];
  function createId(){ if(global.crypto&&typeof global.crypto.randomUUID==="function") return global.crypto.randomUUID(); return "id-"+Date.now()+"-"+Math.random().toString(16).slice(2); }
  function todayKey(date){ const d=date?new Date(date):new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function uniqueTags(tags){ const seen=new Set(); const result=[]; (tags||[]).forEach(function(tag){ const cleaned=String(tag||"").trim().replace(/\s+/g," "); if(!cleaned) return; const key=cleaned.toLowerCase(); if(seen.has(key)) return; seen.add(key); result.push(cleaned); }); return result.slice(0,12); }
  function normalizeTags(input){ if(Array.isArray(input)) return uniqueTags(input); if(typeof input!=="string") return []; return uniqueTags(input.split(/[,，]/).map(function(tag){return tag.trim();}).filter(Boolean)); }
  function hashString(input){ let hash=0; const text=String(input||""); for(let i=0;i<text.length;i+=1){ hash=((hash<<5)-hash)+text.charCodeAt(i); hash|=0; } return Math.abs(hash); }
  function tagColor(name){ return TAG_PALETTE[hashString(String(name||"").toLowerCase())%TAG_PALETTE.length]; }
  function normalizePriority(value){ if(value==="low"||value==="high"||value==="urgent") return value; return "medium"; }
  function normalizeRepeat(value){ return REPEAT_OPTIONS.indexOf(value)>=0?value:"none"; }
  function normalizeRemindTime(value){ if(typeof value==="string"&&/^\d{2}:\d{2}$/.test(value)) return value; return "09:00"; }
  function addDays(dateStr,days){ const d=new Date(dateStr+"T00:00:00"); d.setDate(d.getDate()+days); return todayKey(d); }
  function addMonths(dateStr,months){ const d=new Date(dateStr+"T00:00:00"); const day=d.getDate(); d.setMonth(d.getMonth()+months); if(d.getDate()<day) d.setDate(0); return todayKey(d); }
  function nextDueDate(dueDate,repeat){ const base=dueDate&&/^\d{4}-\d{2}-\d{2}$/.test(dueDate)?dueDate:todayKey(); if(repeat==="daily") return addDays(base,1); if(repeat==="weekly") return addDays(base,7); if(repeat==="monthly") return addMonths(base,1); return null; }
  function defaultLists(){ const now=Date.now(); return [{id:"list-inbox",name:"收件箱",icon:"📥",order:1,createdAt:now},{id:"list-work",name:"工作",icon:"💼",order:2,createdAt:now+1},{id:"list-life",name:"生活",icon:"🏠",order:3,createdAt:now+2}]; }
  function normalizeList(raw,index){ const now=Date.now(); const name=String((raw&&raw.name)||"").trim()||"未命名清单"; return {id:raw&&typeof raw.id==="string"&&raw.id?raw.id:createId(),name:name.slice(0,20),icon:String((raw&&raw.icon)||"📁").slice(0,4)||"📁",order:typeof (raw&&raw.order)==="number"?raw.order:(index+1)*1000,createdAt:typeof (raw&&raw.createdAt)==="number"?raw.createdAt:now}; }
  function normalizeSubtasks(input){
    const list = Array.isArray(input) ? input : [];
    const result = [];
    list.forEach(function(item, index){
      const text = String((item && (item.text || item.title || item.name)) || "").trim();
      if(!text) return;
      result.push({
        id: item && typeof item.id === "string" && item.id ? item.id : createId(),
        text: text.slice(0, 120),
        completed: !!(item && item.completed),
        order: typeof (item && item.order) === "number" ? item.order : (index + 1) * 1000
      });
    });
    return result.slice(0, 30).sort(function(a,b){ return a.order - b.order; });
  }
  function subtaskProgress(subtasks){
    const list = Array.isArray(subtasks) ? subtasks : [];
    const total = list.length;
    const done = list.filter(function(item){ return item.completed; }).length;
    return { total: total, done: done, ratio: total ? done / total : 0 };
  }
  function pad2(n){ return String(n).padStart(2, "0"); }
  function shiftDate(base, days){
    const d = new Date((base || todayKey()) + "T00:00:00");
    d.setDate(d.getDate() + days);
    return todayKey(d);
  }
  function parseQuickAdd(raw, options){
    options = options || {};
    let text = String(raw || "").trim();
    if(!text) return { ok:false, error:"请输入待办内容，空内容不能添加。", payload:null, tokens:[] };
    const tokens = [];
    const payload = {
      text: "",
      priority: options.priority || "medium",
      dueDate: options.dueDate || null,
      tags: Array.isArray(options.tags) ? options.tags.slice() : [],
      listId: options.listId || null,
      remindEnabled: !!options.remindEnabled,
      remindTime: options.remindTime || null,
      repeat: options.repeat || "none",
      subtasks: Array.isArray(options.subtasks) ? options.subtasks.slice() : []
    };
    const lists = Array.isArray(options.lists) ? options.lists : [];
    const today = todayKey();

    // tags: #tag or ＃tag
    text = text.replace(/(^|\s)[#＃]([\w\u4e00-\u9fff-]{1,20})/g, function(_, sp, tag){
      payload.tags.push(tag);
      tokens.push("#" + tag);
      return sp;
    });

    // priority tokens
    const priorityMap = [
      { re: /(^|\s)(!!!|紧急|urgent)(?=\s|$)/i, value: "urgent", token: "紧急" },
      { re: /(^|\s)(!!|高优|高优先级|high)(?=\s|$)/i, value: "high", token: "高优" },
      { re: /(^|\s)(!|低优|低优先级|low)(?=\s|$)/i, value: "low", token: "低优" }
    ];
    priorityMap.forEach(function(item){
      if(item.re.test(text)){
        payload.priority = item.value;
        tokens.push(item.token);
        text = text.replace(item.re, " ");
      }
    });

    // list @工作 / @生活 / @收件箱 or list name match
    text = text.replace(/(^|\s)@([\w\u4e00-\u9fff-]{1,20})/g, function(_, sp, name){
      const hit = lists.find(function(list){
        return list.name === name || (list.name && list.name.indexOf(name) !== -1) || list.id === name;
      });
      if(hit){
        payload.listId = hit.id;
        tokens.push("@" + hit.name);
      } else {
        tokens.push("@" + name);
      }
      return sp;
    });

    // remind time 提醒10:30 / @10:30
    text = text.replace(/(^|\s)(?:提醒|@)?((?:[01]?\d|2[0-3]):[0-5]\d)(?=\s|$)/g, function(_, sp, tm){
      const parts = tm.split(":");
      payload.remindEnabled = true;
      payload.remindTime = pad2(parts[0]) + ":" + pad2(parts[1]);
      tokens.push("提醒" + payload.remindTime);
      return sp;
    });

    // repeat
    const repeatMap = [
      { re: /(^|\s)(每天|每日|daily)(?=\s|$)/i, value: "daily", token: "每天" },
      { re: /(^|\s)(每周|weekly)(?=\s|$)/i, value: "weekly", token: "每周" },
      { re: /(^|\s)(每月|monthly)(?=\s|$)/i, value: "monthly", token: "每月" }
    ];
    repeatMap.forEach(function(item){
      if(item.re.test(text)){
        payload.repeat = item.value;
        tokens.push(item.token);
        text = text.replace(item.re, " ");
      }
    });

    // relative dates + weekdays
    const weekMap = {"日":0,"天":0,"一":1,"二":2,"三":3,"四":4,"五":5,"六":6};
    function nextWeekday(target, minDelta){
      const now = new Date(today + "T00:00:00");
      const current = now.getDay();
      let delta = (target - current + 7) % 7;
      if(delta < (minDelta || 0)) delta += 7;
      return shiftDate(today, delta);
    }
    if(/(^|\s)(今天|今日)(?=\s|$)/.test(text)){
      payload.dueDate = today; tokens.push("今天"); text = text.replace(/(^|\s)(今天|今日)(?=\s|$)/g, " ");
    } else if(/(^|\s)(明天)(?=\s|$)/.test(text)){
      payload.dueDate = shiftDate(today, 1); tokens.push("明天"); text = text.replace(/(^|\s)(明天)(?=\s|$)/g, " ");
    } else if(/(^|\s)(后天)(?=\s|$)/.test(text)){
      payload.dueDate = shiftDate(today, 2); tokens.push("后天"); text = text.replace(/(^|\s)(后天)(?=\s|$)/g, " ");
    } else if(/(^|\s)下(?:周|星期)([日天一二三四五六])(?=\s|$)/.test(text)){
      text = text.replace(/(^|\s)下(?:周|星期)([日天一二三四五六])(?=\s|$)/g, function(_, sp, w){
        const thisWeek = nextWeekday(weekMap[w], 0);
        payload.dueDate = shiftDate(thisWeek, 7);
        tokens.push("下周" + w);
        return sp;
      });
    } else if(/(^|\s)(下周)(?=\s|$)/.test(text)){
      payload.dueDate = shiftDate(today, 7); tokens.push("下周"); text = text.replace(/(^|\s)(下周)(?=\s|$)/g, " ");
    } else {
      text = text.replace(/(^|\s)(?:周|星期)([日天一二三四五六])(?=\s|$)/g, function(_, sp, w){
        payload.dueDate = nextWeekday(weekMap[w], 0);
        tokens.push("周" + w);
        return sp;
      });
    }

    // absolute date 3月15日 / 3-15 / 2026-03-15
    text = text.replace(/(^|\s)((?:20\d{2})[-/年])?((?:0?[1-9]|1[0-2]))[-/月]((?:0?[1-9]|[12]\d|3[01]))日?(?=\s|$)/g, function(_, sp, yearPart, m, d){
      const year = yearPart ? String(yearPart).replace(/\D/g, "") : String(new Date().getFullYear());
      payload.dueDate = year + "-" + pad2(m) + "-" + pad2(d);
      tokens.push(payload.dueDate);
      return sp;
    });

    // inline checklist after | or ：子任务 a / b
    let checklistPart = "";
    const splitMatch = text.split(/\s[|｜]\s+|\s+子任务[:：]\s*/);
    if(splitMatch.length > 1){
      text = splitMatch[0];
      checklistPart = splitMatch.slice(1).join(" ");
    }
    if(checklistPart){
      checklistPart.split(/[\/、,，]/).forEach(function(part, index){
        const item = String(part || "").trim();
        if(item) payload.subtasks.push({ text: item, completed: false, order: (index + 1) * 1000 });
      });
      if(payload.subtasks.length) tokens.push("子任务x" + payload.subtasks.length);
    }

    payload.text = text.replace(/\s+/g, " ").trim();
    payload.tags = uniqueTags(payload.tags);
    payload.subtasks = normalizeSubtasks(payload.subtasks);
    if(!payload.text) return { ok:false, error:"请输入待办内容，空内容不能添加。", payload:null, tokens:tokens };
    return { ok:true, error:"", payload:payload, tokens:tokens };
  }
  function normalizeTodo(raw,index,fallbackListId){ const now=Date.now(); const text=String((raw&&raw.text)||"").trim(); return {id:raw&&typeof raw.id==="string"&&raw.id?raw.id:createId(),text:text,notes:String((raw&&raw.notes)||"").trim(),subtasks:normalizeSubtasks(raw&&raw.subtasks),completed:!!(raw&&raw.completed),archived:!!(raw&&raw.archived),pinned:!!(raw&&raw.pinned),priority:normalizePriority(raw&&raw.priority),dueDate:raw&&typeof raw.dueDate==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate)?raw.dueDate:null,tags:normalizeTags(raw&&raw.tags),listId:raw&&typeof raw.listId==="string"&&raw.listId?raw.listId:(fallbackListId||"list-inbox"),repeat:normalizeRepeat(raw&&raw.repeat),remindEnabled:!!(raw&&raw.remindEnabled),remindTime:normalizeRemindTime(raw&&raw.remindTime),lastNotifiedKey:raw&&typeof raw.lastNotifiedKey==="string"?raw.lastNotifiedKey:null,completedAt:typeof (raw&&raw.completedAt)==="number"?raw.completedAt:null,order:typeof (raw&&raw.order)==="number"?raw.order:index||now,createdAt:typeof (raw&&raw.createdAt)==="number"?raw.createdAt:now,updatedAt:typeof (raw&&raw.updatedAt)==="number"?raw.updatedAt:now}; }
  function defaultSettings(){ return {theme:"dark",view:"all",sort:"manual",search:"",activeTag:"",activeListId:"all",notificationsEnabled:false,density:"comfortable",autoBackup:true,lastBackupAt:null,recentSearches:[]}; }

  function createStore(db){
    const state={todos:[],lists:defaultLists(),settings:defaultSettings(),tagLibrary:[],templates:[],ready:false,history:[],selectedIds:[],backupPoints:[]};
    const listeners=new Set();
    let reminderTimer=null;
    function emit(){ listeners.forEach(function(fn){ try{fn(getSnapshot());}catch(error){console.error(error);} }); }
    function cloneTodos(){ return state.todos.map(function(todo){ return Object.assign({}, todo, { tags: (todo.tags||[]).slice(), subtasks: (todo.subtasks||[]).map(function(s){ return Object.assign({}, s); }) }); }); }
    function pushHistory(label){ state.history.push({ label: label || "变更", todos: cloneTodos(), selectedIds: state.selectedIds.slice(), at: Date.now() }); if (state.history.length > 30) state.history.shift(); }
    async function restoreTodos(todos){ state.todos = (todos || []).map(function(item, index){ return normalizeTodo(item, index, state.lists[0].id); }); await db.clearTodos(); if (state.todos.length) await db.putTodos(state.todos); }
    function getSnapshot(){ return {todos:state.todos.slice(),lists:state.lists.slice().sort(function(a,b){return a.order-b.order;}),settings:Object.assign({},state.settings),tagLibrary:state.tagLibrary.slice(),ready:state.ready,schemaVersion:(global.NovaSchema&&global.NovaSchema.SCHEMA_VERSION)||3,counts:getCounts(),listCounts:getListCounts(),tags:getTagStats(),managedTags:getManagedTags(),stats:getStats(),focusTodos:getFocusTodos(),visibleTodos:getVisibleTodos(),upcomingReminders:getUpcomingReminders(),selectedIds:state.selectedIds.slice(),canUndo:state.history.length>0,backupPoints:(state.backupPoints||[]).slice(0,10),lastBackupAt:state.settings.lastBackupAt||null,templates:(state.templates||[]).slice(),recentSearches:(state.settings.recentSearches||[]).slice(0,8)}; }
    function subscribe(fn){ listeners.add(fn); return function(){ listeners.delete(fn); }; }
    function listExists(id){ return state.lists.some(function(list){return list.id===id;}); }
    function ensureListId(listId){ if(listId&&listExists(listId)) return listId; return state.lists[0]?state.lists[0].id:"list-inbox"; }
    function getCounts(){ const activeListId=state.settings.activeListId||"all"; const inList=function(todo){return activeListId==="all"||todo.listId===activeListId;}; const base=state.todos.filter(function(todo){return !todo.archived&&inList(todo);}); const archived=state.todos.filter(function(todo){return todo.archived&&inList(todo);}); const today=todayKey(); return {all:base.length,active:base.filter(function(todo){return !todo.completed;}).length,completed:base.filter(function(todo){return todo.completed;}).length,today:base.filter(function(todo){return !todo.completed&&todo.dueDate===today;}).length,overdue:base.filter(function(todo){return !todo.completed&&todo.dueDate&&todo.dueDate<today;}).length,archived:archived.length,scheduled:base.filter(function(todo){return !todo.completed&&todo.repeat&&todo.repeat!=="none";}).length}; }
    function getListCounts(){ const map={}; state.lists.forEach(function(list){map[list.id]=0;}); state.todos.forEach(function(todo){ if(todo.archived||todo.completed) return; if(map[todo.listId]==null) map[todo.listId]=0; map[todo.listId]+=1; }); return map; }
    function getUsageMap(){ const map=new Map(); state.todos.forEach(function(todo){ (todo.tags||[]).forEach(function(tag){ map.set(tag,(map.get(tag)||0)+1); }); }); return map; }
    function getTagStats(){ const map=new Map(); state.todos.forEach(function(todo){ if(todo.archived) return; todo.tags.forEach(function(tag){ map.set(tag,(map.get(tag)||0)+1); }); }); state.tagLibrary.forEach(function(tag){ if(!map.has(tag)) map.set(tag,0); }); return Array.from(map.entries()).map(function(entry){ return {name:entry[0],count:entry[1],color:tagColor(entry[0])}; }).sort(function(a,b){ return b.count-a.count||a.name.localeCompare(b.name,"zh-CN"); }); }
    function getManagedTags(){ const usage=getUsageMap(); const names=uniqueTags(state.tagLibrary.concat(Array.from(usage.keys()))); return names.map(function(name){ return {name:name,count:usage.get(name)||0,inLibrary:state.tagLibrary.some(function(tag){return tag.toLowerCase()===name.toLowerCase();}),color:tagColor(name)}; }).sort(function(a,b){ return a.name.localeCompare(b.name,"zh-CN"); }); }
    async function persistTagLibrary(){ await db.setMeta("tagLibrary", state.tagLibrary); }
    async function persistLists(){ await db.setMeta("lists", state.lists); }
    async function persistSettings(){ await db.setMeta("settings", state.settings); }
    async function persistTodo(todo){ await db.putTodo(todo); }
    function ensureTagsInLibrary(tags){ const incoming=normalizeTags(tags); if(!incoming.length) return false; const existing=new Set(state.tagLibrary.map(function(tag){return tag.toLowerCase();})); let changed=false; incoming.forEach(function(tag){ if(!existing.has(tag.toLowerCase())){ state.tagLibrary.push(tag); existing.add(tag.toLowerCase()); changed=true; } }); if(changed) state.tagLibrary=uniqueTags(state.tagLibrary).sort(function(a,b){return a.localeCompare(b,"zh-CN");}); return changed; }
    function getStats(){ const activeListId=state.settings.activeListId||"all"; const live=state.todos.filter(function(todo){ return !todo.archived&&(activeListId==="all"||todo.listId===activeListId); }); const total=live.length; const completed=live.filter(function(todo){return todo.completed;}).length; const high=live.filter(function(todo){return !todo.completed&&(todo.priority==="high"||todo.priority==="urgent");}).length; const today=todayKey(); const dueSoon=live.filter(function(todo){ if(todo.completed||!todo.dueDate) return false; const diff=(new Date(todo.dueDate+"T00:00:00")-new Date(today+"T00:00:00"))/86400000; return diff>=0&&diff<=3; }).length; const repeating=live.filter(function(todo){return !todo.completed&&todo.repeat&&todo.repeat!=="none";}).length; return {completion:total?Math.round((completed/total)*100):0,high:high,dueSoon:dueSoon,repeating:repeating}; }
    function getFocusTodos(){ const today=todayKey(); const activeListId=state.settings.activeListId||"all"; return state.todos.filter(function(todo){ if(todo.archived||todo.completed) return false; if(activeListId!=="all"&&todo.listId!==activeListId) return false; const isOverdue=!!todo.dueDate&&todo.dueDate<today; const isToday=todo.dueDate===today; const isHot=todo.priority==="urgent"||todo.priority==="high"; const isRemindToday=todo.remindEnabled&&todo.dueDate===today; return isOverdue||isToday||isHot||isRemindToday; }).sort(function(a,b){ const aOverdue=a.dueDate&&a.dueDate<today?0:1; const bOverdue=b.dueDate&&b.dueDate<today?0:1; if(aOverdue!==bOverdue) return aOverdue-bOverdue; const aToday=a.dueDate===today?0:1; const bToday=b.dueDate===today?0:1; if(aToday!==bToday) return aToday-bToday; const pr=(PRIORITY_RANK[b.priority]||0)-(PRIORITY_RANK[a.priority]||0); if(pr) return pr; if(a.dueDate&&b.dueDate) return a.dueDate.localeCompare(b.dueDate); if(a.dueDate) return -1; if(b.dueDate) return 1; return a.order-b.order; }).slice(0,5); }
    function matchesView(todo,view){ const today=todayKey(); if(view==="archived") return todo.archived; if(todo.archived) return false; if(view==="active") return !todo.completed; if(view==="completed") return todo.completed; if(view==="today") return !todo.completed&&todo.dueDate===today; if(view==="overdue") return !todo.completed&&!!todo.dueDate&&todo.dueDate<today; if(view==="scheduled") return !todo.completed&&todo.repeat&&todo.repeat!=="none"; return true; }
    function sortTodos(list,sort){ const cloned=list.slice(); function pinFirst(cmp){ return function(a,b){ const pin=(b.pinned?1:0)-(a.pinned?1:0); if(pin) return pin; return cmp(a,b); }; } if(sort==="created_desc") return cloned.sort(pinFirst(function(a,b){return b.createdAt-a.createdAt;})); if(sort==="due_asc") return cloned.sort(pinFirst(function(a,b){ if(!a.dueDate&&!b.dueDate) return a.order-b.order; if(!a.dueDate) return 1; if(!b.dueDate) return -1; return a.dueDate.localeCompare(b.dueDate)||a.order-b.order; })); if(sort==="priority_desc") return cloned.sort(pinFirst(function(a,b){ return (PRIORITY_RANK[b.priority]||0)-(PRIORITY_RANK[a.priority]||0)||a.order-b.order; })); if(sort==="alpha_asc") return cloned.sort(pinFirst(function(a,b){ return a.text.localeCompare(b.text,"zh-CN")||a.order-b.order; })); return cloned.sort(pinFirst(function(a,b){return a.order-b.order;})); }
    function getVisibleTodos(){ const settings=state.settings; const keyword=(settings.search||"").trim().toLowerCase(); const activeListId=settings.activeListId||"all"; let list=state.todos.filter(function(todo){ if(activeListId!=="all"&&todo.listId!==activeListId) return false; if(!matchesView(todo,settings.view)) return false; if(settings.activeTag&&todo.tags.map(function(tag){return tag.toLowerCase();}).indexOf(settings.activeTag.toLowerCase())===-1) return false; if(!keyword) return true; const listName=(state.lists.find(function(item){return item.id===todo.listId;})||{}).name||""; const subText=(todo.subtasks||[]).map(function(s){return s.text||"";}).join(" "); const hay=[todo.text,todo.notes,listName,subText].concat(todo.tags).join(" ").toLowerCase(); return hay.indexOf(keyword)!==-1; }); return sortTodos(list,settings.sort); }
    function getUpcomingReminders(){
      const today=todayKey();
      const end=addDays(today,7);
      return state.todos.filter(function(todo){
        if(todo.archived||todo.completed||!todo.remindEnabled||!todo.dueDate) return false;
        return todo.dueDate<=end;
      }).sort(function(a,b){
        if(a.dueDate<b.dueDate) return -1; if(a.dueDate>b.dueDate) return 1;
        return String(a.remindTime||"09:00").localeCompare(String(b.remindTime||"09:00"));
      }).slice(0,12);
    }
    function reminderDueNow(todo,now){ if(!todo.remindEnabled||todo.completed||todo.archived||!todo.dueDate) return false; const today=todayKey(now); if(todo.dueDate>today) return false; const parts=(todo.remindTime||"09:00").split(":"); const hh=parseInt(parts[0],10)||9; const mm=parseInt(parts[1],10)||0; const fire=new Date(todo.dueDate+"T00:00:00"); fire.setHours(hh,mm,0,0); if(now.getTime()<fire.getTime()&&todo.dueDate===today) return false; const key=todo.dueDate+"@"+(todo.remindTime||"09:00"); return todo.lastNotifiedKey!==key; }
    async function markNotified(todo,key){ return updateTodo(todo.id,{lastNotifiedKey:key}); }
    async function checkReminders(notifier){ if(!state.settings.notificationsEnabled) return []; const now=new Date(); const due=state.todos.filter(function(todo){return reminderDueNow(todo,now);}); const fired=[]; for(const todo of due){ const key=todo.dueDate+"@"+(todo.remindTime||"09:00"); if(typeof notifier==="function"){ try{notifier(todo);}catch(error){console.warn(error);} } await markNotified(todo,key); fired.push(todo); } return fired; }
    function startReminderLoop(notifier){ stopReminderLoop(); reminderTimer=global.setInterval(function(){ checkReminders(notifier); },30000); checkReminders(notifier); }
    function stopReminderLoop(){ if(reminderTimer){ global.clearInterval(reminderTimer); reminderTimer=null; } }

    async function init(){
      const [todos,settings,lists,tagLibrary,backupPoints,templates,schemaVersion]=await Promise.all([
        db.getAllTodos(),
        db.getMeta("settings",defaultSettings()),
        db.getMeta("lists",null),
        db.getMeta("tagLibrary",null),
        db.getMeta("backupPoints",[]),
        db.getMeta("templates",[]),
        db.getMeta("schemaVersion",0)
      ]);

      // legacy localStorage v1 once
      let sourceTodos = todos || [];
      try{
        const legacyRaw=global.localStorage.getItem("todo-app.v1");
        if(legacyRaw&&(!sourceTodos||!sourceTodos.length)){
          const legacy=JSON.parse(legacyRaw);
          if(legacy&&Array.isArray(legacy.todos)&&legacy.todos.length){
            sourceTodos=legacy.todos;
          }
        }
      }catch(error){ console.warn("legacy migration skipped", error); }

      const migrated = (global.NovaSchema && typeof global.NovaSchema.runMigrations === "function")
        ? global.NovaSchema.runMigrations({
            fromVersion: typeof schemaVersion === "number" ? schemaVersion : 0,
            todos: sourceTodos,
            lists: lists,
            settings: settings,
            tagLibrary: tagLibrary,
            templates: templates,
            backupPoints: backupPoints,
            helpers: {
              normalizeTodo: normalizeTodo,
              normalizeList: normalizeList,
              normalizeTemplate: normalizeTemplate,
              uniqueTags: uniqueTags,
              defaultLists: defaultLists,
              defaultSettings: defaultSettings
            }
          })
        : null;

      if(migrated){
        state.lists = migrated.lists;
        state.todos = migrated.todos;
        state.settings = Object.assign(defaultSettings(), migrated.settings || {});
        state.tagLibrary = migrated.tagLibrary || [];
        state.templates = migrated.templates || [];
        state.backupPoints = migrated.backupPoints || [];
        if(migrated.migrated){
          await persistLists();
          await db.putTodos(state.todos);
          await persistSettings();
          await persistTagLibrary();
          await db.setMeta("templates", state.templates);
          await db.setMeta("backupPoints", state.backupPoints);
          await db.setMeta("schemaVersion", migrated.version || (global.NovaSchema && global.NovaSchema.SCHEMA_VERSION) || 3);
          if(migrated.log && migrated.log.length){ console.info("Nova schema migration:", migrated.log.join(", ")); }
        } else {
          await db.setMeta("schemaVersion", migrated.version || 3);
        }
      } else {
        // fallback old path
        if(Array.isArray(lists)&&lists.length){ state.lists=lists.map(function(item,index){return normalizeList(item,index);}); }
        else { state.lists=defaultLists(); await persistLists(); }
        state.todos=(sourceTodos||[]).map(function(item,index){ return normalizeTodo(item,index,state.lists[0].id); }).filter(function(item){return !!item.text;});
        state.settings=Object.assign(defaultSettings(), settings||{});
        state.tagLibrary=Array.isArray(tagLibrary)?uniqueTags(tagLibrary):[];
        state.templates=Array.isArray(templates)?templates.map(function(item,index){return normalizeTemplate(item,index);}).filter(Boolean):[];
        state.backupPoints=Array.isArray(backupPoints)?backupPoints:[];
        await db.setMeta("schemaVersion", (global.NovaSchema && global.NovaSchema.SCHEMA_VERSION) || 3);
      }

      if(!Array.isArray(state.settings.recentSearches)) state.settings.recentSearches=[];
      state.ready=true; maybeAutoBackup(false).catch(function(){}); emit(); return getSnapshot();
    }
    async function addTodo(input){
      const text=String((input&&input.text)||"").trim(); if(!text) return {ok:false,error:"请输入待办内容，空内容不能添加。"};
      pushHistory("新增任务");
      const now=Date.now(); const minOrder=state.todos.reduce(function(min,todo){return Math.min(min,todo.order);},now);
      const preferredList=input&&input.listId?input.listId:(state.settings.activeListId!=="all"?state.settings.activeListId:state.lists[0].id);
      const todo=normalizeTodo({text:text,notes:input&&input.notes,subtasks:input&&input.subtasks,priority:input&&input.priority,dueDate:input&&input.dueDate,tags:input&&input.tags,listId:ensureListId(preferredList),repeat:input&&input.repeat,remindEnabled:input&&input.remindEnabled,remindTime:input&&input.remindTime,pinned:input&&input.pinned,completed:false,archived:false,order:minOrder-1,createdAt:now,updatedAt:now},0,state.lists[0].id);
      state.todos.unshift(todo); const libraryChanged=ensureTagsInLibrary(todo.tags); await persistTodo(todo); if(libraryChanged) await persistTagLibrary(); emit(); return {ok:true,todo:todo};
    }
    async function updateTodo(id,patch){
      const index=state.todos.findIndex(function(todo){return todo.id===id;}); if(index===-1) return {ok:false,error:"任务不存在。"};
      const current=state.todos[index];
      const merged=Object.assign({},current,patch,{id:current.id,createdAt:current.createdAt,updatedAt:Date.now()});
      if(patch&&Object.prototype.hasOwnProperty.call(patch,"listId")) merged.listId=ensureListId(patch.listId);
      if(patch&&Object.prototype.hasOwnProperty.call(patch,"completed")) merged.completedAt=patch.completed?(current.completedAt||Date.now()):null;
      const next=normalizeTodo(merged,current.order,state.lists[0].id); if(!next.text) return {ok:false,error:"标题不能为空。"};
      state.todos[index]=next; const libraryChanged=ensureTagsInLibrary(next.tags); await persistTodo(next); if(libraryChanged) await persistTagLibrary(); emit(); return {ok:true,todo:next};
    }
    async function toggleTodo(id){
      const target=state.todos.find(function(todo){return todo.id===id;}); if(!target) return {ok:false};
      pushHistory(target.completed?"标记未完成":"完成任务");
      if(!target.completed&&target.repeat&&target.repeat!=="none"){
        const completed=await updateTodo(id,{completed:true,completedAt:Date.now()});
        const nextDue=nextDueDate(target.dueDate,target.repeat);
        const resetSubs=(target.subtasks||[]).map(function(item){ return Object.assign({}, item, { completed:false }); });
        const spawned=await addTodo({text:target.text,notes:target.notes,subtasks:resetSubs,priority:target.priority,dueDate:nextDue,tags:target.tags,listId:target.listId,repeat:target.repeat,remindEnabled:target.remindEnabled,remindTime:target.remindTime,pinned:target.pinned});
        return {ok:true,todo:completed.todo,spawned:spawned.todo,repeated:true};
      }
      return updateTodo(id,{completed:!target.completed});
    }
    async function deleteTodo(id){ pushHistory("删除任务"); state.todos=state.todos.filter(function(todo){return todo.id!==id;}); state.selectedIds=state.selectedIds.filter(function(x){return x!==id;}); await db.deleteTodo(id); emit(); return {ok:true}; }
    async function archiveTodo(id,archived){ if(archived) return updateTodo(id,{archived:true,completed:true}); return updateTodo(id,{archived:false}); }
    async function clearCompleted(){ const activeListId=state.settings.activeListId||"all"; const victims=state.todos.filter(function(todo){ return todo.completed&&!todo.archived&&(activeListId==="all"||todo.listId===activeListId); }); if(!victims.length) return {ok:true,removed:0}; pushHistory("清理已完成"); for(const todo of victims) await db.deleteTodo(todo.id); const victimIds=new Set(victims.map(function(todo){return todo.id;})); state.todos=state.todos.filter(function(todo){return !victimIds.has(todo.id);}); state.selectedIds=state.selectedIds.filter(function(id){return !victimIds.has(id);}); emit(); return {ok:true,removed:victims.length}; }
    async function setSettings(patch){ state.settings=Object.assign({},state.settings,patch); if(state.settings.activeListId!=="all"&&!listExists(state.settings.activeListId)) state.settings.activeListId="all"; await persistSettings(); emit(); return state.settings; }
    async function createList(input){ const name=String((input&&input.name)||"").trim(); if(!name) return {ok:false,error:"请输入清单名称。"}; if(state.lists.some(function(list){return list.name.toLowerCase()===name.toLowerCase();})) return {ok:false,error:"清单已存在。"}; const maxOrder=state.lists.reduce(function(max,list){return Math.max(max,list.order);},0); const list=normalizeList({name:name,icon:(input&&input.icon)||"📁",order:maxOrder+1000},state.lists.length); state.lists.push(list); await persistLists(); emit(); return {ok:true,list:list}; }
    async function renameList(id,name,icon){ const index=state.lists.findIndex(function(list){return list.id===id;}); if(index===-1) return {ok:false,error:"清单不存在。"}; const nextName=String(name||"").trim(); if(!nextName) return {ok:false,error:"清单名称不能为空。"}; state.lists[index]=normalizeList(Object.assign({},state.lists[index],{name:nextName,icon:icon||state.lists[index].icon}),index); await persistLists(); emit(); return {ok:true,list:state.lists[index]}; }
    async function deleteList(id){ if(state.lists.length<=1) return {ok:false,error:"至少保留一个清单。"}; const target=state.lists.find(function(list){return list.id===id;}); if(!target) return {ok:false,error:"清单不存在。"}; const fallback=state.lists.find(function(list){return list.id!==id;}); state.lists=state.lists.filter(function(list){return list.id!==id;}); let changed=false; state.todos=state.todos.map(function(todo){ if(todo.listId!==id) return todo; changed=true; return Object.assign({},todo,{listId:fallback.id,updatedAt:Date.now()}); }); if(state.settings.activeListId===id){ state.settings.activeListId="all"; await persistSettings(); } await persistLists(); if(changed) await db.putTodos(state.todos); emit(); return {ok:true,movedTo:fallback.id}; }
    async function reorderVisible(fromId,toId){ if(state.settings.sort!=="manual") return {ok:false,error:"当前不是手动排序模式。"}; const visible=getVisibleTodos(); const fromIndex=visible.findIndex(function(todo){return todo.id===fromId;}); const toIndex=visible.findIndex(function(todo){return todo.id===toId;}); if(fromIndex<0||toIndex<0||fromIndex===toIndex) return {ok:false}; const moving=visible[fromIndex]; const reordered=visible.slice(); reordered.splice(fromIndex,1); reordered.splice(toIndex,0,moving); const orderedIds=reordered.map(function(todo){return todo.id;}); const orderMap=new Map(); orderedIds.forEach(function(id,index){orderMap.set(id,(index+1)*1000);}); const rest=state.todos.filter(function(todo){return !orderMap.has(todo.id);}).sort(function(a,b){return a.order-b.order;}); rest.forEach(function(todo,index){orderMap.set(todo.id,(orderedIds.length+index+1)*1000);}); const now=Date.now(); state.todos=state.todos.map(function(todo){ return Object.assign({},todo,{order:orderMap.get(todo.id),updatedAt:now}); }); await db.putTodos(state.todos); emit(); return {ok:true}; }
    async function exportData(){ const data=await db.exportAll(); data.version=2; data.schemaVersion=(global.NovaSchema&&global.NovaSchema.SCHEMA_VERSION)||3; data.tagLibrary=state.tagLibrary.slice(); data.lists=state.lists.slice(); data.templates=(state.templates||[]).slice(); data.backupPoints=(state.backupPoints||[]).slice(0,8); return data; }
    async function importData(payload,mode){ const todos=Array.isArray(payload&&payload.todos)?payload.todos.map(function(item,index){return normalizeTodo(item,index,"list-inbox");}).filter(function(item){return !!item.text;}):[]; if(Array.isArray(payload&&payload.lists)&&payload.lists.length){ state.lists=payload.lists.map(function(item,index){return normalizeList(item,index);}); } else if(mode==="replace"){ state.lists=defaultLists(); } await persistLists(); await db.importAll({todos:todos,settings:payload&&payload.settings?Object.assign(defaultSettings(),payload.settings):state.settings},mode||"merge"); state.todos=await db.getAllTodos().then(function(rows){ return (rows||[]).map(function(item,index){return normalizeTodo(item,index,state.lists[0].id);}); }); state.settings=Object.assign(defaultSettings(),await db.getMeta("settings",state.settings)); if(Array.isArray(payload&&payload.tagLibrary)){ state.tagLibrary=uniqueTags(payload.tagLibrary); } else { const used=[]; state.todos.forEach(function(todo){ (todo.tags||[]).forEach(function(tag){used.push(tag);}); }); state.tagLibrary=uniqueTags(state.tagLibrary.concat(used)); } await persistTagLibrary(); emit(); return {ok:true,count:todos.length}; }
    async function createTag(name){ const tags=normalizeTags(name); if(!tags.length) return {ok:false,error:"请输入标签名。"}; const tag=tags[0]; if(state.tagLibrary.some(function(item){return item.toLowerCase()===tag.toLowerCase();})) return {ok:false,error:"标签已存在。",tag:tag}; state.tagLibrary.push(tag); state.tagLibrary=uniqueTags(state.tagLibrary).sort(function(a,b){return a.localeCompare(b,"zh-CN");}); await persistTagLibrary(); emit(); return {ok:true,tag:tag}; }
    async function deleteTag(name){ const target=String(name||"").trim(); if(!target) return {ok:false,error:"标签不存在。"}; const before=state.tagLibrary.length; state.tagLibrary=state.tagLibrary.filter(function(tag){return tag.toLowerCase()!==target.toLowerCase();}); let todosChanged=false; const now=Date.now(); state.todos=state.todos.map(function(todo){ const nextTags=(todo.tags||[]).filter(function(tag){return tag.toLowerCase()!==target.toLowerCase();}); if(nextTags.length!==(todo.tags||[]).length){ todosChanged=true; return Object.assign({},todo,{tags:nextTags,updatedAt:now}); } return todo; }); if(state.settings.activeTag&&state.settings.activeTag.toLowerCase()===target.toLowerCase()){ state.settings.activeTag=""; await persistSettings(); } await persistTagLibrary(); if(todosChanged) await db.putTodos(state.todos); emit(); return {ok:true,removedFromLibrary:before!==state.tagLibrary.length,todosChanged:todosChanged}; }
    async function renameTag(oldName,newName){ const from=String(oldName||"").trim(); const toTags=normalizeTags(newName); if(!from||!toTags.length) return {ok:false,error:"标签名无效。"}; const to=toTags[0]; if(!(from.toLowerCase()===to.toLowerCase()&&from!==to)){ if(state.tagLibrary.some(function(tag){ return tag.toLowerCase()===to.toLowerCase()&&tag.toLowerCase()!==from.toLowerCase(); })) return {ok:false,error:"目标标签已存在。"}; } state.tagLibrary=uniqueTags(state.tagLibrary.map(function(tag){ return tag.toLowerCase()===from.toLowerCase()?to:tag; })).sort(function(a,b){return a.localeCompare(b,"zh-CN");}); const now=Date.now(); state.todos=state.todos.map(function(todo){ let changed=false; const nextTags=(todo.tags||[]).map(function(tag){ if(tag.toLowerCase()===from.toLowerCase()){ changed=true; return to; } return tag; }); if(!changed) return todo; return Object.assign({},todo,{tags:uniqueTags(nextTags),updatedAt:now}); }); if(state.settings.activeTag&&state.settings.activeTag.toLowerCase()===from.toLowerCase()){ state.settings.activeTag=to; await persistSettings(); } await persistTagLibrary(); await db.putTodos(state.todos); emit(); return {ok:true,tag:to}; }
    function createSharePack(){ return {version:2,type:"nova-todo-share",exportedAt:new Date().toISOString(),todos:state.todos,lists:state.lists,tagLibrary:state.tagLibrary,settings:{theme:state.settings.theme}}; }
    

    async function setSubtasks(id, subtasks){
      pushHistory("更新子任务");
      return updateTodo(id, { subtasks: normalizeSubtasks(subtasks) });
    }
    async function toggleSubtask(todoId, subtaskId){
      const target=state.todos.find(function(todo){return todo.id===todoId;});
      if(!target) return {ok:false,error:"任务不存在。"};
      const next=(target.subtasks||[]).map(function(item){
        if(item.id!==subtaskId) return item;
        return Object.assign({}, item, { completed: !item.completed });
      });
      pushHistory("切换子任务");
      return updateTodo(todoId, { subtasks: next });
    }
    async function addSubtask(todoId, text){
      const cleaned=String(text||"").trim();
      if(!cleaned) return {ok:false,error:"子任务不能为空。"};
      const target=state.todos.find(function(todo){return todo.id===todoId;});
      if(!target) return {ok:false,error:"任务不存在。"};
      const next=(target.subtasks||[]).slice();
      next.push({ id: createId(), text: cleaned.slice(0,120), completed:false, order:(next.length+1)*1000 });
      pushHistory("添加子任务");
      return updateTodo(todoId, { subtasks: next });
    }
    function parseQuick(raw, extra){
      return parseQuickAdd(raw, Object.assign({
        lists: state.lists,
        priority: "medium",
        listId: state.settings.activeListId !== "all" ? state.settings.activeListId : (state.lists[0] && state.lists[0].id)
      }, extra || {}));
    }

    async function togglePin(id){ const target=state.todos.find(function(todo){return todo.id===id;}); if(!target) return {ok:false}; pushHistory(target.pinned?"取消置顶":"置顶任务"); return updateTodo(id,{pinned:!target.pinned}); }
    function setSelectedIds(ids){ state.selectedIds=Array.from(new Set((ids||[]).filter(Boolean))); emit(); return state.selectedIds.slice(); }
    function toggleSelected(id){ if(state.selectedIds.indexOf(id)===-1) state.selectedIds.push(id); else state.selectedIds=state.selectedIds.filter(function(x){return x!==id;}); emit(); return state.selectedIds.slice(); }
    function clearSelection(){ state.selectedIds=[]; emit(); }
    function selectVisible(){ state.selectedIds=getVisibleTodos().map(function(todo){return todo.id;}); emit(); return state.selectedIds.slice(); }
    async function bulkComplete(ids, completed){ const targetIds=(ids&&ids.length?ids:state.selectedIds).slice(); if(!targetIds.length) return {ok:false,error:"请先选择任务"}; pushHistory(completed?"批量完成":"批量取消完成"); for(const id of targetIds){ const todo=state.todos.find(function(item){return item.id===id;}); if(!todo||!!todo.completed===!!completed) continue; if(completed && todo.repeat && todo.repeat!=="none") await toggleTodo(id); else await updateTodo(id,{completed:!!completed}); } return {ok:true,count:targetIds.length}; }
    async function bulkDelete(ids){ const targetIds=(ids&&ids.length?ids:state.selectedIds).slice(); if(!targetIds.length) return {ok:false,error:"请先选择任务"}; pushHistory("批量删除"); const set=new Set(targetIds); for(const id of targetIds) await db.deleteTodo(id); state.todos=state.todos.filter(function(todo){return !set.has(todo.id);}); state.selectedIds=state.selectedIds.filter(function(id){return !set.has(id);}); emit(); return {ok:true,count:targetIds.length}; }
    async function bulkMoveList(listId, ids){ const targetIds=(ids&&ids.length?ids:state.selectedIds).slice(); if(!targetIds.length) return {ok:false,error:"请先选择任务"}; const nextList=ensureListId(listId); pushHistory("批量移动清单"); for(const id of targetIds) await updateTodo(id,{listId:nextList}); return {ok:true,count:targetIds.length,listId:nextList}; }
    async function bulkArchive(ids, archived){ const targetIds=(ids&&ids.length?ids:state.selectedIds).slice(); if(!targetIds.length) return {ok:false,error:"请先选择任务"}; pushHistory(archived?"批量归档":"批量取消归档"); for(const id of targetIds) await archiveTodo(id, !!archived); return {ok:true,count:targetIds.length}; }
    async function undo(){ const snap=state.history.pop(); if(!snap) return {ok:false,error:"没有可撤销的操作"}; await restoreTodos(snap.todos); state.selectedIds=snap.selectedIds||[]; emit(); return {ok:true,label:snap.label||"变更"}; }

    async function bulkSetPriority(priority, ids){
      const targetIds=(ids&&ids.length?ids:state.selectedIds).slice();
      if(!targetIds.length) return {ok:false,error:"请先选择任务"};
      const next=normalizePriority(priority);
      pushHistory("批量改优先级");
      for(const id of targetIds) await updateTodo(id,{priority:next});
      return {ok:true,count:targetIds.length,priority:next};
    }
    async function bulkAddTag(tagName, ids){
      const tags=normalizeTags(tagName);
      if(!tags.length) return {ok:false,error:"请选择标签"};
      const tag=tags[0];
      const targetIds=(ids&&ids.length?ids:state.selectedIds).slice();
      if(!targetIds.length) return {ok:false,error:"请先选择任务"};
      pushHistory("批量添加标签");
      for(const id of targetIds){
        const todo=state.todos.find(function(item){return item.id===id;});
        if(!todo) continue;
        const nextTags=uniqueTags((todo.tags||[]).concat([tag]));
        await updateTodo(id,{tags:nextTags});
      }
      return {ok:true,count:targetIds.length,tag:tag};
    }
    function buildBackupPayload(label){
      return {
        id: createId(),
        version: 2,
        type: "nova-todo-backup",
        label: label || "自动备份",
        createdAt: Date.now(),
        exportedAt: new Date().toISOString(),
        todos: state.todos.map(function(item){ return Object.assign({}, item, { subtasks: (item.subtasks||[]).map(function(s){return Object.assign({},s);}), tags:(item.tags||[]).slice() }); }),
        lists: state.lists.map(function(item){ return Object.assign({}, item); }),
        tagLibrary: state.tagLibrary.slice(),
        settings: Object.assign({}, state.settings)
      };
    }
    async function persistBackupPoints(){
      state.backupPoints = (state.backupPoints || []).slice(0, 8);
      await db.setMeta("backupPoints", state.backupPoints);
      return state.backupPoints;
    }
    async function createBackup(label, options){
      options = options || {};
      const point = buildBackupPayload(label || "手动备份");
      state.backupPoints = [point].concat(state.backupPoints || []).slice(0, 8);
      state.settings.lastBackupAt = point.createdAt;
      await persistBackupPoints();
      await persistSettings();
      // lightweight localStorage mirror for emergency recovery
      try {
        global.localStorage.setItem("nova-todo.backup.latest", JSON.stringify({
          id: point.id,
          createdAt: point.createdAt,
          label: point.label,
          count: (point.todos||[]).length
        }));
        global.localStorage.setItem("nova-todo.backup.latest.payload", JSON.stringify(point));
      } catch (error) {
        console.warn("localStorage backup mirror failed", error);
      }
      if(!options.silent) emit();
      return {ok:true, backup: point, count: (point.todos||[]).length};
    }
    async function listBackups(){
      return (state.backupPoints || []).slice();
    }
    async function restoreBackup(backupId){
      const point = (state.backupPoints || []).find(function(item){ return item.id === backupId; });
      if(!point) return {ok:false,error:"备份不存在"};
      pushHistory("恢复备份");
      const result = await importData(point, "replace");
      state.settings.lastBackupAt = Date.now();
      await persistSettings();
      emit();
      return {ok:true, count: result.count || 0, label: point.label || "备份"};
    }
    async function maybeAutoBackup(force){
      if(!state.settings.autoBackup && !force) return {ok:false, skipped:true};
      const last = state.settings.lastBackupAt || 0;
      const due = force || !last || (Date.now() - last > 6 * 60 * 60 * 1000);
      if(!due) return {ok:false, skipped:true};
      const result = await createBackup(force ? "手动备份" : "自动备份", {silent:false}); return result;
    }
    
    function normalizeTemplate(raw,index){
      const now=Date.now();
      const text=String((raw&&raw.text)||"").trim();
      if(!text) return null;
      return {
        id: raw&&typeof raw.id==="string"&&raw.id?raw.id:createId(),
        name: String((raw&&raw.name)||text).trim().slice(0,40) || text.slice(0,40),
        text: text.slice(0,200),
        notes: String((raw&&raw.notes)||"").trim(),
        priority: normalizePriority(raw&&raw.priority),
        tags: normalizeTags(raw&&raw.tags),
        listId: raw&&typeof raw.listId==="string"&&raw.listId?raw.listId:"list-inbox",
        repeat: normalizeRepeat(raw&&raw.repeat),
        remindEnabled: !!(raw&&raw.remindEnabled),
        remindTime: normalizeRemindTime(raw&&raw.remindTime),
        subtasks: normalizeSubtasks(raw&&raw.subtasks),
        createdAt: typeof (raw&&raw.createdAt)==="number"?raw.createdAt:now,
        order: typeof (raw&&raw.order)==="number"?raw.order:(index+1)*1000
      };
    }
    async function persistTemplates(){ await db.setMeta("templates", state.templates||[]); }
    async function saveTemplate(input){
      const base = input&&input.todoId ? state.todos.find(function(t){return t.id===input.todoId;}) : input;
      if(!base) return {ok:false,error:"没有可保存的模板内容"};
      const tpl = normalizeTemplate({
        name: (input&&input.name) || base.text || base.name,
        text: base.text,
        notes: base.notes,
        priority: base.priority,
        tags: base.tags,
        listId: base.listId,
        repeat: base.repeat,
        remindEnabled: base.remindEnabled,
        remindTime: base.remindTime,
        subtasks: base.subtasks
      }, (state.templates||[]).length);
      if(!tpl) return {ok:false,error:"模板标题不能为空"};
      state.templates = [tpl].concat(state.templates||[]).slice(0,20);
      await persistTemplates(); emit(); return {ok:true, template: tpl};
    }
    async function deleteTemplate(id){
      const before=(state.templates||[]).length;
      state.templates=(state.templates||[]).filter(function(item){return item.id!==id;});
      if(state.templates.length===before) return {ok:false,error:"模板不存在"};
      await persistTemplates(); emit(); return {ok:true};
    }
    async function applyTemplate(id){
      const tpl=(state.templates||[]).find(function(item){return item.id===id;});
      if(!tpl) return {ok:false,error:"模板不存在"};
      return addTodo({
        text: tpl.text,
        notes: tpl.notes,
        priority: tpl.priority,
        tags: tpl.tags,
        listId: ensureListId(tpl.listId),
        repeat: tpl.repeat,
        remindEnabled: tpl.remindEnabled,
        remindTime: tpl.remindTime,
        subtasks: (tpl.subtasks||[]).map(function(s){ return Object.assign({}, s, { completed:false, id: createId() }); })
      });
    }
    async function pushRecentSearch(keyword){
      const q=String(keyword||"").trim();
      if(!q) return {ok:true, recentSearches: state.settings.recentSearches||[]};
      const list=[q].concat((state.settings.recentSearches||[]).filter(function(item){ return item.toLowerCase()!==q.toLowerCase(); })).slice(0,8);
      state.settings.recentSearches=list;
      await persistSettings(); emit();
      return {ok:true, recentSearches: list.slice()};
    }
    async function clearRecentSearches(){
      state.settings.recentSearches=[];
      await persistSettings(); emit();
      return {ok:true};
    }
    async function setDensity(density){ return setSettings({density: density==="compact"?"compact":"comfortable"}); }
return {init:init,subscribe:subscribe,getSnapshot:getSnapshot,addTodo:addTodo,updateTodo:updateTodo,toggleTodo:toggleTodo,deleteTodo:deleteTodo,archiveTodo:archiveTodo,clearCompleted:clearCompleted,setSettings:setSettings,createList:createList,renameList:renameList,deleteList:deleteList,reorderVisible:reorderVisible,exportData:exportData,importData:importData,createTag:createTag,deleteTag:deleteTag,renameTag:renameTag,checkReminders:checkReminders,startReminderLoop:startReminderLoop,stopReminderLoop:stopReminderLoop,createSharePack:createSharePack,togglePin:togglePin,setSubtasks:setSubtasks,toggleSubtask:toggleSubtask,addSubtask:addSubtask,parseQuick:parseQuick,setSelectedIds:setSelectedIds,toggleSelected:toggleSelected,clearSelection:clearSelection,selectVisible:selectVisible,bulkComplete:bulkComplete,bulkDelete:bulkDelete,bulkMoveList:bulkMoveList,bulkSetPriority:bulkSetPriority,bulkAddTag:bulkAddTag,bulkArchive:bulkArchive,undo:undo,setDensity:setDensity,createBackup:createBackup,listBackups:listBackups,restoreBackup:restoreBackup,maybeAutoBackup:maybeAutoBackup,saveTemplate:saveTemplate,deleteTemplate:deleteTemplate,applyTemplate:applyTemplate,pushRecentSearch:pushRecentSearch,clearRecentSearches:clearRecentSearches,viewLabels:VIEW_LABELS,todayKey:todayKey,normalizeTags:normalizeTags,tagColor:tagColor,nextDueDate:nextDueDate,priorityRank:PRIORITY_RANK,parseQuickAdd:parseQuickAdd,normalizeSubtasks:normalizeSubtasks,subtaskProgress:subtaskProgress};
  }
  global.NovaStore={createStore:createStore,normalizeTodo:normalizeTodo,normalizeSubtasks:normalizeSubtasks,parseQuickAdd:parseQuickAdd,defaultSettings:defaultSettings,defaultLists:defaultLists,todayKey:todayKey,tagColor:tagColor,nextDueDate:nextDueDate,subtaskProgress:subtaskProgress};
})(window);
