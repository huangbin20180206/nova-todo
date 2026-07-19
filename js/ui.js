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
      renderEditorTagPicker();
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
      card.className = "todo-card" + (todo.completed ? " is-completed" : "");
      card.draggable = snapshot.settings.sort === "manual";
      card.dataset.id = todo.id;

      const top = document.createElement("div");
      top.className = "todo-card__top";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.gap = "10px";
      left.style.alignItems = "flex-start";
      left.style.minWidth = "0";

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
        store.toggleTodo(todo.id);
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
      title.textContent = todo.text;
      titleRow.appendChild(priorityDot);
      titleRow.appendChild(title);
      titleWrap.appendChild(titleRow);

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
      notes.textContent = todo.notes || "暂无备注，点击卡片可补充细节。";

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

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      foot.appendChild(actions);

      card.appendChild(top);
      card.appendChild(notes);
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

    function renderBoard(snapshot) {
      const list = snapshot.visibleTodos || [];
      els.board.innerHTML = "";
      list.forEach(function (todo, index) {
        const card = createCard(todo, snapshot);
        card.style.animationDelay = Math.min(index * 0.03, 0.24) + "s";
        els.board.appendChild(card);
      });
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
    }

    function render(snapshot) {
      latestSnapshot = snapshot;
      setTheme(snapshot.settings.theme);
      els.searchInput.value = snapshot.settings.search || "";
      els.sortSelect.value = snapshot.settings.sort || "manual";
      renderNav(snapshot);
      renderLists(snapshot);
      fillListSelects(snapshot);
      renderTags(snapshot);
      renderStats(snapshot);
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
          store.setSettings({ view: btn.getAttribute("data-view") });
        });
      });

      let searchTimer = null;
      els.searchInput.addEventListener("input", function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          store.setSettings({ search: els.searchInput.value });
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
        store.addTodo({
          text: els.quickInput.value,
          priority: els.quickPriority.value,
          listId: els.quickList && els.quickList.value ? els.quickList.value : undefined,
        }).then(function (result) {
          if (!result.ok) {
            showError(result.error);
            els.quickInput.focus();
            return;
          }
          showError("");
          els.quickForm.reset();
          els.quickPriority.value = "medium";
          els.quickInput.focus();
          toast("任务已创建");
        });
      });

      els.quickInput.addEventListener("input", function () {
        if (!els.formError.hidden) showError("");
      });

      els.btnNew.addEventListener("click", function () {
        openEditor(null);
      });

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

      els.editorForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const id = els.editorId.value;
        const payload = {
          text: els.editorText.value,
          notes: els.editorNotes.value,
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
        if (event.key === "Escape") {
          if (!els.tagManager.hidden) {
            closeTagManager();
            return;
          }
          if (!els.drawer.hidden) {
            closeEditor();
          }
        }
      });
    }

    return {
      bindEvents: bindEvents,
      render: render,
      toast: toast,
      openEditor: openEditor,
    };
  }

  global.NovaUI = {
    createUI: createUI,
  };
})(window);








