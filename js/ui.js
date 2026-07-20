(function (global) {
  "use strict";

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  const PRIORITY_META = {
    low: { label: "低", icon: "🟢", short: "低" },
    medium: { label: "中", icon: "🔵", short: "中" },
    high: { label: "高", icon: "🟠", short: "高" },
    urgent: { label: "紧急", icon: "🔴", short: "紧急" },
  };

  const VIEW_META = {
    all: { label: "全部任务", icon: "🗂️" },
    active: { label: "进行中", icon: "🚀" },
    completed: { label: "已完成", icon: "✅" },
    today: { label: "今日到期", icon: "📅" },
    week: { label: "周视图", icon: "🗓️" },
    month: { label: "月视图", icon: "📆" },
    overdue: { label: "已逾期", icon: "⏰" },
    scheduled: { label: "重复任务", icon: "🔁" },
    archived: { label: "归档", icon: "📦" },
  };
  const REPEAT_META = {
    none: { label: "不重复", icon: "🚫" },
    daily: { label: "每天", icon: "🔁" },
    weekly: { label: "每周", icon: "📅" },
    monthly: { label: "每月", icon: "🗓️" },
  };

  const SORT_META = {
    manual: { label: "手动排序", icon: "⠿" },
    created_desc: { label: "最新创建", icon: "🆕" },
    due_asc: { label: "截止日期", icon: "📅" },
    priority_desc: { label: "优先级", icon: "⚡" },
    alpha_asc: { label: "标题 A-Z", icon: "🔤" },
  };

  function priorityLabel(priority) {
    return (PRIORITY_META[priority] || PRIORITY_META.medium).label;
  }

  function priorityIcon(priority) {
    return (PRIORITY_META[priority] || PRIORITY_META.medium).icon;
  }

  function formatDue(dueDate, completed, today) {
    if (!dueDate) return null;
    if (completed) return { text: "📅 截止 " + dueDate, cls: "badge--done", icon: "📅" };
    if (dueDate < today) return { text: "⏰ 逾期 " + dueDate, cls: "badge--due-overdue", icon: "⏰" };
    if (dueDate === today) return { text: "📅 今日到期", cls: "badge--due-today", icon: "📅" };
    return { text: "📅 截止 " + dueDate, cls: "", icon: "📅" };
  }

  function makeBadge(text, className) {
    const badge = document.createElement("span");
    badge.className = "badge" + (className ? " " + className : "");
    badge.textContent = text;
    return badge;
  }

  function applyTagColor(node, name, storeRef) {
    const color = (storeRef && storeRef.tagColor)
      ? storeRef.tagColor(name)
      : (window.NovaStore && window.NovaStore.tagColor ? window.NovaStore.tagColor(name) : null);
    if (!color || !node) return;
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    node.style.background = color.bg;
    node.style.borderColor = color.border;
    // Dark theme uses soft pastel text; light theme needs deeper ink for contrast.
    node.style.color = isLight ? "#0f172a" : color.text;
  }

  function createUI(store) {
    const els = {
      board: $("#todo-board"),
      calendarBoard: $("#calendar-board"),
      calendarToolbar: $("#calendar-toolbar"),
      calendarRange: $("#calendar-range"),
      btnCalPrev: $("#btn-cal-prev"),
      btnCalToday: $("#btn-cal-today"),
      btnCalNext: $("#btn-cal-next"),
      empty: $("#empty-state"),
      emptyIcon: $("#empty-icon"),
      emptyEyebrow: $("#empty-eyebrow"),
      emptyTitle: $("#empty-title"),
      emptyText: $("#empty-text"),
      emptyAction: $("#empty-action"),
      focusPanel: $("#focus-panel"),
      focusList: $("#focus-list"),
      focusEmpty: $("#focus-empty"),
      btnFocusToday: $("#btn-focus-today"),
      viewTitle: $("#view-title"),
      viewSubtitle: $("#view-subtitle"),
      resultMeta: $("#result-meta"),
      activeFilters: $("#active-filters"),
      activeFiltersList: $("#active-filters-list"),
      btnClearFilters: $("#btn-clear-filters"),
      searchInput: $("#search-input"),
      sortSelect: $("#sort-select"),
      themeToggle: $("#theme-toggle"),
      quickForm: $("#quick-form"),
      quickInput: $("#quick-input"),
      quickList: $("#quick-list"),
      quickPriority: $("#quick-priority"),
      formError: $("#form-error"),
      tagCloud: $("#tag-cloud"),
      statCompletion: $("#stat-completion"),
      statHigh: $("#stat-high"),
      statDueSoon: $("#stat-due-soon"),
      statRepeating: $("#stat-repeating"),
      listNav: $("#list-nav"),
      btnAddList: $("#btn-add-list"),
      btnEnableNotify: $("#btn-enable-notify"),
      btnSharePack: $("#btn-share-pack"),
      btnNew: $("#btn-new"),
      densityToggle: $("#density-toggle"),
      btnUndo: $("#btn-undo"),
      btnShortcuts: $("#btn-shortcuts"),
      shortcutsModal: $("#shortcuts-modal"),
      shortcutsBackdrop: $("#shortcuts-backdrop"),
      shortcutsClose: $("#shortcuts-close"),
      bulkBar: $("#bulk-bar"),
      bulkSelectAll: $("#bulk-select-all"),
      bulkCount: $("#bulk-count"),
      bulkComplete: $("#bulk-complete"),
      bulkPin: $("#bulk-pin"),
      bulkArchive: $("#bulk-archive"),
      bulkDelete: $("#bulk-delete"),
      bulkClear: $("#bulk-clear"),
      bulkPriority: $("#bulk-priority"),
      bulkList: $("#bulk-list"),
      bulkTag: $("#bulk-tag"),
      quickPreview: $("#quick-preview"),
      btnSidebarToggle: $("#btn-sidebar-toggle"),
      btnSidebarClose: $("#btn-sidebar-close"),
      sidebar: $("#sidebar"),
      sidebarBackdrop: $("#sidebar-backdrop"),
      backupMeta: $("#backup-meta"),
      backupSelect: $("#backup-select"),
      btnBackupNow: $("#btn-backup-now"),
      btnBackupRestore: $("#btn-backup-restore"),
      btnBackupDownload: $("#btn-backup-download"),
      reminderPanel: $("#reminder-panel"),
      reminderList: $("#reminder-list"),
      reminderEmpty: $("#reminder-empty"),
      btnReminderRefresh: $("#btn-reminder-refresh"),
      templatePanel: $("#template-panel"),
      templateList: $("#template-list"),
      btnSaveTemplate: $("#btn-save-template"),
      recentSearches: $("#recent-searches"),
      syncPanel: $("#sync-panel"),
      syncMeta: $("#sync-meta"),
      syncEnabled: $("#sync-enabled"),
      syncProvider: $("#sync-provider"),
      syncToken: $("#sync-token"),
      syncRemoteId: $("#sync-remote-id"),
      syncEndpoint: $("#sync-endpoint"),
      syncRemoteWrap: $("#sync-remote-wrap"),
      syncEndpointWrap: $("#sync-endpoint-wrap"),
      syncAuto: $("#sync-autosync"),
      btnSyncNow: $("#btn-sync-now"),
      btnSyncPush: $("#btn-sync-push"),
      btnSyncPull: $("#btn-sync-pull"),
      btnSyncSave: $("#btn-sync-save"),
      syncConflicts: $("#sync-conflicts"),
      syncConflictList: $("#sync-conflict-list"),
      tombstoneMeta: $("#tombstone-meta"),
      btnTombstonePrune: $("#btn-tombstone-prune"),
      btnTombstoneClear: $("#btn-tombstone-clear"),
      btnClearCompleted: $("#btn-clear-completed"),
      btnExport: $("#btn-export"),
      btnImport: $("#btn-import"),
      importFile: $("#import-file"),
      drawer: $("#editor-drawer"),
      drawerBackdrop: $("#drawer-backdrop"),
      editorForm: $("#editor-form"),
      editorTitle: $("#editor-title"),
      editorId: $("#editor-id"),
      editorText: $("#editor-text"),
      editorNotes: $("#editor-notes"),
      editorSubtasks: $("#editor-subtasks"),
      editorSubtasksCount: $("#editor-subtasks-count"),
      editorSubtaskNew: $("#editor-subtask-new"),
      editorSubtaskAdd: $("#editor-subtask-add"),
      quickHint: $("#quick-hint"),
      editorList: $("#editor-list"),
      editorPriority: $("#editor-priority"),
      editorDue: $("#editor-due"),
      editorRepeat: $("#editor-repeat"),
      editorRemindEnabled: $("#editor-remind-enabled"),
      editorRemindTime: $("#editor-remind-time"),
      editorSelectedTags: $("#editor-selected-tags"),
      editorTagSelect: $("#editor-tag-select"),
      editorTagAdd: $("#editor-tag-add"),
      editorTagNew: $("#editor-tag-new"),
      editorTagCreate: $("#editor-tag-create"),
      btnOpenTagManager: $("#btn-open-tag-manager"),
      tagManager: $("#tag-manager"),
      tagManagerBackdrop: $("#tag-manager-backdrop"),
      tagManagerClose: $("#tag-manager-close"),
      tagManagerCreate: $("#tag-manager-create"),
      tagManagerInput: $("#tag-manager-input"),
      tagManagerList: $("#tag-manager-list"),
      editorClose: $("#editor-close"),
      editorArchive: $("#editor-archive"),
      editorDelete: $("#editor-delete"),
      toastStack: $("#toast-stack"),
    };

    let dragFromId = null;
    let editorSelectedTags = [];
    let editorSubtasks = [];
    let latestSnapshot = null;

    function toast(message, type) {
      const node = document.createElement("div");
      node.className = "toast" + (type === "error" ? " toast--error" : "");
      node.textContent = message;
      els.toastStack.appendChild(node);
      setTimeout(function () {
        node.remove();
      }, 2600);
    }

    function showError(message) {
      els.formError.hidden = !message;
      els.formError.textContent = message || "";
    }

    function setTheme(theme) {
      document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
    }


    function subtaskStats(list) {
      const total = (list || []).length;
      const done = (list || []).filter(function (item) { return item.completed; }).length;
      return { total: total, done: done };
    }

    function renderEditorSubtasks() {
      if (!els.editorSubtasks) return;
      els.editorSubtasks.innerHTML = "";
      const stats = subtaskStats(editorSubtasks);
      if (els.editorSubtasksCount) els.editorSubtasksCount.textContent = stats.done + "/" + stats.total;
      if (!editorSubtasks.length) {
        const empty = document.createElement("p");
        empty.className = "field-hint";
        empty.textContent = "把大任务拆成可执行的小步骤。";
        els.editorSubtasks.appendChild(empty);
        return;
      }
      editorSubtasks.forEach(function (item, index) {
        const row = document.createElement("div");
        row.className = "subtask-row" + (item.completed ? " is-done" : "");
        const check = document.createElement("input");
        check.type = "checkbox";
        check.checked = !!item.completed;
        check.addEventListener("change", function () {
          editorSubtasks[index] = Object.assign({}, item, { completed: check.checked });
          renderEditorSubtasks();
        });
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 120;
        input.value = item.text || "";
        input.addEventListener("input", function () {
          editorSubtasks[index] = Object.assign({}, editorSubtasks[index], { text: input.value });
        });
        const del = document.createElement("button");
        del.type = "button";
        del.className = "ghost-btn";
        del.textContent = "删除";
        del.addEventListener("click", function () {
          editorSubtasks.splice(index, 1);
          renderEditorSubtasks();
        });
        row.appendChild(check);
        row.appendChild(input);
        row.appendChild(del);
        els.editorSubtasks.appendChild(row);
      });
    }

    function addEditorSubtask(text) {
      const cleaned = String(text || "").trim();
      if (!cleaned) return false;
      editorSubtasks.push({
        id: (global.crypto && crypto.randomUUID) ? crypto.randomUUID() : ("sub-" + Date.now() + "-" + Math.random().toString(16).slice(2)),
        text: cleaned.slice(0, 120),
        completed: false,
        order: (editorSubtasks.length + 1) * 1000,
      });
      renderEditorSubtasks();
      return true;
    }


    function closeMobileSidebar() {
      document.body.classList.remove("sidebar-open");
      if (els.sidebarBackdrop) els.sidebarBackdrop.hidden = true;
    }
    function openMobileSidebar() {
      document.body.classList.add("sidebar-open");
      if (els.sidebarBackdrop) els.sidebarBackdrop.hidden = false;
    }
    function formatBackupTime(ts) {
      if (!ts) return "尚未创建备份";
      try {
        return new Date(ts).toLocaleString("zh-CN", { hour12: false });
      } catch (error) {
        return String(ts);
      }
    }
    function renderBackupPanel(snapshot) {
      if (!els.backupMeta && !els.backupSelect) return;
      const points = (snapshot && snapshot.backupPoints) || [];
      if (els.backupMeta) {
        if (!points.length) els.backupMeta.textContent = "尚未创建备份（建议开启后定期备份）";
        else els.backupMeta.textContent = "最近备份：" + formatBackupTime(points[0].createdAt) + " · 共 " + points.length + " 个恢复点";
      }
      if (els.backupSelect) {
        const current = els.backupSelect.value;
        els.backupSelect.innerHTML = "";
        if (!points.length) {
          const opt = document.createElement("option");
          opt.value = "";
          opt.textContent = "暂无备份点";
          els.backupSelect.appendChild(opt);
        } else {
          points.forEach(function (point, index) {
            const opt = document.createElement("option");
            opt.value = point.id;
            opt.textContent = (index === 0 ? "最新 · " : "") + (point.label || "备份") + " · " + formatBackupTime(point.createdAt) + " · " + ((point.todos && point.todos.length) || 0) + " 条";
            els.backupSelect.appendChild(opt);
          });
          if (current && Array.from(els.backupSelect.options).some(function (o) { return o.value === current; })) {
            els.backupSelect.value = current;
          }
        }
      }
    }
    function updateQuickPreview() {
      if (!els.quickPreview || !els.quickInput) return;
      const raw = els.quickInput.value || "";
      if (!String(raw).trim()) {
        els.quickPreview.hidden = true;
        els.quickPreview.innerHTML = "";
        return;
      }
      const parsed = store.parseQuick(raw, {
        priority: els.quickPriority ? els.quickPriority.value : "medium",
        listId: els.quickList && els.quickList.value ? els.quickList.value : undefined,
      });
      if (!parsed.ok) {
        els.quickPreview.hidden = false;
        els.quickPreview.innerHTML = '<span class="quick-preview__error">' + escapeHtml(parsed.error || "无法解析") + "</span>";
        return;
      }
      const p = parsed.payload || {};
      const snap = latestSnapshot || store.getSnapshot();
      const list = (snap.lists || []).find(function (item) { return item.id === p.listId; });
      const chips = [];
      chips.push('<span class="qp-chip qp-chip--title">' + escapeHtml(p.text || "") + "</span>");
      if (p.dueDate) chips.push('<span class="qp-chip">📅 ' + escapeHtml(p.dueDate) + "</span>");
      if (p.priority && p.priority !== "medium") chips.push('<span class="qp-chip">' + escapeHtml(priorityIcon(p.priority) + " " + priorityLabel(p.priority)) + "</span>");
      if (list) chips.push('<span class="qp-chip">' + escapeHtml((list.icon || "📁") + " " + list.name) + "</span>");
      (p.tags || []).forEach(function (tag) { chips.push('<span class="qp-chip">🏷️ ' + escapeHtml(tag) + "</span>"); });
      if (p.repeat && p.repeat !== "none") chips.push('<span class="qp-chip">🔁 ' + escapeHtml(p.repeat) + "</span>");
      if (p.remindEnabled) chips.push('<span class="qp-chip">🔔 ' + escapeHtml(p.remindTime || "09:00") + "</span>");
      if (p.subtasks && p.subtasks.length) chips.push('<span class="qp-chip">checklist ' + p.subtasks.length + "</span>");
      els.quickPreview.hidden = false;
      els.quickPreview.innerHTML = '<div class="quick-preview__label">将创建</div><div class="quick-preview__chips">' + chips.join("") + "</div>";
    }
    function escapeHtml(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }
    function fillBulkSelects(snapshot) {
      if (els.bulkList) {
        const current = els.bulkList.value;
        els.bulkList.innerHTML = '<option value="">移动到清单…</option>';
        (snapshot.lists || []).forEach(function (list) {
          const opt = document.createElement("option");
          opt.value = list.id;
          opt.textContent = (list.icon || "📁") + " " + list.name;
          els.bulkList.appendChild(opt);
        });
        if (current) els.bulkList.value = current;
      }
      if (els.bulkTag) {
        const current = els.bulkTag.value;
        els.bulkTag.innerHTML = '<option value="">添加标签…</option>';
        ((snapshot.managedTags || snapshot.tagLibrary || [])).forEach(function (tag) {
          const name = typeof tag === "string" ? tag : (tag && tag.name) || "";
          if (!name) return;
          const opt = document.createElement("option");
          opt.value = name;
          opt.textContent = "🏷️ " + name;
          els.bulkTag.appendChild(opt);
        });
        if (current) els.bulkTag.value = current;
      }
    }

    function highlightText(text, keyword) {
      const raw = String(text || "");
      const q = String(keyword || "").trim();
      if (!q) return escapeHtml(raw);
      const lower = raw.toLowerCase();
      const needle = q.toLowerCase();
      let out = "";
      let i = 0;
      while (i < raw.length) {
        const hit = lower.indexOf(needle, i);
        if (hit === -1) { out += escapeHtml(raw.slice(i)); break; }
        out += escapeHtml(raw.slice(i, hit)) + '<mark>' + escapeHtml(raw.slice(hit, hit + needle.length)) + '</mark>';
        i = hit + needle.length;
      }
      return out;
    }
    function renderRecentSearches(snapshot) {
      if (!els.recentSearches) return;
      const items = (snapshot.recentSearches || snapshot.settings.recentSearches || []).slice(0, 8);
      if (!items.length) { els.recentSearches.hidden = true; els.recentSearches.innerHTML = ""; return; }
      els.recentSearches.hidden = false;
      els.recentSearches.innerHTML = "";
      items.forEach(function (q) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "recent-search-chip";
        btn.textContent = q;
        btn.addEventListener("click", function () {
          store.setSettings({ search: q });
          store.pushRecentSearch(q);
        });
        els.recentSearches.appendChild(btn);
      });
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "link-btn";
      clear.textContent = "清空";
      clear.addEventListener("click", function () { store.clearRecentSearches(); });
      els.recentSearches.appendChild(clear);
    }
    function renderReminderPanel(snapshot) {
      if (!els.reminderPanel) return;
      const list = snapshot.upcomingReminders || [];
      const show = true;
      els.reminderPanel.hidden = list.length === 0 && snapshot.settings.view !== "today";
      // always show if any reminders in next 7 days, or if notifications enabled
      if (list.length) els.reminderPanel.hidden = false;
      if (!els.reminderList) return;
      els.reminderList.innerHTML = "";
      if (!list.length) {
        if (els.reminderEmpty) els.reminderEmpty.hidden = false;
        return;
      }
      if (els.reminderEmpty) els.reminderEmpty.hidden = true;
      const today = store.todayKey();
      list.forEach(function (todo) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "reminder-item" + (todo.dueDate < today ? " is-overdue" : (todo.dueDate === today ? " is-today" : ""));
        const dueLabel = todo.dueDate < today ? "已到期" : (todo.dueDate === today ? "今天" : todo.dueDate);
        row.innerHTML = '<span class="reminder-item__main"><strong>' + escapeHtml(todo.text) + '</strong><span class="muted">' + escapeHtml(dueLabel + " · " + (todo.remindTime || "09:00")) + '</span></span><span class="reminder-item__badge">🔔</span>';
        row.addEventListener("click", function () { openEditor(todo); });
        els.reminderList.appendChild(row);
      });
    }
    function renderTemplates(snapshot) {
      if (!els.templateList) return;
      const list = snapshot.templates || [];
      els.templateList.innerHTML = "";
      if (!list.length) {
        const empty = document.createElement("p");
        empty.className = "muted";
        empty.style.margin = "0";
        empty.style.fontSize = "12px";
        empty.textContent = "还没有模板。可把常用任务存成模板。";
        els.templateList.appendChild(empty);
        return;
      }
      list.forEach(function (tpl) {
        const row = document.createElement("div");
        row.className = "template-row";
        const applyBtn = document.createElement("button");
        applyBtn.type = "button";
        applyBtn.className = "ghost-btn";
        applyBtn.textContent = "套用";
        applyBtn.title = tpl.name || tpl.text;
        applyBtn.addEventListener("click", function () {
          store.applyTemplate(tpl.id).then(function (result) {
            if (!result.ok) toast(result.error || "套用失败", "error");
            else toast("已从模板创建：" + (tpl.name || tpl.text));
          });
        });
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "icon-btn";
        delBtn.textContent = "✕";
        delBtn.title = "删除模板";
        delBtn.addEventListener("click", function () {
          if (!confirm("删除模板「" + (tpl.name || tpl.text) + "」？")) return;
          store.deleteTemplate(tpl.id).then(function (result) {
            if (result.ok) toast("模板已删除");
          });
        });
        const meta = document.createElement("div");
        meta.className = "template-row__meta";
        meta.innerHTML = "<strong>" + escapeHtml(tpl.name || tpl.text) + "</strong><span class=\"muted\">" + escapeHtml((tpl.priority || "medium") + (tpl.tags && tpl.tags.length ? " · " + tpl.tags.join(",") : "")) + "</span>";
        row.appendChild(meta);
        row.appendChild(applyBtn);
        row.appendChild(delBtn);
        els.templateList.appendChild(row);
      });
    }

    function formatSyncTime(ts) {
      if (!ts) return "从未同步";
      try { return new Date(ts).toLocaleString("zh-CN", { hour12: false }); }
      catch (error) { return String(ts); }
    }
    function renderSyncPanel(snapshot) {
      if (!els.syncPanel) return;
      const sync = (snapshot && snapshot.syncStatus) || {};
      const provider = sync.provider || "gist";
      if (els.syncEnabled) els.syncEnabled.value = sync.enabled ? "on" : "off";
      if (els.syncProvider) els.syncProvider.value = provider;
      if (els.syncAuto) {
        const interval = Number(sync.autoSyncInterval || 0);
        if (interval === 1 || interval === 5 || interval === 15) els.syncAuto.value = String(interval);
        else els.syncAuto.value = sync.autoSync ? "15" : "off";
      }
      // do not overwrite token/remote while typing if focused
      const active = document.activeElement;
      if (els.syncToken && active !== els.syncToken) els.syncToken.value = sync.hasToken ? "********" : "";
      if (els.syncRemoteId && active !== els.syncRemoteId) els.syncRemoteId.value = sync.remoteId || "";
      if (els.syncEndpoint && active !== els.syncEndpoint) els.syncEndpoint.value = sync.endpoint || "";
      if (els.syncRemoteWrap) els.syncRemoteWrap.hidden = provider !== "gist";
      if (els.syncEndpointWrap) els.syncEndpointWrap.hidden = provider !== "http";
      if (els.syncMeta) {
        const bits = [];
        bits.push(sync.enabled ? "已开启" : "未开启");
        bits.push(provider === "http" ? "HTTP" : "Gist");
        if (provider === "gist" && sync.remoteId) bits.push("ID " + sync.remoteId.slice(0, 10) + (sync.remoteId.length > 10 ? "…" : ""));
        if (provider === "http" && sync.endpoint) bits.push("已配置 Endpoint");
        bits.push("上次同步：" + formatSyncTime(sync.lastSyncedAt));
        if (sync.lastResult) bits.push(sync.lastResult);
        const tombCount = Array.isArray(snapshot && snapshot.tombstones) ? snapshot.tombstones.length : (sync.tombstoneCount || 0);
        if (tombCount) bits.push("删除标记 " + tombCount);
        const conflictCount = Array.isArray(sync.lastConflicts) ? sync.lastConflicts.length : 0;
        if (conflictCount) bits.push("冲突 " + conflictCount);
        els.syncMeta.textContent = bits.join(" · ");
      }
      // conflicts list
      if (els.syncConflicts && els.syncConflictList) {
        const conflicts = Array.isArray(sync.lastConflicts) ? sync.lastConflicts : [];
        if (!conflicts.length) {
          els.syncConflicts.hidden = true;
          els.syncConflictList.innerHTML = "";
        } else {
          els.syncConflicts.hidden = false;
          els.syncConflictList.innerHTML = conflicts.slice(0, 12).map(function (item) {
            const entityLabel = item.entity === "list" ? "清单" : (item.entity === "template" ? "模板" : "任务");
            const winner = item.winner === "remote" ? "远端" : "本机";
            const label = item.winner === "remote" ? (item.remoteLabel || item.localLabel || item.id) : (item.localLabel || item.remoteLabel || item.id);
            return '<div class="sync-conflict-item"><strong>' + entityLabel + '</strong> · 保留' + winner + '版<br/>' +
              escapeHtml(label || item.id) +
              '<br/><span class="muted">本机 ' + formatSyncTime(item.localUpdatedAt) + ' / 远端 ' + formatSyncTime(item.remoteUpdatedAt) + '</span></div>';
          }).join("");
        }
      }
      if (els.tombstoneMeta) {
        const tombs = Array.isArray(snapshot && snapshot.tombstones) ? snapshot.tombstones : [];
        if (!tombs.length) els.tombstoneMeta.textContent = "暂无删除标记";
        else {
          const latest = tombs.slice().sort(function(a,b){return (b.deletedAt||0)-(a.deletedAt||0);})[0];
          els.tombstoneMeta.textContent = tombs.length + " 条删除标记 · 最近 " + formatSyncTime(latest && latest.deletedAt);
        }
      }
    }
    function readSyncForm() {
      const provider = els.syncProvider ? els.syncProvider.value : "gist";
      const tokenRaw = els.syncToken ? els.syncToken.value : "";
      const autoRaw = els.syncAuto ? els.syncAuto.value : "off";
      const interval = autoRaw === "1" || autoRaw === "5" || autoRaw === "15" ? Number(autoRaw) : 0;
      const patch = {
        enabled: !!(els.syncEnabled && els.syncEnabled.value === "on"),
        provider: provider,
        autoSync: interval > 0,
        autoSyncInterval: interval,
        remoteId: els.syncRemoteId ? els.syncRemoteId.value.trim() : "",
        endpoint: els.syncEndpoint ? els.syncEndpoint.value.trim() : ""
      };
      if (tokenRaw && tokenRaw !== "********") patch.token = tokenRaw;
      return patch;
    }
    function openEditor(todo) {
      els.editorId.value = todo ? todo.id : "";
      els.editorTitle.textContent = todo ? "编辑任务" : "新建任务";
      els.editorText.value = todo ? todo.text : "";
      els.editorNotes.value = todo ? todo.notes || "" : "";
      fillListSelects(latestSnapshot || store.getSnapshot(), todo ? todo.listId : undefined);
      if (els.editorList) {
        const fallbackList = (latestSnapshot && latestSnapshot.settings && latestSnapshot.settings.activeListId !== "all")
          ? latestSnapshot.settings.activeListId
          : ((latestSnapshot && latestSnapshot.lists && latestSnapshot.lists[0] && latestSnapshot.lists[0].id) || "");
        els.editorList.value = todo && todo.listId ? todo.listId : fallbackList;
      }
      els.editorPriority.value = todo ? todo.priority : "medium";
      els.editorDue.value = todo && todo.dueDate ? todo.dueDate : "";
      if (els.editorRepeat) els.editorRepeat.value = todo && todo.repeat ? todo.repeat : "none";
      if (els.editorRemindEnabled) els.editorRemindEnabled.checked = !!(todo && todo.remindEnabled);
      if (els.editorRemindTime) els.editorRemindTime.value = todo && todo.remindTime ? todo.remindTime : "09:00";
      editorSelectedTags = todo ? (todo.tags || []).slice() : [];
      editorSubtasks = todo ? (todo.subtasks || []).map(function (item) { return Object.assign({}, item); }) : [];
      renderEditorTagPicker();
      renderEditorSubtasks();
      els.editorArchive.textContent = todo && todo.archived ? "取消归档" : "归档";
      els.editorArchive.hidden = !todo;
      els.editorDelete.hidden = !todo;
      els.drawer.hidden = false;
      els.drawerBackdrop.hidden = false;
      els.drawer.setAttribute("aria-hidden", "false");
      requestAnimationFrame(function () {
        els.drawer.classList.add("is-open");
      });
      els.editorText.focus();
    }

    function closeEditor() {
      els.drawer.classList.remove("is-open");
      els.drawer.setAttribute("aria-hidden", "true");
      setTimeout(function () {
        els.drawer.hidden = true;
        els.drawerBackdrop.hidden = true;
      }, 180);
    }

    function fillListSelects(snapshot, selectedId) {
      const lists = (snapshot && snapshot.lists) || [];
      const preferred = selectedId || (snapshot && snapshot.settings && snapshot.settings.activeListId !== "all" ? snapshot.settings.activeListId : (lists[0] && lists[0].id));
      function fill(select) {
        if (!select) return;
        const current = select.value;
        select.innerHTML = "";
        lists.forEach(function (list) {
          const opt = document.createElement("option");
          opt.value = list.id;
          opt.textContent = (list.icon || "📁") + " " + list.name;
          select.appendChild(opt);
        });
        const desired = preferred || current;
        if (desired && Array.from(select.options).some(function (o) { return o.value === desired; })) select.value = desired;
        else if (select.options.length) select.selectedIndex = 0;
      }
      fill(els.quickList);
      fill(els.editorList);
    }

    function renderLists(snapshot) {
      if (!els.listNav) return;
      const activeListId = snapshot.settings.activeListId || "all";
      const counts = snapshot.listCounts || {};
      els.listNav.innerHTML = "";
      const allBtn = document.createElement("button");
      allBtn.type = "button";
      allBtn.className = "nav-item" + (activeListId === "all" ? " is-active" : "");
      const totalActive = (snapshot.todos || []).filter(function (todo) { return !todo.archived && !todo.completed; }).length;
      allBtn.innerHTML = "<span class=\"nav-label\"><span class=\"nav-icon\" aria-hidden=\"true\">🗂️</span><span>全部清单</span></span><span class=\"nav-count\">" + totalActive + "</span>";
      allBtn.addEventListener("click", function () { store.setSettings({ activeListId: "all" }); });
      els.listNav.appendChild(allBtn);
      (snapshot.lists || []).forEach(function (list) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "nav-item" + (activeListId === list.id ? " is-active" : "");
        btn.innerHTML = "<span class=\"nav-label\"><span class=\"nav-icon\" aria-hidden=\"true\">" + (list.icon || "📁") + "</span><span>" + list.name + "</span></span><span class=\"nav-count\">" + (counts[list.id] || 0) + "</span>";
        btn.addEventListener("click", function () { store.setSettings({ activeListId: list.id }); });
        btn.addEventListener("contextmenu", function (event) {
          event.preventDefault();
          const action = prompt("输入 rename 重命名，或 delete 删除清单", "rename");
          if (!action) return;
          if (action.toLowerCase() === "delete") {
            if (!confirm("删除清单后，任务会移动到其他清单。确定？")) return;
            store.deleteList(list.id).then(function (result) {
              if (!result.ok) toast(result.error || "删除失败", "error");
              else toast("清单已删除");
            });
          } else {
            const name = prompt("新的清单名称", list.name);
            if (!name) return;
            store.renameList(list.id, name, list.icon).then(function (result) {
              if (!result.ok) toast(result.error || "重命名失败", "error");
              else toast("清单已更新");
            });
          }
        });
        els.listNav.appendChild(btn);
      });
    }

    function getLibraryNames(snapshot) {
      const source = snapshot || latestSnapshot || store.getSnapshot();
      if (source.managedTags && source.managedTags.length) {
        return source.managedTags.map(function (item) { return item.name; });
      }
      return (source.tagLibrary || []).slice();
    }

    function renderEditorSelectedTags() {
      els.editorSelectedTags.innerHTML = "";
      if (!editorSelectedTags.length) {
        const empty = document.createElement("span");
        empty.className = "muted";
        empty.textContent = "尚未选择标签";
        els.editorSelectedTags.appendChild(empty);
        return;
      }
      editorSelectedTags.forEach(function (tag) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "selected-tag";
        chip.innerHTML = "<span>🏷️ " + tag + "</span><span aria-hidden=\"true\">×</span>";
        chip.title = "移除标签";
        applyTagColor(chip, tag, store);
        chip.addEventListener("click", function () {
          editorSelectedTags = editorSelectedTags.filter(function (item) {
            return item.toLowerCase() !== tag.toLowerCase();
          });
          renderEditorTagPicker();
        });
        els.editorSelectedTags.appendChild(chip);
      });
    }

    function renderEditorTagSelect() {
      const library = getLibraryNames();
      const selectedSet = new Set(editorSelectedTags.map(function (tag) { return tag.toLowerCase(); }));
      const available = library.filter(function (tag) { return !selectedSet.has(tag.toLowerCase()); });
      els.editorTagSelect.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = available.length ? "🏷️ 选择已有标签…" : "🏷️ 暂无可选标签";
      els.editorTagSelect.appendChild(placeholder);
      available.forEach(function (tag) {
        const option = document.createElement("option");
        option.value = tag;
        option.textContent = "🏷️ " + tag;
        els.editorTagSelect.appendChild(option);
      });
      els.editorTagSelect.disabled = available.length === 0;
      els.editorTagAdd.disabled = available.length === 0;
    }

    function renderEditorTagPicker() {
      renderEditorSelectedTags();
      renderEditorTagSelect();
    }

    function addSelectedTag(name) {
      const tags = store.normalizeTags(name);
      if (!tags.length) {
        toast("请选择或输入标签", "error");
        return false;
      }
      const tag = tags[0];
      const exists = editorSelectedTags.some(function (item) { return item.toLowerCase() === tag.toLowerCase(); });
      if (exists) {
        toast("该标签已添加", "error");
        return false;
      }
      editorSelectedTags.push(tag);
      renderEditorTagPicker();
      return true;
    }

    function openTagManager() {
      els.tagManager.style.display = "";
      els.tagManagerBackdrop.style.display = "";
      els.tagManager.hidden = false;
      els.tagManagerBackdrop.hidden = false;
      els.tagManager.setAttribute("aria-hidden", "false");
      els.tagManagerBackdrop.setAttribute("aria-hidden", "false");
      renderTagManager(latestSnapshot || store.getSnapshot());
      requestAnimationFrame(function () {
        els.tagManager.classList.add("is-open");
      });
      els.tagManagerInput.focus();
    }

    function closeTagManager() {
      els.tagManager.classList.remove("is-open");
      els.tagManager.setAttribute("aria-hidden", "true");
      els.tagManagerBackdrop.setAttribute("aria-hidden", "true");
      // Force-hide immediately so CSS display rules cannot keep it visible.
      els.tagManager.hidden = true;
      els.tagManagerBackdrop.hidden = true;
      els.tagManager.style.display = "none";
      els.tagManagerBackdrop.style.display = "none";
      // Clear inline display on next open cycle.
      window.setTimeout(function () {
        if (els.tagManager.hidden) {
          els.tagManager.style.display = "";
        }
        if (els.tagManagerBackdrop.hidden) {
          els.tagManagerBackdrop.style.display = "";
        }
      }, 0);
    }

    function renderTagManager(snapshot) {
      const list = (snapshot && snapshot.managedTags) || [];
      els.tagManagerList.innerHTML = "";
      if (!list.length) {
        const empty = document.createElement("p");
        empty.className = "muted";
        empty.textContent = "标签库还是空的，先新建一个吧。";
        els.tagManagerList.appendChild(empty);
        return;
      }
      list.forEach(function (item) {
        const row = document.createElement("div");
        row.className = "tag-manager-row";

        const main = document.createElement("div");
        main.className = "tag-manager-row__main";
        const name = document.createElement("strong");
        name.textContent = "🏷️ " + item.name;
        applyTagColor(name, item.name, store);
        name.style.padding = "4px 8px";
        name.style.borderRadius = "999px";
        name.style.border = "1px solid transparent";
        name.style.display = "inline-flex";
        const meta = document.createElement("span");
        meta.className = "muted";
        meta.textContent = item.count + " 个任务使用";
        main.appendChild(name);
        main.appendChild(meta);

        const actions = document.createElement("div");
        actions.className = "tag-manager-row__actions";

        const renameBtn = document.createElement("button");
        renameBtn.type = "button";
        renameBtn.className = "ghost-btn";
        renameBtn.textContent = "重命名";
        renameBtn.addEventListener("click", function () {
          const next = prompt("重命名标签", item.name);
          if (next == null) return;
          store.renameTag(item.name, next).then(function (result) {
            if (!result.ok) {
              toast(result.error || "重命名失败", "error");
              return;
            }
            // Keep editor selection in sync
            editorSelectedTags = editorSelectedTags.map(function (tag) {
              return tag.toLowerCase() === item.name.toLowerCase() ? result.tag : tag;
            });
            renderEditorTagPicker();
            toast("标签已重命名");
          });
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "danger-btn";
        deleteBtn.textContent = "删除";
        deleteBtn.addEventListener("click", function () {
          if (!confirm("删除标签 “" + item.name + "”？相关任务中的该标签也会被移除。")) return;
          store.deleteTag(item.name).then(function (result) {
            if (!result.ok) {
              toast(result.error || "删除失败", "error");
              return;
            }
            editorSelectedTags = editorSelectedTags.filter(function (tag) {
              return tag.toLowerCase() !== item.name.toLowerCase();
            });
            renderEditorTagPicker();
            toast("标签已删除");
          });
        });

        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);
        row.appendChild(main);
        row.appendChild(actions);
        els.tagManagerList.appendChild(row);
      });
    }
    function renderTags(snapshot) {
      const activeTag = snapshot.settings.activeTag || "";
      const tags = snapshot.tags || [];
      els.tagCloud.innerHTML = "";

      const allBtn = document.createElement("button");
      allBtn.type = "button";
      allBtn.className = "chip" + (!activeTag ? " is-active" : "");
      allBtn.innerHTML = "<span>全部标签</span>";
      allBtn.addEventListener("click", function () {
        store.setSettings({ activeTag: "" });
      });
      els.tagCloud.appendChild(allBtn);

      if (!tags.length) {
        const empty = document.createElement("p");
        empty.className = "muted";
        empty.style.margin = "4px 0 0";
        empty.textContent = "还没有标签";
        els.tagCloud.appendChild(empty);
        return;
      }

      tags.forEach(function (tag) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip" + (activeTag.toLowerCase() === tag.name.toLowerCase() ? " is-active" : "");
        btn.innerHTML = "<span>🏷️ " + tag.name + "</span><span class=\"chip-count\">" + tag.count + "</span>";
        applyTagColor(btn, tag.name, store);
        btn.addEventListener("click", function () {
          store.setSettings({
            activeTag: activeTag.toLowerCase() === tag.name.toLowerCase() ? "" : tag.name,
          });
        });
        els.tagCloud.appendChild(btn);
      });
    }

    function renderNav(snapshot) {
      $all(".nav-item").forEach(function (btn) {
        const view = btn.getAttribute("data-view");
        btn.classList.toggle("is-active", snapshot.settings.view === view);
        const countNode = btn.querySelector("[data-count]");
        if (countNode) {
          countNode.textContent = String(snapshot.counts[view] || 0);
        }
      });
    }

    function createCard(todo, snapshot) {
      const today = store.todayKey();
      const card = document.createElement("article");
      const selected = (snapshot.selectedIds || []).indexOf(todo.id) !== -1;
      card.className = "todo-card" + (todo.completed ? " is-completed" : "") + (todo.pinned ? " is-pinned" : "") + (selected ? " is-selected" : "");
      card.draggable = snapshot.settings.sort === "manual";
      card.dataset.id = todo.id;

      const top = document.createElement("div");
      top.className = "todo-card__top";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.gap = "10px";
      left.style.alignItems = "flex-start";
      left.style.minWidth = "0";

      const selectBox = document.createElement("input");
      selectBox.type = "checkbox";
      selectBox.className = "todo-card__select";
      selectBox.checked = selected;
      selectBox.title = "选择任务";
      selectBox.addEventListener("click", function (event) { event.stopPropagation(); });
      selectBox.addEventListener("change", function (event) {
        event.stopPropagation();
        store.toggleSelected(todo.id);
      });

      const checkbox = document.createElement("button");
      checkbox.type = "button";
      checkbox.className = "checkbox" + (todo.completed ? " is-checked" : "");
      checkbox.setAttribute("aria-label", todo.completed ? "标记为未完成" : "标记为已完成");
      checkbox.textContent = todo.completed ? "✓" : "";
      checkbox.addEventListener("click", function (event) {
        event.stopPropagation();
        if (!todo.completed) {
          card.classList.add("is-completing");
        }
        store.toggleTodo(todo.id).then(function (result) {
          if (result && result.repeated) toast("已完成，并生成下一次重复任务");
        });
      });

      const titleWrap = document.createElement("div");
      titleWrap.style.minWidth = "0";
      const titleRow = document.createElement("div");
      titleRow.className = "todo-card__title-row";
      const priorityDot = document.createElement("span");
      priorityDot.className = "todo-card__priority-dot";
      priorityDot.title = "优先级：" + priorityLabel(todo.priority);
      priorityDot.textContent = priorityIcon(todo.priority);
      const title = document.createElement("h3");
      title.className = "todo-card__title";
      const kw = (snapshot.settings && snapshot.settings.search) || "";
      if (kw) title.innerHTML = highlightText(todo.text, kw);
      else title.textContent = todo.text;
      titleRow.appendChild(priorityDot);
      titleRow.appendChild(title);
      titleWrap.appendChild(titleRow);

      left.appendChild(selectBox);
      left.appendChild(checkbox);
      left.appendChild(titleWrap);

      const handle = document.createElement("div");
      handle.className = "drag-handle";
      handle.title = snapshot.settings.sort === "manual" ? "拖拽排序" : "切换到手动排序后可拖拽";
      handle.textContent = "⋮⋮";

      top.appendChild(left);
      top.appendChild(handle);

      const notes = document.createElement("p");
      notes.className = "todo-card__notes";
      const noteText = todo.notes || "暂无备注，点击卡片可补充细节。";
      if (kw && todo.notes) notes.innerHTML = highlightText(todo.notes, kw);
      else notes.textContent = noteText;

      const subtasksWrap = document.createElement("div");
      subtasksWrap.className = "todo-card__subtasks";
      const subs = todo.subtasks || [];
      if (subs.length) {
        const stats = subtaskStats(subs);
        const progress = document.createElement("div");
        progress.className = "todo-card__progress";
        const label = document.createElement("span");
        label.textContent = "子任务 " + stats.done + "/" + stats.total;
        const bar = document.createElement("div");
        bar.className = "todo-card__progress-bar";
        const fill = document.createElement("span");
        fill.style.width = Math.round((stats.total ? stats.done / stats.total : 0) * 100) + "%";
        bar.appendChild(fill);
        progress.appendChild(label);
        progress.appendChild(bar);
        subtasksWrap.appendChild(progress);
        subs.slice(0, 4).forEach(function (item) {
          const row = document.createElement("label");
          row.className = "todo-card__subtask-item" + (item.completed ? " is-done" : "");
          const check = document.createElement("input");
          check.type = "checkbox";
          check.checked = !!item.completed;
          check.addEventListener("click", function (event) { event.stopPropagation(); });
          check.addEventListener("change", function (event) {
            event.stopPropagation();
            store.toggleSubtask(todo.id, item.id);
          });
          const text = document.createElement("span");
          text.textContent = item.text;
          row.appendChild(check);
          row.appendChild(text);
          subtasksWrap.appendChild(row);
        });
        if (subs.length > 4) {
          const more = document.createElement("div");
          more.className = "muted";
          more.style.fontSize = "12px";
          more.textContent = "还有 " + (subs.length - 4) + " 项，点击卡片查看全部";
          subtasksWrap.appendChild(more);
        }
      }

      const meta = document.createElement("div");
      meta.className = "todo-card__meta";

      meta.appendChild(
        makeBadge(
          priorityIcon(todo.priority) + " " + priorityLabel(todo.priority),
          "badge--" + todo.priority
        )
      );

      if (todo.completed) {
        meta.appendChild(makeBadge("✅ 已完成", "badge--done"));
      } else {
        meta.appendChild(makeBadge("🚀 进行中", "badge--active"));
      }

      const due = formatDue(todo.dueDate, todo.completed, today);
      if (due) {
        meta.appendChild(makeBadge(due.text, due.cls));
      }

      if (todo.archived) {
        meta.appendChild(makeBadge("📦 已归档", "badge--archived"));
      }
      if (todo.pinned) {
        meta.appendChild(makeBadge("📌 置顶", "badge--pinned"));
      }

      const list = ((snapshot.lists || []).find(function (item) { return item.id === todo.listId; })) || null;
      if (list) meta.appendChild(makeBadge((list.icon || "📁") + " " + list.name, "badge--list"));
      if (todo.repeat && todo.repeat !== "none") {
        const rm = REPEAT_META[todo.repeat] || REPEAT_META.none;
        meta.appendChild(makeBadge(rm.icon + " " + rm.label, "badge--repeat"));
      }
      if (todo.remindEnabled) meta.appendChild(makeBadge("🔔 " + (todo.remindTime || "09:00"), "badge--remind"));

      const tags = document.createElement("div");
      tags.className = "todo-card__tags";
      (todo.tags || []).forEach(function (tag) {
        const node = document.createElement("span");
        node.className = "tag";
        node.textContent = "🏷️ " + tag;
        applyTagColor(node, tag, store);
        tags.appendChild(node);
      });

      const foot = document.createElement("div");
      foot.className = "todo-card__foot";

      const actions = document.createElement("div");
      actions.className = "todo-card__actions";

      const pinBtn = document.createElement("button");
      pinBtn.type = "button";
      pinBtn.className = "ghost-btn";
      pinBtn.textContent = todo.pinned ? "取消置顶" : "置顶";
      pinBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        store.togglePin(todo.id).then(function () {
          toast(todo.pinned ? "已取消置顶" : "已置顶");
        });
      });

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "ghost-btn";
      editBtn.textContent = "编辑";
      editBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        openEditor(todo);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "danger-btn";
      deleteBtn.textContent = "删除";
      deleteBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        if (confirm("确定删除这个任务吗？")) {
          store.deleteTodo(todo.id).then(function () {
            toast("任务已删除");
          });
        }
      });

      actions.appendChild(pinBtn);
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      foot.appendChild(actions);

      card.appendChild(top);
      card.appendChild(notes);
      if ((todo.subtasks || []).length) card.appendChild(subtasksWrap);
      card.appendChild(meta);
      if ((todo.tags || []).length) card.appendChild(tags);
      card.appendChild(foot);

      card.addEventListener("click", function () {
        openEditor(todo);
      });

      card.addEventListener("dragstart", function (event) {
        if (snapshot.settings.sort !== "manual") {
          event.preventDefault();
          return;
        }
        dragFromId = todo.id;
        card.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", todo.id);
      });
      card.addEventListener("dragend", function () {
        card.classList.remove("is-dragging");
        dragFromId = null;
      });
      card.addEventListener("dragover", function (event) {
        if (snapshot.settings.sort !== "manual") return;
        event.preventDefault();
      });
      card.addEventListener("drop", function (event) {
        if (snapshot.settings.sort !== "manual") return;
        event.preventDefault();
        const fromId = dragFromId || event.dataTransfer.getData("text/plain");
        const toId = todo.id;
        if (!fromId || fromId === toId) return;
        store.reorderVisible(fromId, toId).then(function (result) {
          if (!result.ok && result.error) toast(result.error, "error");
        });
      });

      return card;
    }

    function renderEmptyState(snapshot, list) {
      const view = snapshot.settings.view;
      const hasAny = (snapshot.todos || []).some(function (todo) { return !todo.archived; });
      const configs = {
        all: {
          icon: "🛰️",
          eyebrow: "Empty Orbit",
          title: hasAny ? "当前筛选下没有任务" : "这里还很安静",
          text: hasAny ? "左侧数量是全部结果，主区只显示当前标签/搜索筛选后的任务。" : "创建第一条任务，开启今天的节奏。",
          action: "新建任务",
        },
        active: {
          icon: "🚀",
          eyebrow: "All Clear",
          title: "没有进行中的任务",
          text: "要么都做完了，要么还没开始。来一条新的？",
          action: "新建任务",
        },
        completed: {
          icon: "✅",
          eyebrow: "Progress",
          title: "还没有完成记录",
          text: "完成任务后，它们会出现在这里。",
          action: "查看全部任务",
        },
        today: {
          icon: "📅",
          eyebrow: "Today",
          title: "今天没有到期任务",
          text: "给重要事项加上截止日期，今天的焦点会更清楚。",
          action: "新建任务",
        },
        week: {
          icon: "🗓️",
          eyebrow: "This Week",
          title: "本周还没有安排任务",
          text: "给任务设置本周内的截止日期，就会出现在周视图里。",
          action: "新建任务",
        },
        month: {
          icon: "📆",
          eyebrow: "This Month",
          title: "本月还没有安排任务",
          text: "把月度事项补上截止日期，月视图会更有全局感。",
          action: "新建任务",
        },
        overdue: {
          icon: "😎",
          eyebrow: "Nice",
          title: "没有逾期，状态在线",
          text: "保持这个节奏，继续推进高优事项。",
          action: "查看进行中",
        },
        scheduled: {
          icon: "🔁",
          eyebrow: "Repeat",
          title: "还没有重复任务",
          text: "给习惯型事项设置每天/每周/每月，完成会自动生成下一次。",
          action: "新建任务",
        },
        archived: {
          icon: "📦",
          eyebrow: "Archive",
          title: "归档区是空的",
          text: "处理完的历史任务可以归档，保持主视图清爽。",
          action: "查看全部任务",
        },
      };
      const cfg = configs[view] || configs.all;
      if (els.emptyIcon) els.emptyIcon.textContent = cfg.icon;
      if (els.emptyEyebrow) els.emptyEyebrow.textContent = cfg.eyebrow;
      if (els.emptyTitle) els.emptyTitle.textContent = cfg.title;
      if (els.emptyText) els.emptyText.textContent = cfg.text;
      if (els.emptyAction) {
        els.emptyAction.textContent = cfg.action;
        els.emptyAction.dataset.mode = view;
      }
      els.empty.hidden = list.length !== 0;
    }

    function renderFocus(snapshot) {
      if (!els.focusPanel || !els.focusList) return;
      const focus = snapshot.focusTodos || [];
      const showFocus = snapshot.settings.view === "all" && !snapshot.settings.search && !snapshot.settings.activeTag;
      els.focusPanel.hidden = !showFocus;
      els.focusList.innerHTML = "";
      if (!showFocus) return;

      if (!focus.length) {
        els.focusEmpty.hidden = false;
        return;
      }
      els.focusEmpty.hidden = true;
      const today = store.todayKey();
      focus.forEach(function (todo, index) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "focus-item";
        const dueText = !todo.dueDate
          ? "未设截止"
          : todo.dueDate < today
            ? "逾期 " + todo.dueDate
            : todo.dueDate === today
              ? "今日到期"
              : "截止 " + todo.dueDate;
        row.innerHTML =
          "<span class=\"focus-item__index\">" + (index + 1) + "</span>" +
          "<span class=\"focus-item__body\">" +
            "<strong>" + priorityIcon(todo.priority) + " " + todo.text + "</strong>" +
            "<span class=\"muted\">" + dueText + (todo.tags && todo.tags.length ? " · 🏷️ " + todo.tags.slice(0, 2).join(" / ") : "") + "</span>" +
          "</span>" +
          "<span class=\"focus-item__go\">打开</span>";
        row.addEventListener("click", function () {
          openEditor(todo);
        });
        els.focusList.appendChild(row);
      });
    }

    function renderActiveFilters(snapshot) {
      if (!els.activeFilters || !els.activeFiltersList) return;
      const chips = [];
      const settings = snapshot.settings || {};
      if (settings.activeTag) {
        chips.push({
          key: "tag",
          label: "🏷️ 标签：" + settings.activeTag,
          clear: function () { store.setSettings({ activeTag: "" }); },
        });
      }
      if (settings.search && String(settings.search).trim()) {
        chips.push({
          key: "search",
          label: "⌕ 搜索：" + String(settings.search).trim(),
          clear: function () { store.setSettings({ search: "" }); },
        });
      }
      if (settings.activeListId && settings.activeListId !== "all") {
        const list = (snapshot.lists || []).find(function (item) { return item.id === settings.activeListId; });
        if (list) {
          chips.push({
            key: "list",
            label: (list.icon || "📁") + " 清单：" + list.name,
            clear: function () { store.setSettings({ activeListId: "all" }); },
          });
        }
      }

      els.activeFiltersList.innerHTML = "";
      if (!chips.length) {
        els.activeFilters.hidden = true;
        return;
      }

      els.activeFilters.hidden = false;
      chips.forEach(function (chip) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "filter-chip";
        btn.innerHTML = "<span>" + chip.label + "</span><span aria-hidden=\"true\">×</span>";
        btn.title = "移除该筛选";
        btn.addEventListener("click", chip.clear);
        els.activeFiltersList.appendChild(btn);
      });
    }

    function openQuickCreateWithDate(dateKey) {
      if (els.quickInput) {
        const prefix = dateKey ? (dateKey + " ") : "";
        if (!els.quickInput.value) els.quickInput.value = prefix;
        els.quickInput.focus();
      }
      if (dateKey) toast("已定位到 " + dateKey + "，可快速创建任务");
    }

    function renderCalendarBoard(snapshot) {
      if (!els.calendarBoard) return;
      const cal = snapshot.calendar;
      const isCal = snapshot.settings.view === "week" || snapshot.settings.view === "month";
      els.calendarBoard.hidden = !isCal || !cal;
      if (els.calendarToolbar) els.calendarToolbar.hidden = !isCal || !cal;
      if (!isCal || !cal) {
        els.calendarBoard.innerHTML = "";
        return;
      }
      if (els.calendarRange) els.calendarRange.textContent = cal.label || "";
      els.calendarBoard.dataset.mode = cal.mode;
      els.calendarBoard.innerHTML = "";
      const today = store.todayKey();
      (cal.days || []).forEach(function (day) {
        const cell = document.createElement("article");
        cell.className = "calendar-day" + (day.isToday ? " is-today" : "") + (day.inMonth === false ? " is-outside" : "");
        const head = document.createElement("div");
        head.className = "calendar-day__head";
        const title = document.createElement("div");
        title.className = "calendar-day__title";
        title.textContent = (day.label ? (day.label + " ") : "") + (day.day || "");
        const count = document.createElement("div");
        count.className = "calendar-day__count";
        const total = day.total != null ? day.total : ((day.todos || []).length);
        count.textContent = total ? (total + " 项") : "空";
        head.appendChild(title);
        head.appendChild(count);
        head.addEventListener("dblclick", function () {
          openQuickCreateWithDate(day.key);
        });
        const list = document.createElement("div");
        list.className = "calendar-day__list";
        const todos = day.todos || [];
        if (!todos.length) {
          const empty = document.createElement("div");
          empty.className = "calendar-empty";
          empty.textContent = "点击快速添加";
          empty.addEventListener("click", function () { openQuickCreateWithDate(day.key); });
          list.appendChild(empty);
        } else {
          todos.forEach(function (todo) {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "calendar-chip" + (todo.completed ? " is-done" : "") + ((todo.dueDate && todo.dueDate < today && !todo.completed) ? " is-overdue" : "");
            const priority = priorityIcon(todo.priority) + " ";
            chip.innerHTML = "<span>" + priority + escapeHtml(todo.text || "") + "</span>" +
              (todo.remindEnabled ? '<span class="calendar-chip__meta">⏰ ' + escapeHtml(todo.remindTime || "09:00") + "</span>" : "");
            chip.addEventListener("click", function () {
              const full = (snapshot.todos || []).find(function (item) { return item.id === todo.id; }) || todo;
              openEditor(full);
            });
            list.appendChild(chip);
          });
          if (day.total > todos.length) {
            const more = document.createElement("button");
            more.type = "button";
            more.className = "calendar-day__more";
            more.textContent = "还有 " + (day.total - todos.length) + " 项 · 查看当天";
            more.addEventListener("click", function () {
              store.setSettings({ view: "all", search: day.key, activeTag: "" });
              toast("已筛选 " + day.key + " 的任务");
            });
            list.appendChild(more);
          }
        }
        cell.appendChild(head);
        cell.appendChild(list);
        els.calendarBoard.appendChild(cell);
      });
      if ((cal.undated || []).length) {
        const box = document.createElement("section");
        box.className = "calendar-undated";
        box.innerHTML = '<div class="calendar-undated__title">未设置日期（' + cal.undated.length + '）</div>';
        const wrap = document.createElement("div");
        wrap.className = "calendar-undated__list";
        cal.undated.slice(0, 12).forEach(function (todo) {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "calendar-chip";
          chip.textContent = todo.text;
          chip.addEventListener("click", function () { openEditor(todo); });
          wrap.appendChild(chip);
        });
        box.appendChild(wrap);
        els.calendarBoard.appendChild(box);
      }
    }

    function renderBoard(snapshot) {
      const list = snapshot.visibleTodos || [];
      const isCal = snapshot.settings.view === "week" || snapshot.settings.view === "month";
      if (els.board) els.board.hidden = !!isCal;
      if (els.board) {
        els.board.innerHTML = "";
        if (!isCal) {
          list.forEach(function (todo, index) {
            const card = createCard(todo, snapshot);
            card.style.animationDelay = Math.min(index * 0.03, 0.24) + "s";
            els.board.appendChild(card);
          });
        }
      }
      renderCalendarBoard(snapshot);
      renderEmptyState(snapshot, list);
      renderFocus(snapshot);
      renderActiveFilters(snapshot);
      const totalForView = (snapshot.counts && snapshot.counts[snapshot.settings.view]) != null
        ? snapshot.counts[snapshot.settings.view]
        : null;
      if (totalForView != null && totalForView !== list.length) {
        els.resultMeta.textContent = "显示 " + list.length + " / " + totalForView + " 项";
      } else {
        els.resultMeta.textContent = list.length + " 项";
      }
      const viewMeta = VIEW_META[snapshot.settings.view] || VIEW_META.all;
      els.viewTitle.textContent = viewMeta.icon + " " + (store.viewLabels[snapshot.settings.view] || viewMeta.label);
      const parts = ["本地 IndexedDB"];
      if (snapshot.settings.activeListId && snapshot.settings.activeListId !== "all") {
        const activeList = (snapshot.lists || []).find(function (item) { return item.id === snapshot.settings.activeListId; });
        if (activeList) parts.push("清单 " + (activeList.icon || "📁") + " " + activeList.name);
      }
      if (snapshot.settings.activeTag) parts.push("标签 🏷️ " + snapshot.settings.activeTag);
      if (snapshot.settings.search) parts.push("搜索 “" + snapshot.settings.search + "”");
      if (snapshot.calendar && snapshot.calendar.label) parts.push(snapshot.calendar.label);
      if (snapshot.settings.view === "all" && (snapshot.focusTodos || []).length) {
        parts.push("焦点 " + snapshot.focusTodos.length + " 项");
      }
      els.viewSubtitle.textContent = parts.join(" · ");
    }

    function renderStats(snapshot) {
      els.statCompletion.textContent = snapshot.stats.completion + "%";
      els.statHigh.textContent = String(snapshot.stats.high);
      els.statDueSoon.textContent = String(snapshot.stats.dueSoon);
      if (els.statRepeating) els.statRepeating.textContent = String(snapshot.stats.repeating || 0);
      if (els.btnEnableNotify) {
        els.btnEnableNotify.textContent = snapshot.settings.notificationsEnabled ? "提醒已开启" : "开启浏览器提醒";
      }
      if (els.btnUndo) els.btnUndo.disabled = !snapshot.canUndo;
      document.documentElement.setAttribute("data-density", snapshot.settings.density === "compact" ? "compact" : "comfortable");
      if (els.densityToggle) {
        els.densityToggle.title = snapshot.settings.density === "compact" ? "切换到舒适模式" : "切换到紧凑模式";
      }
    }

    function renderBulkBar(snapshot) {
      if (!els.bulkBar) return;
      const selected = snapshot.selectedIds || [];
      const visibleIds = (snapshot.visibleTodos || []).map(function (todo) { return todo.id; });
      const selectedVisible = selected.filter(function (id) { return visibleIds.indexOf(id) !== -1; });
      els.bulkBar.hidden = selected.length === 0;
      if (els.bulkCount) els.bulkCount.textContent = "已选 " + selected.length + " 项";
      if (els.bulkSelectAll) {
        els.bulkSelectAll.checked = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
        els.bulkSelectAll.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visibleIds.length;
      }
    }

    function render(snapshot) {
      latestSnapshot = snapshot;
      setTheme(snapshot.settings.theme);
      els.searchInput.value = snapshot.settings.search || "";
      els.sortSelect.value = snapshot.settings.sort || "manual";
      renderNav(snapshot);
      renderLists(snapshot);
      fillListSelects(snapshot);
      fillBulkSelects(snapshot);
      renderBackupPanel(snapshot);
      renderSyncPanel(snapshot);
      renderTemplates(snapshot);
      renderRecentSearches(snapshot);
      renderReminderPanel(snapshot);
      renderTags(snapshot);
      renderStats(snapshot);
      renderBulkBar(snapshot);
      renderBoard(snapshot);
      if (!els.drawer.hidden) {
        renderEditorTagPicker();
      }
      if (!els.tagManager.hidden) {
        renderTagManager(snapshot);
      }
    }

    function bindEvents() {
      $all(".nav-item").forEach(function (btn) {
        btn.addEventListener("click", function () {
          const view = btn.getAttribute("data-view");
          const patch = { view: view };
          if ((view === "week" || view === "month") && !store.getSnapshot().settings.calendarAnchor) {
            patch.calendarAnchor = store.todayKey();
          }
          store.setSettings(patch);
        });
      });
      if (els.btnCalPrev) els.btnCalPrev.addEventListener("click", function () { store.shiftCalendar(-1); });
      if (els.btnCalNext) els.btnCalNext.addEventListener("click", function () { store.shiftCalendar(1); });
      if (els.btnCalToday) els.btnCalToday.addEventListener("click", function () {
        const view = (latestSnapshot && latestSnapshot.settings && latestSnapshot.settings.view) || "week";
        store.setSettings({ calendarAnchor: store.todayKey(), view: (view === "month" ? "month" : "week") });
      });

      let searchTimer = null;
      els.searchInput.addEventListener("input", function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          const q = els.searchInput.value;
          store.setSettings({ search: q });
          if (String(q || "").trim()) store.pushRecentSearch(q);
        }, 160);
      });

      els.sortSelect.addEventListener("change", function () {
        store.setSettings({ sort: els.sortSelect.value });
      });

      els.themeToggle.addEventListener("click", function () {
        const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
        store.setSettings({ theme: next });
      });

      els.quickForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const parsed = store.parseQuick(els.quickInput.value, {
          priority: els.quickPriority.value,
          listId: els.quickList && els.quickList.value ? els.quickList.value : undefined,
        });
        if (!parsed.ok) {
          showError(parsed.error || "请输入待办内容，空内容不能添加。");
          els.quickInput.focus();
          return;
        }
        const payload = parsed.payload;
        store.addTodo({
          text: payload.text,
          priority: payload.priority || els.quickPriority.value,
          listId: payload.listId || (els.quickList && els.quickList.value ? els.quickList.value : undefined),
          dueDate: payload.dueDate,
          tags: payload.tags,
          repeat: payload.repeat,
          remindEnabled: payload.remindEnabled,
          remindTime: payload.remindTime,
          subtasks: payload.subtasks,
        }).then(function (result) {
          if (!result.ok) {
            showError(result.error);
            els.quickInput.focus();
            return;
          }
          showError("");
          els.quickForm.reset();
          els.quickPriority.value = "medium";
          fillListSelects(latestSnapshot || store.getSnapshot());
          updateQuickPreview();
          els.quickInput.focus();
          const extra = parsed.tokens && parsed.tokens.length ? (" · " + parsed.tokens.slice(0, 4).join(" ")) : "";
          toast("任务已创建" + extra);
          store.maybeAutoBackup(false);
        });
      });

      els.quickInput.addEventListener("input", function () {
        if (!els.formError.hidden) showError("");
        updateQuickPreview();
      });
      if (els.quickPriority) els.quickPriority.addEventListener("change", updateQuickPreview);
      if (els.quickList) els.quickList.addEventListener("change", updateQuickPreview);

      els.btnNew.addEventListener("click", function () {
        openEditor(null);
      });

      if (els.btnSidebarToggle) els.btnSidebarToggle.addEventListener("click", openMobileSidebar);
      if (els.btnSidebarClose) els.btnSidebarClose.addEventListener("click", closeMobileSidebar);
      if (els.sidebarBackdrop) els.sidebarBackdrop.addEventListener("click", closeMobileSidebar);
      if (els.listNav) {
        els.listNav.addEventListener("click", function () {
          if (window.matchMedia("(max-width: 900px)").matches) closeMobileSidebar();
        });
      }
      document.querySelectorAll(".side-nav .nav-item").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (window.matchMedia("(max-width: 900px)").matches) closeMobileSidebar();
        });
      });

      function bindSyncEvents() {
        if (els.syncProvider) {
          els.syncProvider.addEventListener("change", function () {
            const provider = els.syncProvider.value;
            if (els.syncRemoteWrap) els.syncRemoteWrap.hidden = provider !== "gist";
            if (els.syncEndpointWrap) els.syncEndpointWrap.hidden = provider !== "http";
          });
        }
        async function saveSyncConfig(showToast) {
          const patch = readSyncForm();
          const result = await store.setSyncConfig(patch);
          if (showToast) toast(result.ok ? "同步配置已保存" : "保存失败");
          return result;
        }
        if (els.btnSyncSave) {
          els.btnSyncSave.addEventListener("click", function () { saveSyncConfig(true); });
        }
        async function runSync(mode) {
          if (!syncController) return toast("同步模块未就绪", "error");
          await saveSyncConfig(false);
          toast(mode === "pull" ? "正在拉取…" : (mode === "push" ? "正在推送…" : "正在同步…"));
          try {
            const result = await syncController.syncNow(mode);
            if (!result.ok) toast(result.error || "同步失败", "error");
            else if (mode === "pull") toast("拉取完成" + (result.count != null ? (" · " + result.count + " 条") : ""));
            else if (mode === "push") toast("推送完成" + (result.remoteId ? (" · Gist " + result.remoteId) : ""));
            else {
              const conflictText = (result.conflicts && result.conflicts.length) ? (" · 冲突 " + result.conflicts.length) : "";
              toast("同步完成" + (result.merged ? "（已合并）" : "（已上传）") + conflictText + (result.remoteId ? (" · " + result.remoteId) : ""));
            }
          } catch (error) {
            console.error(error);
            toast((error && error.message) || "同步失败", "error");
          }
        }
        if (els.btnSyncNow) els.btnSyncNow.addEventListener("click", function () { runSync("sync"); });
        if (els.btnSyncPush) els.btnSyncPush.addEventListener("click", function () { runSync("push"); });
        if (els.btnSyncPull) els.btnSyncPull.addEventListener("click", function () { runSync("pull"); });
        if (els.btnTombstonePrune) {
          els.btnTombstonePrune.addEventListener("click", async function () {
            const result = await store.clearTombstones({ onlyExpired: true });
            toast(result.ok ? ("已清理过期删除标记 · 剩余 " + result.remaining) : "清理失败");
          });
        }
        if (els.btnTombstoneClear) {
          els.btnTombstoneClear.addEventListener("click", async function () {
            if (!window.confirm("清空全部删除标记后，旧删除可能在其他设备同步时复活。确定继续？")) return;
            const result = await store.clearTombstones({});
            toast(result.ok ? "删除标记已清空" : "清空失败");
          });
        }
      }
      bindSyncEvents();

      // more-realtime triggers: resume / online / local data changes
      function requestAutoSync(reason, delay) {
        if (!syncController || typeof syncController.scheduleSync !== "function") return;
        syncController.scheduleSync(reason || "auto", delay);
      }
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible" && syncController && typeof syncController.onAppResume === "function") {
          syncController.onAppResume();
        }
      });
      window.addEventListener("focus", function () {
        if (syncController && typeof syncController.onAppResume === "function") syncController.onAppResume();
      });
      window.addEventListener("online", function () {
        requestAutoSync("online", 1000);
      });
      // debounce sync after local mutations (skip pure UI filter changes)
      let lastTodoSig = "";
      store.subscribe(function (snap) {
        try {
          const sig = [
            (snap.todos || []).length,
            (snap.lists || []).length,
            (snap.templates || []).length,
            (snap.tombstones || []).length,
            (snap.todos || []).reduce(function (max, t) { return Math.max(max, t.updatedAt || 0); }, 0)
          ].join("|");
          if (!lastTodoSig) { lastTodoSig = sig; return; }
          if (sig !== lastTodoSig) {
            lastTodoSig = sig;
            requestAutoSync("local-change", 2500);
          }
        } catch (error) {}
      });

      if (els.btnReminderRefresh) {
        els.btnReminderRefresh.addEventListener("click", function () {
          store.checkReminders();
          toast("提醒已刷新");
          renderReminderPanel(store.getSnapshot());
        });
      }
      if (els.btnSaveTemplate) {
        els.btnSaveTemplate.addEventListener("click", function () {
          const selected = ((latestSnapshot && latestSnapshot.selectedIds) || [])[0];
          const editingId = els.editorId && els.editorId.value;
          let payload = null;
          if (editingId) {
            payload = {
              name: els.editorText.value,
              text: els.editorText.value,
              notes: els.editorNotes.value,
              priority: els.editorPriority.value,
              dueDate: els.editorDue.value || null,
              tags: (typeof editorSelectedTags !== "undefined" ? editorSelectedTags.slice() : []),
              listId: els.editorList ? els.editorList.value : undefined,
              repeat: els.editorRepeat ? els.editorRepeat.value : "none",
              remindEnabled: !!(els.editorRemindEnabled && els.editorRemindEnabled.checked),
              remindTime: els.editorRemindTime ? els.editorRemindTime.value : "09:00",
              subtasks: (typeof editorSubtasks !== "undefined" ? editorSubtasks.slice() : [])
            };
          } else if (selected) {
            payload = { todoId: selected };
          } else {
            return toast("请先打开任务编辑器，或选中一个任务", "error");
          }
          const name = prompt("模板名称", (payload && (payload.name || payload.text)) || "未命名模板");
          if (name === null) return;
          const req = payload.todoId ? { todoId: payload.todoId, name: name } : Object.assign({}, payload, { name: name });
          store.saveTemplate(req).then(function (result) {
            if (!result.ok) toast(result.error || "保存失败", "error");
            else toast("模板已保存");
          });
        });
      }
      if (els.btnBackupNow) {
        els.btnBackupNow.addEventListener("click", function () {
          store.createBackup("手动备份").then(function (result) {
            if (!result.ok) toast(result.error || "备份失败", "error");
            else toast("已创建备份 · " + result.count + " 条任务");
          });
        });
      }
      if (els.btnBackupRestore) {
        els.btnBackupRestore.addEventListener("click", function () {
          const id = els.backupSelect ? els.backupSelect.value : "";
          if (!id) return toast("请先选择备份点", "error");
          if (!confirm("确定恢复到该备份点吗？当前数据会被覆盖（可用撤销找回本次恢复前状态）。")) return;
          store.restoreBackup(id).then(function (result) {
            if (!result.ok) toast(result.error || "恢复失败", "error");
            else toast("已恢复备份：" + (result.label || "") + " · " + result.count + " 条");
          });
        });
      }
      if (els.btnBackupDownload) {
        els.btnBackupDownload.addEventListener("click", function () {
          const id = els.backupSelect ? els.backupSelect.value : "";
          const points = (latestSnapshot && latestSnapshot.backupPoints) || [];
          const point = points.find(function (item) { return item.id === id; }) || points[0];
          if (!point) return toast("暂无备份可下载", "error");
          const blob = new Blob([JSON.stringify(point, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "nova-todo-backup-" + store.todayKey() + ".json";
          a.click();
          URL.revokeObjectURL(url);
          toast("备份已下载");
        });
      }


      function openShortcuts() {
        if (!els.shortcutsModal) return;
        els.shortcutsModal.hidden = false;
        if (els.shortcutsBackdrop) els.shortcutsBackdrop.hidden = false;
      }
      function closeShortcuts() {
        if (!els.shortcutsModal) return;
        els.shortcutsModal.hidden = true;
        if (els.shortcutsBackdrop) els.shortcutsBackdrop.hidden = true;
      }

      if (els.densityToggle) {
        els.densityToggle.addEventListener("click", function () {
          const next = (latestSnapshot && latestSnapshot.settings && latestSnapshot.settings.density) === "compact" ? "comfortable" : "compact";
          store.setDensity(next).then(function () {
            toast(next === "compact" ? "已切换紧凑模式" : "已切换舒适模式");
          });
        });
      }
      if (els.btnUndo) {
        els.btnUndo.addEventListener("click", function () {
          store.undo().then(function (result) {
            if (!result.ok) toast(result.error || "无法撤销", "error");
            else toast("已撤销：" + (result.label || "变更"));
          });
        });
      }
      if (els.btnShortcuts) els.btnShortcuts.addEventListener("click", openShortcuts);
      if (els.shortcutsClose) els.shortcutsClose.addEventListener("click", closeShortcuts);
      if (els.shortcutsBackdrop) els.shortcutsBackdrop.addEventListener("click", closeShortcuts);

      if (els.bulkSelectAll) {
        els.bulkSelectAll.addEventListener("change", function () {
          if (els.bulkSelectAll.checked) store.selectVisible();
          else store.clearSelection();
        });
      }
      if (els.bulkComplete) {
        els.bulkComplete.addEventListener("click", function () {
          store.bulkComplete(null, true).then(function (result) {
            if (!result.ok) toast(result.error || "操作失败", "error");
            else toast("已批量完成 " + result.count + " 项");
          });
        });
      }
      if (els.bulkPin) {
        els.bulkPin.addEventListener("click", async function () {
          const ids = (latestSnapshot && latestSnapshot.selectedIds) || [];
          if (!ids.length) return toast("请先选择任务", "error");
          for (const id of ids) await store.togglePin(id);
          toast("已切换置顶状态");
        });
      }
      if (els.bulkArchive) {
        els.bulkArchive.addEventListener("click", function () {
          store.bulkArchive(null, true).then(function (result) {
            if (!result.ok) toast(result.error || "操作失败", "error");
            else toast("已批量归档 " + result.count + " 项");
          });
        });
      }
      if (els.bulkDelete) {
        els.bulkDelete.addEventListener("click", function () {
          if (!confirm("确定删除选中的任务吗？")) return;
          store.bulkDelete().then(function (result) {
            if (!result.ok) toast(result.error || "操作失败", "error");
            else toast("已删除 " + result.count + " 项");
          });
        });
      }
      if (els.bulkClear) els.bulkClear.addEventListener("click", function () { store.clearSelection(); });
      if (els.bulkPriority) {
        els.bulkPriority.addEventListener("change", function () {
          const value = els.bulkPriority.value;
          if (!value) return;
          store.bulkSetPriority(value).then(function (result) {
            els.bulkPriority.value = "";
            if (!result.ok) toast(result.error || "操作失败", "error");
            else toast("已批量设置优先级 " + result.count + " 项");
          });
        });
      }
      if (els.bulkList) {
        els.bulkList.addEventListener("change", function () {
          const value = els.bulkList.value;
          if (!value) return;
          store.bulkMoveList(value).then(function (result) {
            els.bulkList.value = "";
            if (!result.ok) toast(result.error || "操作失败", "error");
            else toast("已批量移动 " + result.count + " 项");
          });
        });
      }
      if (els.bulkTag) {
        els.bulkTag.addEventListener("change", function () {
          const value = els.bulkTag.value;
          if (!value) return;
          store.bulkAddTag(value).then(function (result) {
            els.bulkTag.value = "";
            if (!result.ok) toast(result.error || "操作失败", "error");
            else toast("已批量添加标签 " + result.count + " 项");
          });
        });
      }


      if (els.emptyAction) {
        els.emptyAction.addEventListener("click", function () {
          const mode = els.emptyAction.dataset.mode;
          if (mode === "completed" || mode === "archived") {
            store.setSettings({ view: "all" });
            return;
          }
          if (mode === "overdue") {
            store.setSettings({ view: "active" });
            return;
          }
          openEditor(null);
        });
      }

      if (els.btnFocusToday) {
        els.btnFocusToday.addEventListener("click", function () {
          store.setSettings({ view: "today", activeTag: "", search: "" });
        });
      }

      if (els.btnClearFilters) {
        els.btnClearFilters.addEventListener("click", function () {
          store.setSettings({ activeTag: "", search: "", activeListId: "all" });
          toast("已清除标签/搜索/清单筛选");
        });
      }

      els.btnClearCompleted.addEventListener("click", function () {
        store.clearCompleted().then(function (result) {
          toast(result.removed ? ("已清理 " + result.removed + " 项已完成任务") : "没有可清理的已完成任务");
        });
      });

      if (els.btnAddList) {
        els.btnAddList.addEventListener("click", function () {
          const name = prompt("新清单名称", "新项目");
          if (!name) return;
          store.createList({ name: name, icon: "📁" }).then(function (result) {
            if (!result.ok) toast(result.error || "创建失败", "error");
            else {
              store.setSettings({ activeListId: result.list.id });
              toast("清单已创建");
            }
          });
        });
      }

      if (els.btnEnableNotify) {
        els.btnEnableNotify.addEventListener("click", async function () {
          if (!("Notification" in window)) {
            toast("当前浏览器不支持通知", "error");
            return;
          }
          let permission = Notification.permission;
          if (permission !== "granted") permission = await Notification.requestPermission();
          if (permission !== "granted") {
            toast("未获得通知权限", "error");
            await store.setSettings({ notificationsEnabled: false });
            return;
          }
          await store.setSettings({ notificationsEnabled: true });
          store.startReminderLoop(function (todo) {
            try {
              new Notification("Nova Todo 提醒", {
                body: todo.text + (todo.dueDate ? (" · 截止 " + todo.dueDate) : ""),
              });
            } catch (error) {
              console.warn(error);
            }
            toast("提醒：" + todo.text);
          });
          toast("浏览器提醒已开启");
        });
      }

      if (els.btnSharePack) {
        els.btnSharePack.addEventListener("click", function () {
          const data = store.createSharePack();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "nova-todo-share-" + store.todayKey() + ".json";
          a.click();
          URL.revokeObjectURL(url);
          toast("分享包已导出，可发给朋友导入");
        });
      }

      els.btnExport.addEventListener("click", function () {
        store.exportData().then(function (data) {
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "nova-todo-export-" + store.todayKey() + ".json";
          a.click();
          URL.revokeObjectURL(url);
          toast("导出完成");
        });
      });

      els.btnImport.addEventListener("click", function () {
        els.importFile.click();
      });

      els.importFile.addEventListener("change", function () {
        const file = els.importFile.files && els.importFile.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
          try {
            const payload = JSON.parse(String(reader.result || "{}"));
            const mode = confirm("点击“确定”覆盖导入，点击“取消”合并导入。") ? "replace" : "merge";
            store.importData(payload, mode).then(function (result) {
              toast("导入完成，处理 " + result.count + " 条任务");
            });
          } catch (error) {
            toast("导入失败：JSON 无法解析", "error");
          } finally {
            els.importFile.value = "";
          }
        };
        reader.readAsText(file, "utf-8");
      });

      els.editorTagAdd.addEventListener("click", function () {
        if (!els.editorTagSelect.value) {
          toast("请先选择标签", "error");
          return;
        }
        if (addSelectedTag(els.editorTagSelect.value)) {
          els.editorTagSelect.value = "";
        }
      });

      els.editorTagCreate.addEventListener("click", function () {
        const name = els.editorTagNew.value;
        store.createTag(name).then(function (result) {
          if (!result.ok && result.error !== "标签已存在。") {
            toast(result.error || "创建失败", "error");
            return;
          }
          const tagName = result.tag || store.normalizeTags(name)[0];
          if (tagName && addSelectedTag(tagName)) {
            els.editorTagNew.value = "";
            if (result.ok) toast("标签已创建并添加");
          }
        });
      });

      els.editorTagNew.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          els.editorTagCreate.click();
        }
      });

      els.btnOpenTagManager.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        openTagManager();
      });
      els.tagManagerClose.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        closeTagManager();
      });
      els.tagManagerBackdrop.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        closeTagManager();
      });
      els.tagManagerCreate.addEventListener("submit", function (event) {
        event.preventDefault();
        store.createTag(els.tagManagerInput.value).then(function (result) {
          if (!result.ok) {
            toast(result.error || "创建失败", "error");
            return;
          }
          els.tagManagerInput.value = "";
          toast("标签已加入标签库");
        });
      });
      els.editorClose.addEventListener("click", closeEditor);
      els.drawerBackdrop.addEventListener("click", closeEditor);

      if (els.editorSubtaskAdd) {
        els.editorSubtaskAdd.addEventListener("click", function () {
          if (addEditorSubtask(els.editorSubtaskNew ? els.editorSubtaskNew.value : "")) {
            if (els.editorSubtaskNew) els.editorSubtaskNew.value = "";
          }
        });
      }
      if (els.editorSubtaskNew) {
        els.editorSubtaskNew.addEventListener("keydown", function (event) {
          if (event.key === "Enter") {
            event.preventDefault();
            if (addEditorSubtask(els.editorSubtaskNew.value)) els.editorSubtaskNew.value = "";
          }
        });
      }

      els.editorForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const id = els.editorId.value;
        const payload = {
          text: els.editorText.value,
          notes: els.editorNotes.value,
          subtasks: (editorSubtasks || []).map(function (item, index) {
            return {
              id: item.id,
              text: String(item.text || "").trim(),
              completed: !!item.completed,
              order: typeof item.order === "number" ? item.order : (index + 1) * 1000,
            };
          }).filter(function (item) { return !!item.text; }),
          priority: els.editorPriority.value,
          dueDate: els.editorDue.value || null,
          tags: editorSelectedTags.slice(),
          listId: els.editorList ? els.editorList.value : undefined,
          repeat: els.editorRepeat ? els.editorRepeat.value : "none",
          remindEnabled: !!(els.editorRemindEnabled && els.editorRemindEnabled.checked),
          remindTime: els.editorRemindTime ? els.editorRemindTime.value : "09:00",
        };

        const action = id
          ? store.updateTodo(id, payload)
          : store.addTodo(payload);

        action.then(function (result) {
          if (!result.ok) {
            toast(result.error || "保存失败", "error");
            return;
          }
          closeEditor();
          toast(id ? "任务已更新" : "任务已创建");
        });
      });

      els.editorArchive.addEventListener("click", function () {
        const id = els.editorId.value;
        if (!id) return;
        const snapshot = store.getSnapshot();
        const todo = snapshot.todos.find(function (item) { return item.id === id; });
        store.archiveTodo(id, !(todo && todo.archived)).then(function (result) {
          if (result.ok) {
            closeEditor();
            toast(todo && todo.archived ? "已取消归档" : "任务已归档");
          }
        });
      });

      els.editorDelete.addEventListener("click", function () {
        const id = els.editorId.value;
        if (!id) return;
        if (!confirm("确定删除这个任务吗？")) return;
        store.deleteTodo(id).then(function () {
          closeEditor();
          toast("任务已删除");
        });
      });

      document.addEventListener("keydown", function (event) {
        const tag = (event.target && event.target.tagName) || "";
        const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (event.target && event.target.isContentEditable);

        if (event.key === "Escape") {
          if (els.shortcutsModal && !els.shortcutsModal.hidden) { closeShortcuts(); return; }
          if (!els.tagManager.hidden) { closeTagManager(); return; }
          if (!els.drawer.hidden) { closeEditor(); return; }
          store.clearSelection();
          return;
        }
        if ((event.ctrlKey || event.metaKey) && (event.key === "z" || event.key === "Z")) {
          if (typing) return;
          event.preventDefault();
          store.undo().then(function (result) {
            if (!result.ok) toast(result.error || "无法撤销", "error");
            else toast("已撤销：" + (result.label || "变更"));
          });
          return;
        }
        if ((event.ctrlKey || event.metaKey) && (event.key === "a" || event.key === "A")) {
          if (typing) return;
          event.preventDefault();
          store.selectVisible();
          return;
        }
        if (event.key === "Delete") {
          if (typing) return;
          const ids = (latestSnapshot && latestSnapshot.selectedIds) || [];
          if (!ids.length) return;
          event.preventDefault();
          if (!confirm("确定删除选中的任务吗？")) return;
          store.bulkDelete(ids).then(function (result) {
            if (result.ok) toast("已删除 " + result.count + " 项");
          });
          return;
        }
        if (typing) return;
        if (event.key === "n" || event.key === "N") {
          event.preventDefault();
          openEditor(null);
        } else if (event.key === "/") {
          event.preventDefault();
          if (els.searchInput) els.searchInput.focus();
        } else if (event.key === "?") {
          openShortcuts();
        }
      });
    }

    let syncController = null;
    function setSyncController(controller) { syncController = controller; }

    return {
      bindEvents: bindEvents,
      render: render,
      toast: toast,
      openEditor: openEditor,
      setSyncController: setSyncController,
    };
  }

  global.NovaUI = {
    createUI: createUI,
  };
})(window);








