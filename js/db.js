(function (global) {
  "use strict";

  const DB_NAME = "nova-todo-db";
  const DB_VERSION = 1;
  const STORE_TODOS = "todos";
  const STORE_META = "meta";

  function openDb() {
    return new Promise(function (resolve, reject) {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_TODOS)) {
          const todos = db.createObjectStore(STORE_TODOS, { keyPath: "id" });
          todos.createIndex("by_createdAt", "createdAt", { unique: false });
          todos.createIndex("by_updatedAt", "updatedAt", { unique: false });
          todos.createIndex("by_dueDate", "dueDate", { unique: false });
          todos.createIndex("by_priority", "priority", { unique: false });
          todos.createIndex("by_completed", "completed", { unique: false });
          todos.createIndex("by_archived", "archived", { unique: false });
          todos.createIndex("by_order", "order", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: "key" });
        }
      };

      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("IndexedDB open failed")); };
    });
  }

  function txDone(tx) {
    return new Promise(function (resolve, reject) {
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error || new Error("IndexedDB transaction failed")); };
      tx.onabort = function () { reject(tx.error || new Error("IndexedDB transaction aborted")); };
    });
  }

  function reqToPromise(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("IndexedDB request failed")); };
    });
  }

  async function withStore(mode, storeName, fn) {
    const db = await openDb();
    try {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const result = await fn(store, tx);
      await txDone(tx);
      return result;
    } finally {
      db.close();
    }
  }

  const dbApi = {
    async getAllTodos() {
      return withStore("readonly", STORE_TODOS, function (store) {
        return reqToPromise(store.getAll());
      });
    },

    async putTodo(todo) {
      return withStore("readwrite", STORE_TODOS, function (store) {
        return reqToPromise(store.put(todo));
      });
    },

    async putTodos(todos) {
      return withStore("readwrite", STORE_TODOS, async function (store) {
        for (const todo of todos) {
          await reqToPromise(store.put(todo));
        }
      });
    },

    async deleteTodo(id) {
      return withStore("readwrite", STORE_TODOS, function (store) {
        return reqToPromise(store.delete(id));
      });
    },

    async clearTodos() {
      return withStore("readwrite", STORE_TODOS, function (store) {
        return reqToPromise(store.clear());
      });
    },

    async getMeta(key, fallback) {
      const row = await withStore("readonly", STORE_META, function (store) {
        return reqToPromise(store.get(key));
      });
      return row ? row.value : fallback;
    },

    async setMeta(key, value) {
      return withStore("readwrite", STORE_META, function (store) {
        return reqToPromise(store.put({ key: key, value: value }));
      });
    },

    async exportAll() {
      const [todos, settings] = await Promise.all([
        dbApi.getAllTodos(),
        dbApi.getMeta("settings", null),
      ]);
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        todos: todos,
        settings: settings,
      };
    },

    async importAll(payload, mode) {
      const todos = Array.isArray(payload.todos) ? payload.todos : [];
      if (mode === "replace") {
        await dbApi.clearTodos();
      }
      if (todos.length) {
        await dbApi.putTodos(todos);
      }
      if (payload.settings) {
        await dbApi.setMeta("settings", payload.settings);
      }
    },
  };

  global.NovaDB = dbApi;
})(window);
