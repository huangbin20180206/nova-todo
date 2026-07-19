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

    ui.bindEvents();
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
      const input = document.querySelector("#quick-input");
      if (input) input.focus();
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
