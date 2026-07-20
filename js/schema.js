(function (global) {
  "use strict";

  var SCHEMA_VERSION = 4;

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function repairSettings(raw, defaultSettings) {
    var base = defaultSettings ? defaultSettings() : {};
    var next = Object.assign({}, base, raw || {});
    if (!Array.isArray(next.recentSearches)) next.recentSearches = [];
    if (next.density !== "compact") next.density = "comfortable";
    if (typeof next.autoBackup !== "boolean") next.autoBackup = true;
    if (next.theme !== "light") next.theme = next.theme === "light" ? "light" : "dark";
    return next;
  }

  function normalizeTombstone(item) {
    if (!item || typeof item !== "object" || !item.id) return null;
    return {
      id: String(item.id),
      entity: String(item.entity || "todo"),
      deletedAt: typeof item.deletedAt === "number" ? item.deletedAt : Date.now(),
      deviceId: item.deviceId || null
    };
  }

  function runMigrations(ctx) {
    // ctx: { fromVersion, todos, lists, settings, tagLibrary, templates, backupPoints, tombstones, helpers }
    var helpers = ctx.helpers || {};
    var normalizeTodo = helpers.normalizeTodo;
    var normalizeList = helpers.normalizeList;
    var normalizeTemplate = helpers.normalizeTemplate;
    var uniqueTags = helpers.uniqueTags || function (x) { return asArray(x); };
    var defaultLists = helpers.defaultLists;
    var defaultSettings = helpers.defaultSettings;

    var version = typeof ctx.fromVersion === "number" ? ctx.fromVersion : 0;
    var todos = asArray(ctx.todos);
    var lists = asArray(ctx.lists);
    var settings = repairSettings(ctx.settings, defaultSettings);
    var tagLibrary = asArray(ctx.tagLibrary);
    var templates = asArray(ctx.templates);
    var backupPoints = asArray(ctx.backupPoints);
    var tombstones = asArray(ctx.tombstones).map(normalizeTombstone).filter(Boolean);
    var log = [];

    if (!lists.length && defaultLists) {
      lists = defaultLists();
      log.push("seed-lists");
    }

    // v1 -> v2 shape hardening (subtasks/pinned/listId)
    if (version < 2) {
      todos = todos.map(function (item, index) {
        return normalizeTodo(item, index, (lists[0] && lists[0].id) || "list-inbox");
      }).filter(function (item) { return !!(item && item.text); });
      lists = lists.map(function (item, index) { return normalizeList(item, index); });
      log.push("migrate-to-v2-shape");
      version = 2;
    }

    // v2 -> v3 templates/backups/settings repair + orphan list repair
    if (version < 3) {
      var listIds = {};
      lists = lists.map(function (item, index) {
        var list = normalizeList(item, index);
        listIds[list.id] = true;
        return list;
      });
      if (!lists.length && defaultLists) {
        lists = defaultLists();
        lists.forEach(function (list) { listIds[list.id] = true; });
      }
      var fallbackList = (lists[0] && lists[0].id) || "list-inbox";
      todos = todos.map(function (item, index) {
        var todo = normalizeTodo(item, index, fallbackList);
        if (!listIds[todo.listId]) todo.listId = fallbackList;
        if (!Array.isArray(todo.subtasks)) todo.subtasks = [];
        if (!Array.isArray(todo.tags)) todo.tags = [];
        return todo;
      }).filter(function (item) { return !!(item && item.text); });

      templates = templates.map(function (item, index) {
        return normalizeTemplate ? normalizeTemplate(item, index) : item;
      }).filter(Boolean).slice(0, 20);

      backupPoints = backupPoints.filter(function (point) {
        return point && typeof point === "object";
      }).slice(0, 8);

      // rebuild tag library from todos + existing
      var used = tagLibrary.slice();
      todos.forEach(function (todo) {
        (todo.tags || []).forEach(function (tag) { used.push(tag); });
      });
      tagLibrary = uniqueTags(used);

      settings = repairSettings(settings, defaultSettings);
      if (settings.activeListId !== "all" && !listIds[settings.activeListId]) settings.activeListId = "all";
      log.push("migrate-to-v3-repair");
      version = 3;
    }

    // v3 -> v4 collaboration tombstones
    if (version < 4) {
      tombstones = tombstones.map(normalizeTombstone).filter(Boolean);
      log.push("migrate-to-v4-tombstones");
      version = 4;
    }

    // always normalize current schema once more for safety
    todos = todos.map(function (item, index) {
      return normalizeTodo(item, index, (lists[0] && lists[0].id) || "list-inbox");
    }).filter(function (item) { return !!(item && item.text); });
    lists = lists.map(function (item, index) { return normalizeList(item, index); });
    templates = templates.map(function (item, index) {
      return normalizeTemplate ? normalizeTemplate(item, index) : item;
    }).filter(Boolean).slice(0, 20);
    tombstones = tombstones.map(normalizeTombstone).filter(Boolean);

    function isTombstoned(entity, id, updatedAt) {
      return tombstones.some(function (t) {
        return t.entity === entity && t.id === id && (typeof updatedAt !== "number" || t.deletedAt >= updatedAt);
      });
    }
    todos = todos.filter(function (item) { return !isTombstoned("todo", item.id, item.updatedAt); });
    lists = lists.filter(function (item) { return !isTombstoned("list", item.id, item.updatedAt || item.createdAt); });
    templates = templates.filter(function (item) { return !isTombstoned("template", item.id, item.updatedAt || item.createdAt); });

    return {
      version: SCHEMA_VERSION,
      todos: todos,
      lists: lists,
      settings: settings,
      tagLibrary: tagLibrary,
      templates: templates,
      backupPoints: backupPoints,
      tombstones: tombstones,
      log: log,
      migrated: log.length > 0 || (typeof ctx.fromVersion === "number" ? ctx.fromVersion : 0) < SCHEMA_VERSION
    };
  }

  global.NovaSchema = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    runMigrations: runMigrations,
    repairSettings: repairSettings,
    normalizeTombstone: normalizeTombstone
  };
})(window);
