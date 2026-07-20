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

  function pickNewer(a, b) {
    const at = typeof (a && a.updatedAt) === "number" ? a.updatedAt : (typeof (a && a.createdAt) === "number" ? a.createdAt : 0);
    const bt = typeof (b && b.updatedAt) === "number" ? b.updatedAt : (typeof (b && b.createdAt) === "number" ? b.createdAt : 0);
    if (bt > at) return b;
    if (at > bt) return a;
    // tie-breaker: prefer remote when equal? keep local for stability
    return a;
  }

  function mergeCollections(localList, remoteList) {
    const map = byIdMap(localList);
    (remoteList || []).forEach(function (remoteItem) {
      if (!remoteItem || !remoteItem.id) return;
      if (!map.has(remoteItem.id)) map.set(remoteItem.id, remoteItem);
      else map.set(remoteItem.id, pickNewer(map.get(remoteItem.id), remoteItem));
    });
    return Array.from(map.values());
  }

  function mergeSnapshots(localSnap, remoteSnap) {
    const local = localSnap || {};
    const remote = remoteSnap || {};
    const todos = mergeCollections(local.todos || [], remote.todos || []);
    const lists = mergeCollections(local.lists || [], remote.lists || []);
    const templates = mergeCollections(local.templates || [], remote.templates || []);
    const tagLibrary = Array.from(new Set([].concat(local.tagLibrary || [], remote.tagLibrary || [])));
    // settings: keep local UI prefs, take max lastBackupAt, preserve sync config from local
    const localSettings = Object.assign({}, local.settings || {});
    const remoteSettings = Object.assign({}, remote.settings || {});
    const mergedSettings = Object.assign({}, remoteSettings, localSettings, {
      // data-ish fields can prefer newer timestamps
      lastBackupAt: Math.max(localSettings.lastBackupAt || 0, remoteSettings.lastBackupAt || 0) || null,
      recentSearches: (localSettings.recentSearches && localSettings.recentSearches.length ? localSettings.recentSearches : remoteSettings.recentSearches) || [],
      sync: Object.assign({}, remoteSettings.sync || {}, localSettings.sync || {})
    });
    return {
      version: 2,
      type: "nova-todo-sync",
      schemaVersion: remote.schemaVersion || local.schemaVersion || 3,
      exportedAt: nowIso(),
      updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0, Date.now()),
      todos: todos,
      lists: lists,
      templates: templates,
      tagLibrary: tagLibrary,
      settings: mergedSettings,
      deviceId: local.deviceId || remote.deviceId || null
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
      schemaVersion: snapshot.schemaVersion || 3,
      exportedAt: nowIso(),
      updatedAt: Date.now(),
      deviceId: deviceId,
      todos: snapshot.todos || [],
      lists: snapshot.lists || [],
      templates: snapshot.templates || [],
      tagLibrary: snapshot.tagLibrary || [],
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

    function getConfig() {
      const snap = store.getSnapshot();
      const sync = (snap.settings && snap.settings.sync) || {};
      return {
        enabled: !!sync.enabled,
        provider: sync.provider || "gist",
        token: sync.token || "",
        remoteId: sync.remoteId || "",
        endpoint: sync.endpoint || "",
        autoSync: !!sync.autoSync,
        lastSyncedAt: sync.lastSyncedAt || null,
        lastRemoteUpdatedAt: sync.lastRemoteUpdatedAt || null,
        deviceId: sync.deviceId || null,
        method: sync.method || "PUT"
      };
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
          await store.setSyncConfig({
            enabled: true,
            lastSyncedAt: Date.now(),
            lastRemoteUpdatedAt: remote.updatedAt || merged.updatedAt || Date.now(),
            lastResult: "pull-ok"
          });
          return { ok: true, mode: "pull", count: applied.count || 0 };
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
        if (remotePayload) {
          await store.applySyncPayload(merged, { mode: "replace", label: "云同步合并" });
        }
        const latest = store.getSnapshot();
        const pushPayload = buildPayload(latest, deviceId);
        const pushed = await pushOnly(pushPayload);
        await store.setSyncConfig({
          enabled: true,
          remoteId: pushed.remoteId || cfg.remoteId,
          lastSyncedAt: Date.now(),
          lastRemoteUpdatedAt: pushed.updatedAt || remoteUpdatedAt || Date.now(),
          lastResult: remotePayload ? "sync-merge-ok" : "sync-push-ok"
        });
        return { ok: true, mode: "sync", remoteId: pushed.remoteId || cfg.remoteId, merged: !!remotePayload };
      } finally {
        busy = false;
      }
    }

    return {
      getConfig: getConfig,
      syncNow: syncNow,
      pull: function () { return syncNow("pull"); },
      push: function () { return syncNow("push"); },
      mergeSnapshots: mergeSnapshots,
      buildPayload: buildPayload
    };
  }

  global.NovaSync = {
    createSync: createSync,
    mergeSnapshots: mergeSnapshots,
    buildPayload: buildPayload
  };
})(window);
