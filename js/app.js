(function () {
  "use strict";

  function notifyTodo(todo) {
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Nova Todo 提醒", {
          body: todo.text + (todo.dueDate ? (" · 截止 " + todo.dueDate) : ""),
        });
      }
    } catch (error) {
      console.warn(error);
    }
  }

  async function boot() {
    if (!window.indexedDB) {
      document.body.innerHTML = "<div style=\"padding:40px;font-family:sans-serif;color:#fff;background:#0b1220;min-height:100vh\">当前浏览器不支持 IndexedDB，无法运行 Nova Todo。</div>";
      return;
    }

    const store = window.NovaStore.createStore(window.NovaDB);
    const ui = window.NovaUI.createUI(store);
    const sync = (window.NovaSync && window.NovaSync.createSync)
      ? window.NovaSync.createSync(store, { toast: function (msg) { ui.toast(msg); } })
      : null;

    ui.bindEvents();
    if (sync && ui.setSyncController) ui.setSyncController(sync);
    store.subscribe(function (snapshot) {
      ui.render(snapshot);
    });

    try {
      const snapshot = await store.init();
      if (snapshot.settings && snapshot.settings.notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
        store.startReminderLoop(function (todo) {
          notifyTodo(todo);
          ui.toast("提醒：" + todo.text);
        });
      }

      if (window.NovaPwa && typeof window.NovaPwa.createPwa === "function") {
        const pwa = window.NovaPwa.createPwa({
          toast: function (msg) { ui.toast(msg); },
          banner: document.querySelector("#pwa-update-banner"),
          reloadBtn: document.querySelector("#btn-pwa-reload"),
          dismissBtn: document.querySelector("#btn-pwa-dismiss"),
          statusEl: document.querySelector("#pwa-status"),
        });
        await pwa.register();
      } else if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("./sw.js").catch(function (error) {
          console.warn("SW register failed", error);
        });
      }

      const schemaLabel = document.querySelector("#schema-version");
      if (schemaLabel) {
        schemaLabel.textContent = "schema v" + ((snapshot && snapshot.schemaVersion) || (window.NovaSchema && window.NovaSchema.SCHEMA_VERSION) || 4);
      }

      const input = document.querySelector("#quick-input");
      if (input) input.focus();

      // auto-sync loop is owned by NovaSync (interval + resume + local-change debounce)
      if (sync && typeof sync.startAutoSync === "function") {
        sync.startAutoSync();
      }
    } catch (error) {
      console.error(error);
      ui.toast("初始化失败，请刷新重试", "error");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
