(function (global) {
  "use strict";

  function createId() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") return global.crypto.randomUUID();
    return "sync-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function nowIso() { return new Date().toISOString(); }

  function safeJsonParse(text, fallback) {
    try { return JSON.parse(text); } catch (error) { return fallback; }
  }

  function byIdMap(list) {
    const map = new Map();
    (list || []).forEach(function (item) {
      if (item && item.id) map.set(item.id, item);
    });
    return map;
  }

  function itemTime(item) {
    if (!item) return 0;
    if (typeof item.updatedAt === "number") return item.updatedAt;
    if (typeof item.createdAt === "number") return item.createdAt;
    return 0;
  }

  function pickNewer(a, b) {
    const at = itemTime(a);
    const bt = itemTime(b);
    if (bt > at) return b;
    if (at > bt) return a;
    // tie-breaker: keep local for stability
    return a;
  }

  function summarizeItem(entity, item) {
    if (!item) return "";
    if (entity === "todo") return String(item.text || "").slice(0, 80);
    if (entity === "list") return String(item.name || "").slice(0, 40);
    if (entity === "template") return String(item.name || item.text || "").slice(0, 40);
    return String(item.id || "");
  }

  function itemsMeaningfullyDifferent(a, b) {
    if (!a || !b) return false;
    try {
      const aa = Object.assign({}, a);
      const bb = Object.assign({}, b);
      // ignore volatile / non-content fields
      ["updatedAt","createdAt","order","lastNotifiedKey","deviceId"].forEach(function(key){
        delete aa[key]; delete bb[key];
      });
      return JSON.stringify(aa) !== JSON.stringify(bb);
    } catch (error) {
      return true;
    }
  }

  function tombKey(item) {
    return String((item && item.entity) || "todo") + "::" + String((item && item.id) || "");
  }

  function mergeTombstones(localList, remoteList) {
    const map = new Map();
    [].concat(localList || [], remoteList || []).forEach(function (item) {
      if (!item || !item.id) return;
      const next = {
        id: String(item.id),
        entity: String(item.entity || "todo"),
        deletedAt: typeof item.deletedAt === "number" ? item.deletedAt : 0,
        deviceId: item.deviceId || null
      };
      const key = tombKey(next);
      const prev = map.get(key);
      if (!prev || next.deletedAt >= prev.deletedAt) map.set(key, next);
    });
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    return Array.from(map.values()).filter(function (item) {
      return !item.deletedAt || item.deletedAt >= cutoff;
    });
  }

  function mergeCollections(localList, remoteList, tombstones, entity, conflicts) {
    const localMap = byIdMap(localList);
    const remoteMap = byIdMap(remoteList);
    const map = new Map(localMap);
    remoteMap.forEach(function (remoteItem, id) {
      if (!remoteItem || !id) return;
      if (!map.has(id)) {
        map.set(id, remoteItem);
        return;
      }
      const localItem = map.get(id);
      const winner = pickNewer(localItem, remoteItem);
      const localTs = itemTime(localItem);
      const remoteTs = itemTime(remoteItem);
      if (localTs !== remoteTs && itemsMeaningfullyDifferent(localItem, remoteItem)) {
        conflicts.push({
          id: String(id),
          entity: entity,
          winner: winner === remoteItem ? "remote" : "local",
          localUpdatedAt: localTs,
          remoteUpdatedAt: remoteTs,
          localLabel: summarizeItem(entity, localItem),
          remoteLabel: summarizeItem(entity, remoteItem),
          resolvedAt: Date.now()
        });
      }
      map.set(id, winner);
    });
    const tombMap = new Map();
    (tombstones || []).forEach(function (t) {
      if (!t || t.entity !== entity || !t.id) return;
      tombMap.set(String(t.id), t);
    });
    return Array.from(map.values()).filter(function (item) {
      const tomb = tombMap.get(String(item.id));
      if (!tomb) return true;
      return itemTime(item) > (tomb.deletedAt || 0);
    });
  }

  function mergeSnapshots(localSnap, remoteSnap) {
    const local = localSnap || {};
    const remote = remoteSnap || {};
    const conflicts = [];
    const tombstones = mergeTombstones(local.tombstones || [], remote.tombstones || []);
    const todos = mergeCollections(local.todos || [], remote.todos || [], tombstones, "todo", conflicts);
    const lists = mergeCollections(local.lists || [], remote.lists || [], tombstones, "list", conflicts);
    const templates = mergeCollections(local.templates || [], remote.templates || [], tombstones, "template", conflicts);
    const notes = mergeCollections(local.notes || [], remote.notes || [], tombstones, "note", conflicts);
    const tagLibrary = Array.from(new Set([].concat(local.tagLibrary || [], remote.tagLibrary || [])));
    const localSettings = Object.assign({}, local.settings || {});
    const remoteSettings = Object.assign({}, remote.settings || {});
    const mergedSettings = Object.assign({}, remoteSettings, localSettings, {
      lastBackupAt: Math.max(localSettings.lastBackupAt || 0, remoteSettings.lastBackupAt || 0) || null,
      recentSearches: (localSettings.recentSearches && localSettings.recentSearches.length ? localSettings.recentSearches : remoteSettings.recentSearches) || [],
      sync: Object.assign({}, remoteSettings.sync || {}, localSettings.sync || {})
    });
    return {
      version: 2,
      type: "nova-todo-sync",
      schemaVersion: Math.max(remote.schemaVersion || 0, local.schemaVersion || 0, 5),
      exportedAt: nowIso(),
      updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0, Date.now()),
      todos: todos,
      lists: lists,
      templates: templates,
      notes: notes,
      tagLibrary: tagLibrary,
      tombstones: tombstones,
      settings: mergedSettings,
      deviceId: local.deviceId || remote.deviceId || null,
      conflicts: conflicts.slice(0, 50)
    };
  }

  function stripSecrets(settings) {
    const s = Object.assign({}, settings || {});
    if (s.sync) {
      s.sync = Object.assign({}, s.sync);
      // never upload tokens
      delete s.sync.token;
    }
    return s;
  }

  function buildPayload(snapshot, deviceId) {
    return {
      version: 2,
      type: "nova-todo-sync",
      schemaVersion: snapshot.schemaVersion || 4,
      exportedAt: nowIso(),
      updatedAt: Date.now(),
      deviceId: deviceId,
      todos: snapshot.todos || [],
      lists: snapshot.lists || [],
      templates: snapshot.templates || [],
      notes: snapshot.notes || [],
      tagLibrary: snapshot.tagLibrary || [],
      tombstones: snapshot.tombstones || [],
      settings: stripSecrets(snapshot.settings || {})
    };
  }

  async function gistRequest(path, options) {
    options = options || {};
    const headers = Object.assign({
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }, options.headers || {});
    if (options.token) headers.Authorization = "Bearer " + options.token;
    if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    const res = await fetch("https://api.github.com" + path, {
      method: options.method || "GET",
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const text = await res.text();
    const data = text ? safeJsonParse(text, null) : null;
    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || (text || res.statusText) || "GitHub API error";
      throw new Error(msg);
    }
    return data;
  }

  async function pullGist(config) {
    if (!config.remoteId) throw new Error("请填写 Gist ID");
    if (!config.token) throw new Error("请填写 GitHub Token");
    const gist = await gistRequest("/gists/" + encodeURIComponent(config.remoteId), { token: config.token });
    const file = (gist.files && (gist.files["nova-todo-sync.json"] || Object.values(gist.files)[0])) || null;
    if (!file || !file.content) throw new Error("Gist 中没有可同步的数据文件");
    const payload = typeof file.content === "string" ? safeJsonParse(file.content, null) : file.content;
    if (!payload || !Array.isArray(payload.todos)) throw new Error("远程数据格式无效");
    return { payload: payload, raw: gist, updatedAt: Date.parse(gist.updated_at || "") || Date.now() };
  }

  async function pushGist(config, payload) {
    if (!config.token) throw new Error("请填写 GitHub Token");
    const body = {
      description: "Nova Todo Sync",
      public: false,
      files: {
        "nova-todo-sync.json": {
          content: JSON.stringify(payload, null, 2)
        }
      }
    };
    if (config.remoteId) {
      const gist = await gistRequest("/gists/" + encodeURIComponent(config.remoteId), {
        method: "PATCH",
        token: config.token,
        body: body
      });
      return { remoteId: gist.id, updatedAt: Date.parse(gist.updated_at || "") || Date.now(), raw: gist };
    }
    const created = await gistRequest("/gists", {
      method: "POST",
      token: config.token,
      body: body
    });
    return { remoteId: created.id, updatedAt: Date.parse(created.updated_at || "") || Date.now(), raw: created };
  }

  async function pullHttp(config) {
    if (!config.endpoint) throw new Error("请填写同步 Endpoint");
    const headers = { "Accept": "application/json" };
    if (config.token) headers.Authorization = "Bearer " + config.token;
    const res = await fetch(config.endpoint, { method: "GET", headers: headers });
    const text = await res.text();
    const data = text ? safeJsonParse(text, null) : null;
    if (!res.ok) throw new Error((data && data.message) || text || "拉取失败");
    const payload = data && data.todos ? data : (data && data.data ? data.data : data);
    if (!payload || !Array.isArray(payload.todos)) throw new Error("远程数据格式无效");
    return { payload: payload, updatedAt: payload.updatedAt || Date.now() };
  }

  async function pushHttp(config, payload) {
    if (!config.endpoint) throw new Error("请填写同步 Endpoint");
    const headers = { "Accept": "application/json", "Content-Type": "application/json" };
    if (config.token) headers.Authorization = "Bearer " + config.token;
    const res = await fetch(config.endpoint, {
      method: config.method || "PUT",
      headers: headers,
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    const data = text ? safeJsonParse(text, null) : null;
    if (!res.ok) throw new Error((data && data.message) || text || "推送失败");
    return { remoteId: config.remoteId || config.endpoint, updatedAt: Date.now(), raw: data };
  }

  function createSync(store, options) {
    options = options || {};
    const toast = options.toast || function () {};
    let busy = false;
    let autoTimer = null;
    let debounceTimer = null;
    let lastAutoAttempt = 0;

    function getConfig() {
      const snap = store.getSnapshot();
      const sync = (snap.settings && snap.settings.sync) || {};
      const interval = Number(sync.autoSyncInterval || 0);
      return {
        enabled: !!sync.enabled,
        provider: sync.provider || "gist",
        token: sync.token || "",
        remoteId: sync.remoteId || "",
        endpoint: sync.endpoint || "",
        autoSync: !!sync.autoSync,
        autoSyncInterval: interval > 0 ? interval : (sync.autoSync ? 15 : 0),
        lastSyncedAt: sync.lastSyncedAt || null,
        lastRemoteUpdatedAt: sync.lastRemoteUpdatedAt || null,
        deviceId: sync.deviceId || null,
        method: sync.method || "PUT",
        lastConflicts: Array.isArray(sync.lastConflicts) ? sync.lastConflicts : []
      };
    }

    function canAutoSync(cfg) {
      cfg = cfg || getConfig();
      if (!cfg.enabled || !cfg.autoSync) return false;
      if (cfg.provider === "http") return !!cfg.endpoint;
      return !!(cfg.token);
    }

    function normalizeIntervalMinutes(value) {
      const n = Number(value || 0);
      if (n === 1 || n === 5 || n === 15) return n;
      return 0;
    }

    async function ensureDeviceId() {
      const cfg = getConfig();
      if (cfg.deviceId) return cfg.deviceId;
      const deviceId = createId();
      await store.setSyncConfig({ deviceId: deviceId });
      return deviceId;
    }

    async function pullOnly() {
      const cfg = getConfig();
      if (cfg.provider === "http") return pullHttp(cfg);
      return pullGist(cfg);
    }

    async function pushOnly(payload) {
      const cfg = getConfig();
      if (cfg.provider === "http") return pushHttp(cfg, payload);
      return pushGist(cfg, payload);
    }

    async function syncNow(mode) {
      if (busy) return { ok: false, error: "同步进行中" };
      busy = true;
      mode = mode || "sync"; // sync | push | pull
      try {
        const deviceId = await ensureDeviceId();
        const localSnap = store.getSnapshot();
        // safety backup before any remote merge
        if (mode !== "push") {
          try { await store.createBackup("同步前备份", { silent: false }); } catch (e) { console.warn(e); }
        }

        if (mode === "push") {
          const payload = buildPayload(localSnap, deviceId);
          const result = await pushOnly(payload);
          await store.setSyncConfig({
            enabled: true,
            remoteId: result.remoteId || getConfig().remoteId,
            lastSyncedAt: Date.now(),
            lastRemoteUpdatedAt: result.updatedAt || Date.now(),
            lastResult: "push-ok"
          });
          return { ok: true, mode: "push", remoteId: result.remoteId };
        }

        if (mode === "pull") {
          const remote = await pullOnly();
          const merged = mergeSnapshots(buildPayload(localSnap, deviceId), remote.payload);
          const applied = await store.applySyncPayload(merged, { mode: "replace", label: "云同步拉取" });
          const conflicts = merged.conflicts || [];
          await store.setSyncConfig({
            enabled: true,
            lastSyncedAt: Date.now(),
            lastRemoteUpdatedAt: remote.updatedAt || merged.updatedAt || Date.now(),
            lastResult: conflicts.length ? ("pull-ok · 冲突 " + conflicts.length) : "pull-ok",
            lastConflicts: conflicts
          });
          return { ok: true, mode: "pull", count: applied.count || 0, conflicts: conflicts };
        }

        // full sync = pull merge then push
        let remotePayload = null;
        let remoteUpdatedAt = null;
        const cfg = getConfig();
        const canPull = cfg.provider === "http" ? !!cfg.endpoint : !!(cfg.remoteId && cfg.token);
        if (canPull) {
          try {
            const remote = await pullOnly();
            remotePayload = remote.payload;
            remoteUpdatedAt = remote.updatedAt;
          } catch (error) {
            // if remote empty/missing on first push for gist without id, continue push-only
            if (!(cfg.provider === "gist" && !cfg.remoteId)) {
              // for existing remote, surface error
              if (cfg.remoteId || cfg.provider === "http") throw error;
            }
          }
        }

        const baseLocal = buildPayload(localSnap, deviceId);
        const merged = remotePayload ? mergeSnapshots(baseLocal, remotePayload) : baseLocal;
        const conflicts = (merged && merged.conflicts) || [];
        if (remotePayload) {
          await store.applySyncPayload(merged, { mode: "replace", label: "云同步合并" });
        }
        const latest = store.getSnapshot();
        const pushPayload = buildPayload(latest, deviceId);
        const pushed = await pushOnly(pushPayload);
        let lastResult = remotePayload ? "sync-merge-ok" : "sync-push-ok";
        if (conflicts.length) lastResult += " · 冲突 " + conflicts.length;
        await store.setSyncConfig({
          enabled: true,
          remoteId: pushed.remoteId || cfg.remoteId,
          lastSyncedAt: Date.now(),
          lastRemoteUpdatedAt: pushed.updatedAt || remoteUpdatedAt || Date.now(),
          lastResult: lastResult,
          lastConflicts: conflicts
        });
        return { ok: true, mode: "sync", remoteId: pushed.remoteId || cfg.remoteId, merged: !!remotePayload, conflicts: conflicts };
      } finally {
        busy = false;
      }
    }

    function stopAutoSync() {
      if (autoTimer && typeof global.clearInterval === "function") {
        global.clearInterval(autoTimer);
        autoTimer = null;
      } else {
        autoTimer = null;
      }
      if (debounceTimer && typeof global.clearTimeout === "function") {
        global.clearTimeout(debounceTimer);
        debounceTimer = null;
      } else {
        debounceTimer = null;
      }
    }

    function startAutoSync() {
      stopAutoSync();
      if (typeof global.setInterval !== "function") return;
      autoTimer = global.setInterval(function () {
        const cfg = getConfig();
        const minutes = normalizeIntervalMinutes(cfg.autoSyncInterval) || (cfg.autoSync ? 15 : 0);
        if (!minutes || !canAutoSync(cfg)) return;
        // interval gate: only fire if enough time passed since last attempt/sync
        const dueEvery = minutes * 60 * 1000;
        const last = Math.max(cfg.lastSyncedAt || 0, lastAutoAttempt || 0);
        if (Date.now() - last < dueEvery - 1000) return;
        lastAutoAttempt = Date.now();
        syncNow("sync").then(function (result) {
          if (result && result.ok && result.conflicts && result.conflicts.length) {
            toast("同步完成，发现 " + result.conflicts.length + " 处冲突（已按最新写入）");
          }
        }).catch(function (error) {
          console.warn("auto sync failed", error);
        });
      }, 30 * 1000); // checker every 30s; actual cadence from interval
      if (autoTimer && typeof autoTimer.unref === "function") autoTimer.unref();
    }

    function scheduleSync(reason, delayMs) {
      const cfg = getConfig();
      if (!canAutoSync(cfg)) return;
      if (typeof global.setTimeout !== "function") return;
      if (debounceTimer && typeof global.clearTimeout === "function") global.clearTimeout(debounceTimer);
      debounceTimer = global.setTimeout(function () {
        debounceTimer = null;
        lastAutoAttempt = Date.now();
        syncNow("sync").then(function (result) {
          if (result && result.ok && reason === "local-change" && result.conflicts && result.conflicts.length) {
            toast("自动同步：处理冲突 " + result.conflicts.length + " 处");
          }
        }).catch(function (error) {
          console.warn("scheduled sync failed", error);
        });
      }, typeof delayMs === "number" ? delayMs : 2500);
      if (debounceTimer && typeof debounceTimer.unref === "function") debounceTimer.unref();
    }

    function onAppResume() {
      const cfg = getConfig();
      if (!canAutoSync(cfg)) return;
      // resume sync if last sync older than 30s
      if (cfg.lastSyncedAt && Date.now() - cfg.lastSyncedAt < 30 * 1000) return;
      scheduleSync("resume", 800);
    }

    // timer loop is started explicitly by app boot / UI when needed
    return {
      getConfig: getConfig,
      syncNow: syncNow,
      pull: function () { return syncNow("pull"); },
      push: function () { return syncNow("push"); },
      mergeSnapshots: mergeSnapshots,
      buildPayload: buildPayload,
      startAutoSync: startAutoSync,
      stopAutoSync: stopAutoSync,
      scheduleSync: scheduleSync,
      onAppResume: onAppResume
    };
  }

  global.NovaSync = {
    createSync: createSync,
    mergeSnapshots: mergeSnapshots,
    buildPayload: buildPayload
  };
})(window);
