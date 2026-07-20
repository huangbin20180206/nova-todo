(function (global) {
  "use strict";

  function createPwa(options) {
    options = options || {};
    var toast = options.toast || function () {};
    var banner = options.banner || null;
    var reloadBtn = options.reloadBtn || null;
    var dismissBtn = options.dismissBtn || null;
    var statusEl = options.statusEl || null;
    var waitingWorker = null;

    function setStatus(text) {
      if (statusEl) statusEl.textContent = text;
    }

    function showUpdateBanner() {
      if (banner) banner.hidden = false;
      setStatus("发现新版本");
    }

    function hideUpdateBanner() {
      if (banner) banner.hidden = true;
    }

    function updateOnlineStatus() {
      var online = navigator.onLine;
      document.body.classList.toggle("is-offline", !online);
      setStatus(online ? "可离线使用" : "当前离线，已启用本地缓存");
    }

    async function register() {
      updateOnlineStatus();
      window.addEventListener("online", updateOnlineStatus);
      window.addEventListener("offline", updateOnlineStatus);

      if (!("serviceWorker" in navigator)) {
        setStatus("当前浏览器不支持 PWA");
        return null;
      }

      try {
        var reg = await navigator.serviceWorker.register("./sw.js");
        if (reg.waiting) {
          waitingWorker = reg.waiting;
          showUpdateBanner();
        }
        reg.addEventListener("updatefound", function () {
          var worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", function () {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              waitingWorker = reg.waiting || worker;
              showUpdateBanner();
              toast("发现新版本，可立即更新");
            }
          });
        });
        // periodic update check
        setInterval(function () {
          reg.update().catch(function () {});
        }, 30 * 60 * 1000);

        if (reloadBtn) {
          reloadBtn.addEventListener("click", function () {
            var worker = waitingWorker || reg.waiting;
            if (worker) {
              worker.postMessage({ type: "SKIP_WAITING" });
            } else {
              window.location.reload();
            }
          });
        }
        if (dismissBtn) {
          dismissBtn.addEventListener("click", hideUpdateBanner);
        }

        var refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", function () {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });

        setStatus(navigator.onLine ? "PWA 已就绪" : "离线模式");
        return reg;
      } catch (error) {
        console.warn("SW register failed", error);
        setStatus("PWA 注册失败");
        return null;
      }
    }

    return { register: register, showUpdateBanner: showUpdateBanner, hideUpdateBanner: hideUpdateBanner };
  }

  global.NovaPwa = { createPwa: createPwa };
})(window);
