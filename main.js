/*
 * Obsidian Window Docker Plugin (main.js)
 * 极简主题适配版：无多余工具栏、无 Emoji、支持多窗口并发固定、支持将任意应用独立添加到左侧功能区、基于 DWM Thumbnail 硬件合成顶层浮层防遮挡
 */

const {
  Plugin,
  ItemView,
  Modal,
  Notice,
  Setting,
  Menu,
  setIcon,
  addIcon
} = require("obsidian");
const { spawn, execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const VIEW_TYPE_WINDOW_DOCKER = "window-docker-view";

const APP_PROFILES = [
  {
    key: "wechat",
    label: "微信",
    icon: "docker-wechat",
    priority: 100,
    preferOverlay: true,
    match(p, t) {
      return p.includes("wechat") || p.includes("weixin") || t.includes("微信");
    }
  },
  {
    key: "flclash",
    label: "FlClash",
    icon: "docker-flclash",
    priority: 95,
    preferOverlay: true,
    match(p, t) {
      return p.includes("flclash") || t.includes("flclash") || (p.includes("clash") && !p.includes(" obsidian"));
    }
  },
  {
    key: "chatgpt",
    label: "ChatGPT",
    icon: "docker-chatgpt",
    priority: 90,
    preferOverlay: true,
    match(p, t) {
      return p.includes("chatgpt") || t.includes("chatgpt");
    }
  },
  {
    key: "antigravity",
    label: "Antigravity",
    icon: "docker-antigravity",
    priority: 85,
    preferOverlay: true,
    match(p, t) {
      return (
        p.includes("antigravity") ||
        p === "agy" ||
        t.includes("antigravity")
      );
    }
  },
  {
    key: "edge",
    label: "Edge",
    icon: "docker-edge",
    priority: 80,
    preferOverlay: true,
    match(p, t) {
      return (
        p.includes("msedge") ||
        p === "edge" ||
        t.includes("microsoft edge") ||
        t.includes("microsoft\u200b edge")
      );
    }
  },
  {
    key: "qq",
    label: "QQ",
    icon: "docker-qq",
    priority: 75,
    preferOverlay: true,
    match(p, t) {
      return p === "qq" || p === "tim" || t.includes("qq");
    }
  }
];

function matchAppProfile(processName = "", title = "") {
  const p = (processName || "").toLowerCase().trim();
  const t = (title || "").toLowerCase().trim();
  for (const prof of APP_PROFILES) {
    if (prof.match(p, t)) {
      return prof;
    }
  }
  return null;
}

function getAppKey(processName = "", title = "", explicitKey = "") {
  if (explicitKey) return explicitKey.toLowerCase();
  const prof = matchAppProfile(processName, title);
  if (prof) return prof.key;
  return (processName || title || "unknown").toLowerCase();
}

function getFriendlyAppLabel(processName = "", title = "") {
  const prof = matchAppProfile(processName, title);
  if (prof) return prof.label;
  return title || processName || "外部窗口";
}

function getWindowPriority(processName = "", title = "") {
  const prof = matchAppProfile(processName, title);
  return prof ? prof.priority : 0;
}

function shouldPreferOverlayMode(processName = "", title = "") {
  const prof = matchAppProfile(processName, title);
  return prof ? !!prof.preferOverlay : false;
}

function registerCustomIcons() {
  addIcon(
    "docker-wechat",
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 4C5.36 4 2 6.91 2 10.5c0 1.98 1.03 3.75 2.65 4.94L4 18l2.74-1.37c.87.24 1.8.37 2.76.37.34 0 .68-.02 1.01-.06"/><path d="M15.5 9c3.59 0 6.5 2.46 6.5 5.5 0 1.66-.87 3.15-2.25 4.16L20.5 21l-2.32-1.16c-.82.23-1.72.36-2.68.36-3.59 0-6.5-2.46-6.5-5.5S11.91 9 15.5 9z"/><circle cx="7" cy="9.5" r="0.8" fill="currentColor"/><circle cx="11.5" cy="9.5" r="0.8" fill="currentColor"/><circle cx="13.5" cy="14" r="0.7" fill="currentColor"/><circle cx="17.5" cy="14" r="0.7" fill="currentColor"/></svg>`
  );

  addIcon(
    "docker-qq",
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-3.8 0-6.5 2.9-6.5 6.8 0 1.2.3 2.3.7 3.2-.9.9-1.7 2.4-1.7 3.6 0 .8.6 1.2 1.3.9.5-.2 1-.6 1.4-1.1.9 1.6 2.7 2.6 4.8 2.6s3.9-1 4.8-2.6c.4.5.9.9 1.4 1.1.7.3 1.3-.1 1.3-.9 0-1.2-.8-2.7-1.7-3.6.4-.9.7-2 .7-3.2C18.5 5.9 15.8 3 12 3z"/><path d="M9 19.5c-1.2.3-2 1-2 1.7 0 .5.8.8 2.2.8h5.6c1.4 0 2.2-.3 2.2-.8 0-.7-.8-1.4-2-1.7"/></svg>`
  );

  addIcon(
    "docker-flclash",
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11V4l4.5 3.5h5L19 4v7c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10z"/><path d="M9.5 12l2-2.5 1 2 2-2.5"/><circle cx="9.2" cy="11.5" r="0.8" fill="currentColor"/><circle cx="14.8" cy="11.5" r="0.8" fill="currentColor"/></svg>`
  );

  addIcon(
    "docker-edge",
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 15.2A9 9 0 1 1 19 6.7c1.5 1.8 1.8 4.5-.2 6-1.6 1.2-4.2 1.1-5.8-.2-.9-.8-1.3-2-.9-3.2.4-1.3 1.8-2.1 3.3-1.8"/><path d="M8.5 14.5c-1.5-1.5-1.8-4-.5-5.8 1.4-2 4.3-2.7 6.8-1.8"/><path d="M12.2 12.7c-2.2.8-3.7 3-3.2 5.3.4 1.6 1.8 2.7 3.5 3"/></svg>`
  );

  addIcon(
    "docker-chatgpt",
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a4.5 4.5 0 0 0-4.2 3H7.5A4.5 4.5 0 0 0 3.6 12.8L3.8 13a4.5 4.5 0 0 0 4.2 6h.3a4.5 4.5 0 0 0 7.9.8l.1-.2a4.5 4.5 0 0 0 3.9-6.6l-.1-.2A4.5 4.5 0 0 0 16.2 6H16A4.5 4.5 0 0 0 12 3z"/><polygon points="12 8.2 15.3 10.1 15.3 13.9 12 15.8 8.7 13.9 8.7 10.1 12 8.2"/></svg>`
  );

  addIcon(
    "docker-antigravity",
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L4.5 19.5h3.2l1.6-3.8h5.4l1.6 3.8h3.2L12 3z"/><path d="M10.4 12.5L12 8.6l1.6 3.9h-3.2z"/><ellipse cx="12" cy="13.5" rx="9.5" ry="3.6" transform="rotate(-18 12 13.5)"/></svg>`
  );
}

function getAppIconName(processName = "", title = "", customIcon = "") {
  if (customIcon) return customIcon;
  const prof = matchAppProfile(processName, title);
  if (prof) return prof.icon;

  const p = (processName || "").toLowerCase();
  const t = (title || "").toLowerCase();

  if (p.includes("telegram") || p.includes("discord") || p.includes("slack")) {
    return "message-square";
  }
  if (p.includes("chrome") || p.includes("firefox") || p.includes("brave") || p.includes("arc")) {
    return "globe";
  }
  if (p.includes("terminal") || p.includes("powershell") || p.includes("cmd") || p.includes("wt") || p.includes("wezterm")) {
    return "terminal";
  }
  if (p.includes("code") || p.includes("cursor") || p.includes("devenv") || p.includes("idea")) {
    return "code";
  }
  if (p.includes("music") || p.includes("spotify") || p.includes("foobar") || p.includes("qqmusic") || p.includes("cloudmusic")) {
    return "music";
  }
  if (p.includes("potplayer") || p.includes("vlc") || p.includes("mpv")) {
    return "play-circle";
  }
  if (p.includes("explorer")) {
    return "folder";
  }
  return "app-window";
}

const DEFAULT_SETTINGS = {
  defaultMode: "overlay",
  defaultBorderless: false,
  defaultOpacity: 100,
  enableDragToDock: true,
  autoReconnectByProcess: true,
  showMainRibbonIcon: true,
  pinnedApps: []
};

class Win32Bridge {
  constructor(pluginDir) {
    this.pluginDir = pluginDir;
    this.proc = null;
    this.reqId = 0;
    this.pending = new Map();
    this.eventListeners = new Set();
    this.buffer = "";
    this.obsidianHwnd = "0";
  }

  async start() {
    const exePath = path.join(this.pluginDir, "Win32Helper.exe");
    const csPath = path.join(this.pluginDir, "Win32Helper.cs");

    if (!fs.existsSync(csPath) && typeof EMBEDDED_WIN32_HELPER_CS === "string" && EMBEDDED_WIN32_HELPER_CS.length > 0) {
      try {
        fs.mkdirSync(this.pluginDir, { recursive: true });
        fs.writeFileSync(csPath, EMBEDDED_WIN32_HELPER_CS, "utf8");
      } catch (e) {
        console.warn("[WindowDocker] Failed to write embedded Win32Helper.cs:", e);
      }
    }

    let needCompile = !fs.existsSync(exePath);
    if (!needCompile && fs.existsSync(csPath)) {
      try {
        const exeStat = fs.statSync(exePath);
        const csStat = fs.statSync(csPath);
        if (csStat.mtimeMs > exeStat.mtimeMs + 1000) {
          needCompile = true;
        }
      } catch (e) {}
    }

    if (needCompile) {
      const cscCandidates = [
        "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe",
        "C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe"
      ];
      const cscPath = cscCandidates.find((p) => fs.existsSync(p));
      if (cscPath && fs.existsSync(csPath)) {
        try {
          execFileSync(
            cscPath,
            [
              "/nologo",
              "/nowarn:1668",
              "/optimize+",
              "/target:exe",
              `/out:${exePath}`,
              csPath
            ],
            { windowsHide: true }
          );
        } catch (err) {
          if (!fs.existsSync(exePath)) {
            console.error("[WindowDocker] Failed to compile Win32Helper.cs:", err);
            throw new Error("无法编译 Win32Helper.exe，请检查系统 .NET Framework。");
          }
        }
      } else if (!fs.existsSync(exePath)) {
        throw new Error("找不到 Win32Helper.exe 文件，请确认插件目录完整。");
      }
    }

    this.proc = spawn(exePath, [], {
      cwd: this.pluginDir,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });

    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk) => {
      this.buffer += chunk;
      let idx;
      while ((idx = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (line) {
          this.handleLine(line);
        }
      }
    });

    this.proc.stderr.setEncoding("utf8");
    this.proc.stderr.on("data", (errChunk) => {
      console.warn("[WindowDocker Helper]", errChunk);
    });

    this.proc.on("exit", () => {
      for (const [, p] of this.pending) {
        p.reject(new Error("Win32Helper exited"));
      }
      this.pending.clear();
    });

    await this.resolveObsidianHwnd();
  }

  handleLine(line) {
    try {
      const msg = JSON.parse(line);
      if (msg.event) {
        for (const cb of this.eventListeners) {
          try {
            cb(msg);
          } catch (e) {
            console.error(e);
          }
        }
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        resolve(msg);
      }
    } catch (e) {
      console.warn("[WindowDocker] Failed to parse line:", line);
    }
  }

  onEvent(cb) {
    this.eventListeners.add(cb);
    return () => this.eventListeners.delete(cb);
  }

  send(cmd, params = {}) {
    if (!this.proc || this.proc.killed) {
      return Promise.reject(new Error("Win32Helper 未运行"));
    }
    const id = String(++this.reqId);
    const payload = JSON.stringify({ id, cmd, ...params }) + "\n";
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Win32Helper 命令超时: ${cmd}`));
        }
      }, cmd === "pick_window" ? 120000 : 8000);

      this.pending.set(id, {
        resolve: (res) => {
          clearTimeout(timer);
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        }
      });

      this.proc.stdin.write(payload, "utf8");
    });
  }

  async resolveObsidianHwnd() {
    try {
      const res = await this.send("find_obsidian", {
        pid: process.pid,
        ppid: process.ppid || 0,
        title: document.title || "Obsidian"
      });
      if (res && res.hwnd && res.hwnd !== "0") {
        this.obsidianHwnd = String(res.hwnd);
      }
    } catch (e) {
      console.warn("[WindowDocker] resolveObsidianHwnd error:", e);
    }
    return this.obsidianHwnd;
  }

  async stop() {
    if (!this.proc) return;
    try {
      await this.send("undock_all");
    } catch (e) {}
    try {
      this.proc.kill();
    } catch (e) {}
    this.proc = null;
  }
}

let viewInstanceCounter = 0;

class WindowDockerView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.viewId = `view_${++viewInstanceCounter}`;
    this.dockedHwnd = null;
    this.dockedTitle = "";
    this.dockedProcess = "";
    this.mode = plugin.settings.defaultMode;
    this.borderless = plugin.settings.defaultBorderless;
    this.opacity = plugin.settings.defaultOpacity;
    this.isPicking = false;
    this.isMinimizedByUser = false;
    this.resizeObserver = null;
    this.unsubscribeBridge = null;
    this.lastRectKey = "";
    this.lastDragKey = "";
  }

  getViewType() {
    return VIEW_TYPE_WINDOW_DOCKER;
  }

  getDisplayText() {
    if (this.dockedTitle) {
      return this.dockedTitle;
    }
    if (this.dockedProcess) {
      return this.dockedProcess;
    }
    return "外部窗口";
  }

  getIcon() {
    if (this.dockedProcess || this.dockedTitle) {
      return getAppIconName(this.dockedProcess, this.dockedTitle);
    }
    return "app-window";
  }

  async onOpen() {
    const contentEl = this.contentEl;
    contentEl.empty();
    contentEl.addClass("window-docker-view");

    this.pinActionEl = this.addAction("pin", "添加到左侧功能区", () => {
      if (!this.dockedProcess && !this.dockedTitle) {
        new Notice("请先在此标签页固定一个外部窗口");
        return;
      }
      this.plugin.togglePinAppToRibbon({
        appKey: getAppKey(this.dockedProcess, this.dockedTitle),
        processName: this.dockedProcess,
        label: getFriendlyAppLabel(this.dockedProcess, this.dockedTitle),
        location: this.isInSidebar() ? "right" : "tab"
      });
      this.updateHeaderActionsState();
    });

    this.optionsActionEl = this.addAction("sliders-horizontal", "窗口挂载选项", (evt) => {
      const menu = new Menu();
      this.populateWindowOptionsMenu(menu);
      menu.showAtMouseEvent(evt);
    });

    this.undockActionEl = this.addAction("log-out", "释放还原窗口至桌面", () => {
      if (this.dockedHwnd) {
        this.undockCurrentWindow(true);
      }
    });

    this.viewportEl = contentEl.createDiv({ cls: "window-docker-viewport" });
    this.updateHeaderActionsState();
    await this.renderViewportContent();

    this.resizeObserver = new ResizeObserver(() => {
      this.syncWindowRect();
      this.syncDragZoneRect();
    });
    this.resizeObserver.observe(this.viewportEl);

    this.unsubscribeBridge = this.plugin.bridge.onEvent((evt) => {
      this.handleBridgeEvent(evt);
    });

    this.registerInterval(
      window.setInterval(() => {
        this.syncWindowRect();
        this.syncDragZoneRect();
      }, 150)
    );
  }

  isInSidebar() {
    const root = this.leaf.getRoot();
    return root === this.app.workspace.leftSplit || root === this.app.workspace.rightSplit;
  }

  updateHeaderActionsState() {
    const hasWindow = !!this.dockedHwnd;
    if (this.pinActionEl) {
      const isPinned =
        hasWindow && this.plugin.isAppPinned(this.dockedProcess, this.dockedTitle);
      this.pinActionEl.style.display = hasWindow ? "" : "none";
      this.pinActionEl.toggleClass("is-active", !!isPinned);
      this.pinActionEl.setAttr(
        "aria-label",
        isPinned ? "已固定在左侧功能区（点击取消）" : "将该应用添加到左侧功能区"
      );
    }
    if (this.undockActionEl) {
      this.undockActionEl.style.display = hasWindow ? "" : "none";
    }
  }

  onPaneMenu(menu, source) {
    super.onPaneMenu(menu, source);
    this.populateWindowOptionsMenu(menu);
  }

  populateWindowOptionsMenu(menu) {
    if (this.dockedHwnd) {
      const isPinned = this.plugin.isAppPinned(this.dockedProcess, this.dockedTitle);
      const friendlyName = getFriendlyAppLabel(this.dockedProcess, this.dockedTitle);
      menu.addItem((item) => {
        item
          .setTitle(
            isPinned
              ? `从左侧功能区移除「${friendlyName}」图标`
              : `将「${friendlyName}」添加到左侧功能区`
          )
          .setIcon("pin")
          .onClick(async () => {
            await this.plugin.togglePinAppToRibbon({
              appKey: getAppKey(this.dockedProcess, this.dockedTitle),
              processName: this.dockedProcess,
              label: friendlyName,
              location: this.isInSidebar() ? "right" : "tab"
            });
            this.updateHeaderActionsState();
          });
      });

      menu.addSeparator();

      menu.addItem((item) => {
        item
          .setTitle("贴合模式 (推荐：兼容微信/自绘窗口)")
          .setChecked(this.mode === "overlay")
          .onClick(async () => {
            this.mode = "overlay";
            await this.applyStyleChanges();
          });
      });

      menu.addItem((item) => {
        item
          .setTitle("父子内嵌模式 (SetParent 传统窗口)")
          .setChecked(this.mode === "child")
          .onClick(async () => {
            this.mode = "child";
            await this.applyStyleChanges();
          });
      });

      menu.addItem((item) => {
        item
          .setTitle("隐藏外部窗口自带边框")
          .setChecked(this.borderless)
          .onClick(async () => {
            this.borderless = !this.borderless;
            await this.applyStyleChanges();
          });
      });

      menu.addSeparator();

      for (const lvl of [100, 90, 80, 65]) {
        menu.addItem((item) => {
          item
            .setTitle(`窗口透明度: ${lvl}%`)
            .setChecked(this.opacity === lvl)
            .onClick(async () => {
              this.opacity = lvl;
              await this.applyStyleChanges();
            });
        });
      }

      menu.addSeparator();

      menu.addItem((item) => {
        item
          .setTitle("重新对齐窗口尺寸")
          .setIcon("refresh-cw")
          .onClick(() => {
            this.lastRectKey = "";
            this.syncWindowRect(true);
          });
      });

      if (!this.isInSidebar()) {
        menu.addItem((item) => {
          item
            .setTitle("移至右侧边栏")
            .setIcon("panel-right")
            .onClick(() => {
              this.plugin.moveViewToRightSidebar(this);
            });
        });
      }

      menu.addItem((item) => {
        item
          .setTitle("释放还原窗口至桌面")
          .setIcon("log-out")
          .onClick(() => {
            this.undockCurrentWindow(true);
          });
      });
    } else {
      menu.addItem((item) => {
        item
          .setTitle("准星点击捕获外部窗口")
          .setIcon("crosshair")
          .onClick(() => {
            this.startCrosshairPick();
          });
      });
    }
  }

  async onClose() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.unsubscribeBridge) {
      this.unsubscribeBridge();
      this.unsubscribeBridge = null;
    }
    if (this.isPicking) {
      try {
        await this.plugin.bridge.send("cancel_pick");
      } catch (e) {}
      this.isPicking = false;
    }
    await this.disableDragZone();
    if (this.dockedHwnd) {
      await this.undockCurrentWindow(false);
    }
    this.plugin.scheduleOverlaySync();
  }

  getState() {
    return {
      dockedTitle: this.dockedTitle,
      dockedProcess: this.dockedProcess,
      mode: this.mode,
      borderless: this.borderless,
      opacity: this.opacity
    };
  }

  async setState(state, result) {
    if (state) {
      if (state.mode) this.mode = state.mode;
      if (typeof state.borderless === "boolean") this.borderless = state.borderless;
      if (typeof state.opacity === "number") this.opacity = state.opacity;
      if (state.dockedProcess && !this.dockedHwnd && this.plugin.settings.autoReconnectByProcess) {
        this.dockedProcess = state.dockedProcess;
        this.dockedTitle = state.dockedTitle || "";
        setTimeout(() => this.tryAutoReconnect(state.dockedProcess, state.dockedTitle), 350);
      }
    }
    this.updateHeaderActionsState();
    await super.setState(state, result);
  }

  async tryAutoReconnect(processName, titleHint) {
    if (!processName || this.dockedHwnd || !this.plugin.bridge) return;

    const targetAppKey = getAppKey(processName, titleHint);
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WINDOW_DOCKER);
    for (const leaf of leaves) {
      const v = leaf.view;
      if (
        v &&
        v !== this &&
        v.dockedHwnd &&
        getAppKey(v.dockedProcess, v.dockedTitle) === targetAppKey
      ) {
        this.dockedProcess = "";
        this.dockedTitle = "";
        this.leaf.updateHeader();
        return;
      }
    }

    try {
      const match = await this.plugin.findAvailableWindowByProcess(
        processName,
        titleHint,
        targetAppKey
      );
      if (match) {
        await this.dockWindow(match.hwnd, match.title, match.processName);
      }
    } catch (e) {}
  }

  handleBridgeEvent(evt) {
    if (evt.event === "window_closed" && String(evt.hwnd) === String(this.dockedHwnd)) {
      this.dockedHwnd = null;
      this.isMinimizedByUser = false;
      this.lastRectKey = "";
      this.updateHeaderActionsState();
      this.renderViewportContent();
      this.leaf.updateHeader();
      this.plugin.scheduleOverlaySync();
    } else if (evt.event === "window_minimized" && String(evt.hwnd) === String(this.dockedHwnd)) {
      this.isMinimizedByUser = true;
      this.lastRectKey = "";
      this.renderViewportContent();
      this.plugin.scheduleOverlaySync();
    } else if (evt.event === "pick_hover" && this.isPicking) {
      if (this.subDescEl) {
        this.subDescEl.setText(
          `当前指向: ${evt.title || "未命名窗口"} (${evt.processName}) — 单击左键固定，按 ESC 取消`
        );
      }
    } else if (evt.event === "drag_hover" && !this.dockedHwnd) {
      const isMine = evt.viewId === this.viewId && evt.inside;
      if (this.containerCardEl) {
        this.containerCardEl.toggleClass("is-catching", !!isMine);
      }
      if (this.subDescEl) {
        this.subDescEl.setText(
          isMine
            ? `松开鼠标即可固定「${evt.title || "当前窗口"}」`
            : "可直接将桌面窗口拖入此区域松开，或从下方列表选择"
        );
      }
    } else if (evt.event === "drag_dropped" && evt.viewId === this.viewId && !this.dockedHwnd) {
      if (this.isViewportVisible()) {
        this.dockWindow(evt.hwnd, evt.title, evt.processName);
      }
    }
  }

  async renderViewportContent() {
    if (!this.viewportEl) return;
    this.viewportEl.empty();

    if (this.dockedHwnd) {
      if (this.isMinimizedByUser) {
        this.viewportEl.removeClass("is-docked");
        const minCard = this.viewportEl.createDiv({ cls: "window-docker-minimized-card" });
        const iconWrap = minCard.createDiv({ cls: "window-docker-window-item-icon" });
        setIcon(iconWrap, getAppIconName(this.dockedProcess, this.dockedTitle));
        minCard.createDiv({
          cls: "window-docker-minimized-title",
          text: `${this.dockedTitle || this.dockedProcess} 已最小化收起`
        });
        minCard.createDiv({
          cls: "window-docker-minimized-desc",
          text: "点击此处或左侧功能区图标即可恢复显示"
        });
        const restoreBtn = minCard.createEl("button", {
          cls: "window-docker-btn is-primary",
          text: "恢复窗口显示"
        });
        minCard.addEventListener("click", () => {
          this.restoreFromMinimized();
        });
        restoreBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.restoreFromMinimized();
        });
      } else {
        this.viewportEl.addClass("is-docked");
      }
      return;
    }

    this.viewportEl.removeClass("is-docked");

    const container = this.viewportEl.createDiv({ cls: "window-docker-container" });
    this.containerCardEl = container;

    const header = container.createDiv({ cls: "window-docker-header" });
    const headerText = header.createDiv();
    headerText.createEl("h4", {
      cls: "window-docker-header-title",
      text: "固定外部窗口"
    });
    this.subDescEl = headerText.createEl("p", {
      cls: "window-docker-header-desc",
      text: "可直接将桌面窗口拖入此区域松开，或从下方列表选择"
    });

    const actionsBar = container.createDiv({ cls: "window-docker-actions-bar" });

    const pickBtn = actionsBar.createEl("button", {
      cls: "window-docker-btn is-primary"
    });
    const pickIcon = pickBtn.createSpan({ cls: "window-docker-btn-icon" });
    setIcon(pickIcon, "crosshair");
    pickBtn.createSpan({ text: this.isPicking ? "取消捕获 (ESC)" : "准星点击捕获" });
    pickBtn.addEventListener("click", () => {
      if (this.isPicking) {
        this.cancelCrosshairPick();
      } else {
        this.startCrosshairPick();
      }
    });

    if (!this.isInSidebar()) {
      const sideBtn = actionsBar.createEl("button", {
        cls: "window-docker-btn"
      });
      const sideIcon = sideBtn.createSpan({ cls: "window-docker-btn-icon" });
      setIcon(sideIcon, "panel-right");
      sideBtn.createSpan({ text: "移至右侧边栏" });
      sideBtn.addEventListener("click", () => {
        this.plugin.moveViewToRightSidebar(this);
      });
    }

    const presetsSection = container.createDiv({ cls: "window-docker-presets-section" });
    presetsSection.createDiv({
      cls: "window-docker-presets-label",
      text: "常用软件快捷入口（点击直接固定，右侧图钉可常驻左侧功能区）"
    });
    const presetsBar = presetsSection.createDiv({ cls: "window-docker-presets-bar" });

    const listSection = container.createDiv({ cls: "window-docker-list-section" });
    const listToolbar = listSection.createDiv({ cls: "window-docker-list-toolbar" });

    const searchInput = listToolbar.createEl("input", {
      cls: "window-docker-search-input",
      type: "text",
      placeholder: "搜索运行中的窗口 (如: 微信 / FlClash / Edge / ChatGPT / Antigravity)..."
    });

    const refreshBtn = listToolbar.createEl("button", {
      cls: "window-docker-icon-btn",
      attr: { "aria-label": "刷新窗口列表" }
    });
    setIcon(refreshBtn, "refresh-cw");

    const listContainer = listSection.createDiv({ cls: "window-docker-window-items" });

    let cachedWindows = [];

    const renderPresetChips = () => {
      presetsBar.empty();
      const featuredKeys = ["wechat", "flclash", "edge", "chatgpt", "antigravity"];
      for (const key of featuredKeys) {
        const prof = APP_PROFILES.find((p) => p.key === key);
        if (!prof) continue;

        const runningWin = cachedWindows.find((w) =>
          prof.match((w.processName || "").toLowerCase(), (w.title || "").toLowerCase())
        );
        const isPinned = this.plugin.isAppKeyPinned(prof.key);

        const chip = presetsBar.createDiv({
          cls: "window-docker-preset-chip" + (runningWin ? " is-running" : "")
        });
        chip.setAttr(
          "aria-label",
          runningWin
            ? `点击直接固定「${prof.label}」(${runningWin.title})`
            : `「${prof.label}」当前未在后台检测到运行窗口，可点击右侧图钉先固定到左侧功能区`
        );

        const chipIcon = chip.createSpan({ cls: "window-docker-preset-chip-icon" });
        setIcon(chipIcon, prof.icon);
        chip.createSpan({ text: prof.label });

        const pinSpan = chip.createSpan({
          cls: "window-docker-preset-pin" + (isPinned ? " is-pinned" : ""),
          attr: {
            "aria-label": isPinned
              ? `从左侧功能区移除「${prof.label}」`
              : `将「${prof.label}」添加到左侧功能区`
          }
        });
        setIcon(pinSpan, "pin");

        pinSpan.addEventListener("click", async (e) => {
          e.stopPropagation();
          await this.plugin.togglePinAppToRibbon({
            appKey: prof.key,
            processName: runningWin ? runningWin.processName : prof.key,
            label: prof.label,
            icon: prof.icon,
            location: this.isInSidebar() ? "right" : "tab"
          });
          renderPresetChips();
          renderFilteredWindows(searchInput.value);
        });

        chip.addEventListener("click", () => {
          if (runningWin) {
            this.dockWindow(runningWin.hwnd, runningWin.title, runningWin.processName);
          } else {
            new Notice(`未检测到正在运行的「${prof.label}」窗口，请先打开该软件后重试`);
          }
        });
      }
    };

    const renderFilteredWindows = (query = "") => {
      listContainer.empty();
      const q = query.trim().toLowerCase();
      const filtered = cachedWindows.filter((w) => {
        if (!q) return true;
        const prof = matchAppProfile(w.processName, w.title);
        return (
          (w.title || "").toLowerCase().includes(q) ||
          (w.processName || "").toLowerCase().includes(q) ||
          (prof && (prof.label.toLowerCase().includes(q) || prof.key.includes(q)))
        );
      });

      if (filtered.length === 0) {
        listContainer.createDiv({
          cls: "window-docker-empty-hint",
          text: "未检测到匹配的桌面窗口"
        });
        return;
      }

      for (const w of filtered) {
        const row = listContainer.createDiv({ cls: "window-docker-window-item" });

        const mainArea = row.createDiv({ cls: "window-docker-window-item-main" });
        const iconEl = mainArea.createDiv({ cls: "window-docker-window-item-icon" });
        setIcon(iconEl, getAppIconName(w.processName, w.title));

        const info = mainArea.createDiv({ cls: "window-docker-window-item-info" });
        info.createDiv({
          cls: "window-docker-window-item-title",
          text: w.title
        });
        info.createDiv({
          cls: "window-docker-window-item-sub",
          text: w.processName
        });

        mainArea.addEventListener("click", () => {
          this.dockWindow(w.hwnd, w.title, w.processName);
        });

        const rowActions = row.createDiv({ cls: "window-docker-window-item-actions" });

        const isPinned = this.plugin.isAppPinned(w.processName, w.title);
        const friendlyLabel = getFriendlyAppLabel(w.processName, w.title);
        const pinBtn = rowActions.createEl("button", {
          cls: "window-docker-mini-btn" + (isPinned ? " is-pinned" : ""),
          text: isPinned ? "已在功能区" : "+ 功能区"
        });
        pinBtn.setAttr(
          "aria-label",
          isPinned
            ? `从左侧功能区移除「${friendlyLabel}」`
            : `将「${friendlyLabel}」单独添加到左侧功能区，点击即可快速打开`
        );
        pinBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          await this.plugin.togglePinAppToRibbon({
            appKey: getAppKey(w.processName, w.title),
            processName: w.processName,
            label: friendlyLabel,
            location: this.isInSidebar() ? "right" : "tab"
          });
          renderPresetChips();
          renderFilteredWindows(searchInput.value);
        });

        const dockBtn = rowActions.createEl("button", {
          cls: "window-docker-mini-btn",
          text: "固定"
        });
        dockBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.dockWindow(w.hwnd, w.title, w.processName);
        });
      }
    };

    const loadWindowList = async () => {
      try {
        await this.plugin.bridge.resolveObsidianHwnd();
        const res = await this.plugin.bridge.send("list_windows", {
          obsidianHwnd: String(this.plugin.bridge.obsidianHwnd)
        });
        cachedWindows = (res && res.windows) || [];
        cachedWindows.sort((a, b) => {
          const aPri = getWindowPriority(a.processName, a.title);
          const bPri = getWindowPriority(b.processName, b.title);
          return bPri - aPri;
        });
        renderPresetChips();
        renderFilteredWindows(searchInput.value);
      } catch (e) {
        renderPresetChips();
        listContainer.empty();
        listContainer.createDiv({
          cls: "window-docker-empty-hint",
          text: "获取窗口列表失败"
        });
      }
    };

    searchInput.addEventListener("input", () => {
      renderFilteredWindows(searchInput.value);
    });
    refreshBtn.addEventListener("click", () => {
      loadWindowList();
    });

    await loadWindowList();
    this.syncDragZoneRect();
  }

  async restoreFromMinimized() {
    if (!this.dockedHwnd) return;
    this.isMinimizedByUser = false;
    this.lastRectKey = "";
    await this.renderViewportContent();
    try {
      await this.plugin.bridge.send("restore_window", {
        hwnd: String(this.dockedHwnd)
      });
    } catch (e) {}
    await this.syncWindowRect(true);
    this.plugin.scheduleOverlaySync();
  }

  async startCrosshairPick() {
    if (this.isPicking) return;
    this.isPicking = true;
    await this.disableDragZone();
    await this.renderViewportContent();

    try {
      await this.plugin.bridge.resolveObsidianHwnd();
      const res = await this.plugin.bridge.send("pick_window", {
        obsidianHwnd: String(this.plugin.bridge.obsidianHwnd)
      });
      this.isPicking = false;
      if (res && res.ok && res.hwnd) {
        await this.dockWindow(res.hwnd, res.title, res.processName);
      } else {
        await this.renderViewportContent();
      }
    } catch (e) {
      this.isPicking = false;
      await this.renderViewportContent();
    }
  }

  async cancelCrosshairPick() {
    if (!this.isPicking) return;
    try {
      await this.plugin.bridge.send("cancel_pick");
    } catch (e) {}
    this.isPicking = false;
    await this.renderViewportContent();
  }

  async dockWindow(hwnd, title = "", processName = "") {
    if (!hwnd || String(hwnd) === "0") return;

    const existingView = this.plugin.findViewByHwnd(hwnd);
    if (existingView && existingView !== this) {
      this.app.workspace.revealLeaf(existingView.leaf);
      return;
    }

    if (this.dockedHwnd && String(this.dockedHwnd) !== String(hwnd)) {
      await this.undockCurrentWindow(false);
    }

    await this.disableDragZone();
    await this.plugin.bridge.resolveObsidianHwnd();

    this.dockedHwnd = String(hwnd);
    this.dockedTitle = title || "外部窗口";
    this.dockedProcess = processName || "";
    this.isMinimizedByUser = false;

    if (
      shouldPreferOverlayMode(this.dockedProcess, this.dockedTitle) &&
      this.mode === "child"
    ) {
      this.mode = "overlay";
    }

    this.updateHeaderActionsState();
    await this.renderViewportContent();
    this.leaf.updateHeader();
    this.app.workspace.requestSaveLayout();

    const geom = this.computePhysicalViewportRect();

    try {
      const res = await this.plugin.bridge.send("dock", {
        hwnd: String(this.dockedHwnd),
        obsidianHwnd: String(this.plugin.bridge.obsidianHwnd),
        mode: this.mode,
        borderless: this.borderless,
        opacity: this.opacity,
        x: geom.x,
        y: geom.y,
        width: Math.max(200, geom.width),
        height: Math.max(150, geom.height)
      });

      if (res && res.ok) {
        if (res.title) this.dockedTitle = res.title;
        if (res.processName) this.dockedProcess = res.processName;
        this.updateHeaderActionsState();
        this.leaf.updateHeader();
        this.lastRectKey = "";
        await this.syncWindowRect(true);
        this.plugin.scheduleOverlaySync();
      } else {
        this.dockedHwnd = null;
        this.updateHeaderActionsState();
        await this.renderViewportContent();
      }
    } catch (err) {
      console.error("[WindowDocker] dock error:", err);
      this.dockedHwnd = null;
      this.updateHeaderActionsState();
      await this.renderViewportContent();
    }
  }

  async applyStyleChanges() {
    if (!this.dockedHwnd) return;
    try {
      await this.plugin.bridge.send("set_style", {
        hwnd: String(this.dockedHwnd),
        mode: this.mode,
        borderless: this.borderless,
        opacity: this.opacity
      });
      this.lastRectKey = "";
      await this.syncWindowRect(true);
      this.app.workspace.requestSaveLayout();
    } catch (e) {}
  }

  async undockCurrentWindow(showNotice = true) {
    if (!this.dockedHwnd) return;
    const oldHwnd = this.dockedHwnd;
    const oldTitle = this.dockedTitle;
    this.dockedHwnd = null;
    this.dockedTitle = "";
    this.dockedProcess = "";
    this.isMinimizedByUser = false;
    this.lastRectKey = "";

    try {
      await this.plugin.bridge.send("undock", { hwnd: String(oldHwnd) });
    } catch (e) {}

    this.updateHeaderActionsState();
    await this.renderViewportContent();
    this.leaf.updateHeader();
    this.app.workspace.requestSaveLayout();
    this.plugin.scheduleOverlaySync();

    if (showNotice) {
      new Notice(`已释放窗口: ${oldTitle}`);
    }
  }

  isViewportVisible() {
    if (!this.viewportEl || !this.viewportEl.isConnected) return false;
    if (this.containerEl && this.containerEl.style.display === "none") return false;
    const rect = this.viewportEl.getBoundingClientRect();
    if (rect.width < 30 || rect.height < 30) return false;
    return true;
  }

  computePhysicalViewportRect() {
    if (!this.viewportEl) {
      return { x: 0, y: 0, width: 0, height: 0, visible: false };
    }
    const rect = this.viewportEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const visible = this.isViewportVisible() && !this.isMinimizedByUser;

    return {
      x: Math.round(rect.left * dpr),
      y: Math.round(rect.top * dpr),
      width: Math.max(0, Math.round(rect.width * dpr)),
      height: Math.max(0, Math.round(rect.height * dpr)),
      visible
    };
  }

  async syncWindowRect(force = false) {
    if (!this.dockedHwnd || !this.plugin.bridge || this.isMinimizedByUser) return;
    const geom = this.computePhysicalViewportRect();
    const key = `${geom.x},${geom.y},${geom.width},${geom.height},${geom.visible}`;
    if (!force && key === this.lastRectKey) return;
    this.lastRectKey = key;

    try {
      await this.plugin.bridge.send("update_rect", {
        hwnd: String(this.dockedHwnd),
        x: geom.x,
        y: geom.y,
        width: geom.width,
        height: geom.height,
        visible: geom.visible,
        restore: force
      });
    } catch (e) {}
  }

  async syncDragZoneRect() {
    if (this.dockedHwnd || !this.plugin.settings.enableDragToDock || !this.plugin.bridge) return;
    const geom = this.computePhysicalViewportRect();
    if (!geom.visible) {
      await this.disableDragZone();
      return;
    }
    const key = `drag:${this.viewId}:${geom.x},${geom.y},${geom.width},${geom.height}`;
    if (this.lastDragKey === key) return;
    this.lastDragKey = key;

    try {
      await this.plugin.bridge.send("set_drag_zone", {
        viewId: this.viewId,
        enabled: true,
        obsidianHwnd: String(this.plugin.bridge.obsidianHwnd),
        x: geom.x,
        y: geom.y,
        width: geom.width,
        height: geom.height
      });
    } catch (e) {}
  }

  async disableDragZone() {
    if (!this.lastDragKey) return;
    this.lastDragKey = "";
    if (!this.plugin.bridge) return;
    try {
      await this.plugin.bridge.send("set_drag_zone", {
        viewId: this.viewId,
        enabled: false,
        obsidianHwnd: "0",
        x: 0,
        y: 0,
        width: 0,
        height: 0
      });
    } catch (e) {}
  }
}

class WindowDockerSettingTab extends require("obsidian").PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("在左侧功能区显示通用「新建窗口容器」图标")
      .setDesc("若你已将常用应用（如微信等）单独固定到了左侧功能区，可关闭此通用入口图标以保持功能区整洁。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showMainRibbonIcon).onChange(async (val) => {
          this.plugin.settings.showMainRibbonIcon = val;
          await this.plugin.saveSettings();
          this.plugin.refreshRibbonIcons();
        })
      );

    new Setting(containerEl)
      .setName("默认挂载模式")
      .setDesc("贴合模式兼容微信、浏览器等自绘无边框窗口；父子内嵌模式使用 Win32 SetParent。")
      .addDropdown((dd) =>
        dd
          .addOption("overlay", "贴合模式 (推荐，兼容微信)")
          .addOption("child", "父子内嵌模式 (SetParent)")
          .setValue(this.plugin.settings.defaultMode)
          .onChange(async (val) => {
            this.plugin.settings.defaultMode = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("支持直接拖拽外部窗口进入空白标签页吸附")
      .setDesc("打开空白容器标签页时，用鼠标拖动外部窗口进入该区域松开即可自动固定。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableDragToDock).onChange(async (val) => {
          this.plugin.settings.enableDragToDock = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName("常用软件快捷入口 (左侧功能区)").setHeading();

    const featuredKeys = ["wechat", "flclash", "edge", "chatgpt", "antigravity"];
    for (const key of featuredKeys) {
      const prof = APP_PROFILES.find((p) => p.key === key);
      if (!prof) continue;
      const isPinned = this.plugin.isAppKeyPinned(prof.key);
      new Setting(containerEl)
        .setName(prof.label)
        .setDesc(`在左侧功能区 (Ribbon) 显示独立的「${prof.label}」专属图标`)
        .addToggle((toggle) =>
          toggle.setValue(isPinned).onChange(async (val) => {
            if (val && !this.plugin.isAppKeyPinned(prof.key)) {
              await this.plugin.togglePinAppToRibbon({
                appKey: prof.key,
                processName: prof.key,
                label: prof.label,
                icon: prof.icon,
                location: "tab"
              });
            } else if (!val && this.plugin.isAppKeyPinned(prof.key)) {
              await this.plugin.removePinnedApp(prof.key);
            }
            this.display();
          })
        );
    }

    new Setting(containerEl).setName("已添加到左侧功能区 (Ribbon) 的独立应用").setHeading();

    if (!this.plugin.settings.pinnedApps || this.plugin.settings.pinnedApps.length === 0) {
      containerEl.createEl("p", {
        cls: "setting-item-description",
        text: "暂未添加独立应用。你可以在上方直接开启常用软件，或在窗口列表中点击「+ 功能区」将任意应用单独放到左侧功能区。"
      });
    } else {
      for (const appItem of this.plugin.settings.pinnedApps) {
        const itemKey = getAppKey(appItem.processName, appItem.label, appItem.appKey);
        new Setting(containerEl)
          .setName(
            appItem.processName && appItem.processName.toLowerCase() !== appItem.label.toLowerCase()
              ? `${appItem.label} (${appItem.processName})`
              : appItem.label
          )
          .setDesc("点击左侧功能区图标时的默认打开位置")
          .addDropdown((dd) =>
            dd
              .addOption("tab", "主工作区标签页")
              .addOption("right", "右侧边栏")
              .setValue(appItem.location || "tab")
              .onChange(async (val) => {
                appItem.location = val;
                await this.plugin.saveSettings();
              })
          )
          .addExtraButton((btn) =>
            btn
              .setIcon("trash")
              .setTooltip("从左侧功能区移除")
              .onClick(async () => {
                await this.plugin.removePinnedApp(itemKey);
                this.display();
              })
          );
      }
    }
  }
}

module.exports = class WindowDockerPlugin extends Plugin {
  async onload() {
    registerCustomIcons();
    await this.loadSettings();

    this.mainRibbonEl = null;
    this.pinnedRibbonEls = new Map();
    this.domOverlayObserver = null;
    this.overlayRafId = null;
    this.lastOverlaySyncKey = "";

    const adapter = this.app.vault.adapter;
    const basePath = adapter.getBasePath ? adapter.getBasePath() : "";
    const pluginDir = path.join(basePath, this.manifest.dir);

    this.bridge = new Win32Bridge(pluginDir);
    try {
      await this.bridge.start();
    } catch (err) {
      console.error("[WindowDocker] Bridge start failed:", err);
      new Notice(`Window Docker 启动失败: ${err.message}`);
    }

    this.registerView(VIEW_TYPE_WINDOW_DOCKER, (leaf) => new WindowDockerView(leaf, this));

    this.refreshRibbonIcons();
    this.setupDomOverlayObserver();

    this.addCommand({
      id: "open-window-docker-tab",
      name: "新建外部窗口容器标签页",
      callback: async () => {
        await this.openNewWindowDockerLeaf(false);
      }
    });

    this.addCommand({
      id: "open-window-docker-right-sidebar",
      name: "在右侧边栏新建外部窗口容器",
      callback: async () => {
        await this.openNewWindowDockerLeaf(true);
      }
    });

    this.addCommand({
      id: "undock-all-windows",
      name: "释放并还原所有已固定的外部窗口",
      callback: async () => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WINDOW_DOCKER);
        for (const leaf of leaves) {
          if (leaf.view && leaf.view.undockCurrentWindow) {
            await leaf.view.undockCurrentWindow(false);
          }
        }
        if (this.bridge) {
          await this.bridge.send("undock_all");
        }
        new Notice("已释放并还原所有固定的外部窗口");
      }
    });

    this.addSettingTab(new WindowDockerSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.syncAllViews();
      })
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.syncAllViews();
      })
    );
  }

  setupDomOverlayObserver() {
    this.domOverlayObserver = new MutationObserver(() => {
      this.scheduleOverlaySync();
    });

    if (document.body) {
      this.domOverlayObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"]
      });
    }

    this.registerInterval(
      window.setInterval(() => {
        this.syncOverlaysToBridge();
      }, 150)
    );
  }

  scheduleOverlaySync() {
    this.syncOverlaysToBridge();
    if (this.overlayRafId !== null) return;

    const tick = () => {
      const hasAny = this.syncOverlaysToBridge();
      if (hasAny) {
        this.overlayRafId = window.requestAnimationFrame(tick);
      } else {
        this.overlayRafId = null;
      }
    };
    this.overlayRafId = window.requestAnimationFrame(tick);
  }

  syncOverlaysToBridge() {
    if (!this.bridge || !this.bridge.obsidianHwnd || this.bridge.obsidianHwnd === "0") {
      return false;
    }

    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WINDOW_DOCKER);
    const dockedViewports = [];
    for (const leaf of leaves) {
      const v = leaf.view;
      if (v && v.dockedHwnd && !v.isMinimizedByUser && v.isViewportVisible()) {
        dockedViewports.push(v.viewportEl.getBoundingClientRect());
      }
    }

    if (dockedViewports.length === 0) {
      if (this.lastOverlaySyncKey !== "false|") {
        this.lastOverlaySyncKey = "false|";
        this.bridge
          .send("sync_overlays", {
            obsidianHwnd: String(this.bridge.obsidianHwnd),
            interactive: false,
            rects: ""
          })
          .catch(() => {});
      }
      return false;
    }

    const dpr = window.devicePixelRatio || 1;
    const candidates = document.querySelectorAll(
      ".tooltip, .menu, .modal, .prompt, .popover, .suggestion-container, .notice"
    );

    const rectItems = [];
    let interactive = false;
    let anyCandidateAlive = false;

    const modalContainer = document.querySelector(".modal-container");
    if (modalContainer && modalContainer.isConnected) {
      const mcStyle = window.getComputedStyle(modalContainer);
      if (mcStyle.display !== "none" && mcStyle.visibility !== "hidden") {
        interactive = true;
        anyCandidateAlive = true;
      }
    }

    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      if (!el.isConnected) continue;
      const st = window.getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity) < 0.05) {
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.width <= 4 || r.height <= 4) continue;
      anyCandidateAlive = true;

      const isTooltipOrNotice =
        el.classList.contains("tooltip") || el.classList.contains("notice");
      if (!isTooltipOrNotice) {
        interactive = true;
      }

      let overlaps = false;
      for (const vp of dockedViewports) {
        if (
          r.right > vp.left - 8 &&
          r.left < vp.right + 8 &&
          r.bottom > vp.top - 8 &&
          r.top < vp.bottom + 8
        ) {
          overlaps = true;
          break;
        }
      }

      if (overlaps && rectItems.length < 4) {
        const x = Math.max(0, Math.round(r.left * dpr));
        const y = Math.max(0, Math.round(r.top * dpr));
        const w = Math.max(1, Math.round(r.width * dpr));
        const h = Math.max(1, Math.round(r.height * dpr));
        const cornerPref = el.classList.contains("tooltip") ? 3 : 2;
        rectItems.push(`${x},${y},${w},${h},${cornerPref}`);
      }
    }

    const rectsStr = rectItems.join(";");
    const syncKey = `${interactive}|${rectsStr}`;

    if (syncKey !== this.lastOverlaySyncKey) {
      this.lastOverlaySyncKey = syncKey;
      this.bridge
        .send("sync_overlays", {
          obsidianHwnd: String(this.bridge.obsidianHwnd),
          interactive,
          rects: rectsStr
        })
        .catch(() => {});
    }

    return anyCandidateAlive;
  }

  refreshRibbonIcons() {
    if (this.mainRibbonEl) {
      this.mainRibbonEl.remove();
      this.mainRibbonEl = null;
    }
    if (this.settings.showMainRibbonIcon) {
      this.mainRibbonEl = this.addRibbonIcon("app-window", "新建外部窗口容器", async () => {
        await this.openNewWindowDockerLeaf(false);
      });
    }

    for (const [, el] of this.pinnedRibbonEls) {
      el.remove();
    }
    this.pinnedRibbonEls.clear();

    if (!Array.isArray(this.settings.pinnedApps)) return;

    for (const appCfg of this.settings.pinnedApps) {
      const cfgKey = getAppKey(appCfg.processName, appCfg.label, appCfg.appKey);
      const iconName = getAppIconName(appCfg.processName, appCfg.label, appCfg.icon);
      const ribbonEl = this.addRibbonIcon(
        iconName,
        `${appCfg.label} (左键打开/切换显示，右键选项)`,
        async () => {
          await this.activateOrTogglePinnedApp(appCfg);
        }
      );

      ribbonEl.addEventListener("contextmenu", (evt) => {
        evt.preventDefault();
        const menu = new Menu();
        menu.addItem((item) =>
          item
            .setTitle(`在主标签页打开「${appCfg.label}」`)
            .setIcon("layout")
            .onClick(async () => {
              appCfg.location = "tab";
              await this.saveSettings();
              await this.activateOrTogglePinnedApp(appCfg, "tab");
            })
        );
        menu.addItem((item) =>
          item
            .setTitle(`在右侧边栏打开「${appCfg.label}」`)
            .setIcon("panel-right")
            .onClick(async () => {
              appCfg.location = "right";
              await this.saveSettings();
              await this.activateOrTogglePinnedApp(appCfg, "right");
            })
        );
        menu.addSeparator();
        menu.addItem((item) =>
          item
            .setTitle(`从左侧功能区移除「${appCfg.label}」`)
            .setIcon("trash")
            .onClick(async () => {
              await this.removePinnedApp(cfgKey);
            })
        );
        menu.showAtMouseEvent(evt);
      });

      this.pinnedRibbonEls.set(cfgKey, ribbonEl);
    }
  }

  isAppKeyPinned(appKey) {
    if (!appKey || !Array.isArray(this.settings.pinnedApps)) return false;
    const key = appKey.toLowerCase();
    return this.settings.pinnedApps.some(
      (a) => getAppKey(a.processName, a.label, a.appKey) === key
    );
  }

  isAppPinned(processName, title = "") {
    if (!processName && !title) return false;
    return this.isAppKeyPinned(getAppKey(processName, title));
  }

  isProcessPinned(processName) {
    return this.isAppPinned(processName, "");
  }

  async togglePinAppToRibbon({ appKey = "", processName, label, icon = "", location = "tab" }) {
    const resolvedKey = getAppKey(processName, label, appKey);
    if (!resolvedKey) return;
    const exists = this.isAppKeyPinned(resolvedKey);
    if (exists) {
      await this.removePinnedApp(resolvedKey);
    } else {
      const friendlyLabel = getFriendlyAppLabel(processName, label);
      this.settings.pinnedApps.push({
        appKey: resolvedKey,
        processName: processName || resolvedKey,
        label: friendlyLabel,
        location,
        icon: icon || getAppIconName(processName, friendlyLabel)
      });
      await this.saveSettings();
      this.refreshRibbonIcons();
      new Notice(`已将「${friendlyLabel}」添加到左侧功能区`);
    }
  }

  async removePinnedApp(keyOrProcessName) {
    if (!keyOrProcessName) return;
    const key = keyOrProcessName.toLowerCase();
    const target = this.settings.pinnedApps.find(
      (a) =>
        getAppKey(a.processName, a.label, a.appKey) === key ||
        (a.processName || "").toLowerCase() === key
    );
    this.settings.pinnedApps = this.settings.pinnedApps.filter(
      (a) =>
        getAppKey(a.processName, a.label, a.appKey) !== key &&
        (a.processName || "").toLowerCase() !== key
    );
    await this.saveSettings();
    this.refreshRibbonIcons();
    if (target) {
      new Notice(`已从左侧功能区移除「${target.label}」`);
    }
  }

  findViewByHwnd(hwnd) {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WINDOW_DOCKER);
    for (const leaf of leaves) {
      if (leaf.view && String(leaf.view.dockedHwnd) === String(hwnd)) {
        return leaf.view;
      }
    }
    return null;
  }

  findViewByApp(appCfgOrProcess, titleHint = "") {
    const targetKey =
      typeof appCfgOrProcess === "object" && appCfgOrProcess !== null
        ? getAppKey(appCfgOrProcess.processName, appCfgOrProcess.label, appCfgOrProcess.appKey)
        : getAppKey(appCfgOrProcess, titleHint);
    if (!targetKey) return null;

    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WINDOW_DOCKER);
    for (const leaf of leaves) {
      if (
        leaf.view &&
        leaf.view.dockedHwnd &&
        getAppKey(leaf.view.dockedProcess, leaf.view.dockedTitle) === targetKey
      ) {
        return leaf.view;
      }
    }
    return null;
  }

  findViewByProcess(processName) {
    return this.findViewByApp(processName, "");
  }

  async findAvailableWindowByProcess(processName, titleHint = "", explicitAppKey = "") {
    if ((!processName && !explicitAppKey) || !this.bridge) return null;
    await this.bridge.resolveObsidianHwnd();
    const res = await this.bridge.send("list_windows", {
      obsidianHwnd: String(this.bridge.obsidianHwnd)
    });
    const windows = (res && res.windows) || [];
    const targetKey = getAppKey(processName, titleHint, explicitAppKey);
    const prof = APP_PROFILES.find((p) => p.key === targetKey);

    let candidates = [];
    if (prof) {
      // Exact profile match (e.g. separates ChatGPT browser window from generic Edge window)
      candidates = windows.filter(
        (w) => getAppKey(w.processName, w.title) === prof.key
      );
      if (candidates.length === 0) {
        candidates = windows.filter((w) =>
          prof.match((w.processName || "").toLowerCase(), (w.title || "").toLowerCase())
        );
      }
    }

    if (candidates.length === 0 && processName) {
      const pKey = processName.toLowerCase();
      candidates = windows.filter((w) => (w.processName || "").toLowerCase() === pKey);
      if (candidates.length === 0) {
        candidates = windows.filter((w) => (w.processName || "").toLowerCase().includes(pKey));
      }
    }

    if (candidates.length === 0 && titleHint) {
      const tKey = titleHint.toLowerCase();
      candidates = windows.filter((w) => (w.title || "").toLowerCase().includes(tKey));
    }

    if (candidates.length === 0) return null;

    if (titleHint) {
      const exact = candidates.find((w) => w.title === titleHint);
      if (exact) return exact;
    }
    return candidates[0];
  }

  async activateOrTogglePinnedApp(appCfg, forceLocation = null) {
    const existingView = this.findViewByApp(appCfg);
    if (existingView) {
      if (existingView.isMinimizedByUser) {
        this.app.workspace.revealLeaf(existingView.leaf);
        await existingView.restoreFromMinimized();
        return;
      }
      this.app.workspace.revealLeaf(existingView.leaf);
      return;
    }

    const cfgKey = getAppKey(appCfg.processName, appCfg.label, appCfg.appKey);
    const targetWin = await this.findAvailableWindowByProcess(
      appCfg.processName,
      appCfg.label,
      cfgKey
    );
    if (!targetWin) {
      new Notice(`未检测到正在运行的「${appCfg.label}」窗口，请先在电脑上打开该应用`);
      return;
    }

    const inRight = (forceLocation || appCfg.location) === "right";
    let targetLeaf = null;
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WINDOW_DOCKER);
    for (const leaf of leaves) {
      if (leaf.view && !leaf.view.dockedHwnd) {
        const leafInSidebar = leaf.view.isInSidebar();
        if (inRight === leafInSidebar) {
          targetLeaf = leaf;
          break;
        }
      }
    }

    if (!targetLeaf) {
      targetLeaf = await this.openNewWindowDockerLeaf(inRight);
    } else {
      this.app.workspace.revealLeaf(targetLeaf);
    }

    if (targetLeaf && targetLeaf.view && targetLeaf.view.dockWindow) {
      await targetLeaf.view.dockWindow(targetWin.hwnd, targetWin.title, targetWin.processName);
    }
  }

  async openNewWindowDockerLeaf(inRightSidebar = false) {
    let leaf;
    if (inRightSidebar) {
      leaf = this.app.workspace.getRightLeaf(false);
    } else {
      leaf = this.app.workspace.getLeaf("tab");
    }
    if (!leaf) return null;

    await leaf.setViewState({
      type: VIEW_TYPE_WINDOW_DOCKER,
      active: true
    });
    this.app.workspace.revealLeaf(leaf);
    return leaf;
  }

  async moveViewToRightSidebar(view) {
    const state = view.getState();
    const hwnd = view.dockedHwnd;
    const title = view.dockedTitle;
    const proc = view.dockedProcess;

    view.dockedHwnd = null;
    view.leaf.detach();

    const rightLeaf = this.app.workspace.getRightLeaf(false);
    await rightLeaf.setViewState({
      type: VIEW_TYPE_WINDOW_DOCKER,
      active: true,
      state
    });
    this.app.workspace.revealLeaf(rightLeaf);

    if (hwnd && rightLeaf.view && rightLeaf.view.dockWindow) {
      setTimeout(() => {
        rightLeaf.view.dockWindow(hwnd, title, proc);
      }, 100);
    }
  }

  syncAllViews() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WINDOW_DOCKER);
    for (const leaf of leaves) {
      if (leaf.view && leaf.view.syncWindowRect) {
        leaf.view.syncWindowRect();
        leaf.view.syncDragZoneRect();
      }
    }
    this.scheduleOverlaySync();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!Array.isArray(this.settings.pinnedApps)) {
      this.settings.pinnedApps = [];
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async onunload() {
    if (this.overlayRafId !== null) {
      window.cancelAnimationFrame(this.overlayRafId);
      this.overlayRafId = null;
    }
    if (this.domOverlayObserver) {
      this.domOverlayObserver.disconnect();
      this.domOverlayObserver = null;
    }
    if (this.bridge) {
      await this.bridge.stop();
      this.bridge = null;
    }
  }
};


// Embedded C# source for auto-extracting Win32Helper.cs when installed via Obsidian Community Plugins
const EMBEDDED_WIN32_HELPER_CS = "using System;\nusing System.Collections.Generic;\nusing System.Diagnostics;\nusing System.IO;\nusing System.Runtime.InteropServices;\nusing System.Text;\nusing System.Threading;\n\nnamespace ObsidianWindowDocker\n{\n    public class DockedWindowState\n    {\n        public IntPtr Hwnd;\n        public IntPtr ObsidianHwnd;\n        public uint ProcessId;\n        public IntPtr OriginalParent;\n        public IntPtr OriginalOwner;\n        public int OriginalStyle;\n        public int OriginalExStyle;\n        public RECT OriginalRect;\n        public bool WasMaximized;\n        public string Mode; // \"overlay\" or \"child\"\n        public bool Borderless;\n        public int Opacity; // 20 - 100\n        public int RelX;\n        public int RelY;\n        public int Width;\n        public int Height;\n        public bool Visible;\n        public bool MinimizedByUser;\n        public bool InputPassthrough;\n    }\n\n    public class DragZoneInfo\n    {\n        public string ViewId;\n        public IntPtr ObsidianHwnd;\n        public int RelX;\n        public int RelY;\n        public int Width;\n        public int Height;\n    }\n\n    public class OverlayRectInfo\n    {\n        public int X;\n        public int Y;\n        public int Width;\n        public int Height;\n        public int CornerPref; // 2 = DWMWCP_ROUND (8px), 3 = DWMWCP_ROUNDSMALL (4px)\n    }\n\n    public class OverlayPopupSlot\n    {\n        public IntPtr Hwnd;\n        public IntPtr ThumbId;\n        public IntPtr SourceHwnd;\n        public bool IsVisible;\n        public int LastCornerPref;\n        public int LastX;\n        public int LastY;\n        public int LastW;\n        public int LastH;\n    }\n\n    [StructLayout(LayoutKind.Sequential)]\n    public struct RECT\n    {\n        public int Left;\n        public int Top;\n        public int Right;\n        public int Bottom;\n    }\n\n    [StructLayout(LayoutKind.Sequential)]\n    public struct POINT\n    {\n        public int X;\n        public int Y;\n    }\n\n    [StructLayout(LayoutKind.Sequential)]\n    public struct DWM_THUMBNAIL_PROPERTIES\n    {\n        public uint dwFlags;\n        public RECT rcDestination;\n        public RECT rcSource;\n        public byte opacity;\n        [MarshalAs(UnmanagedType.Bool)]\n        public bool fVisible;\n        [MarshalAs(UnmanagedType.Bool)]\n        public bool fSourceClientAreaOnly;\n    }\n\n    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]\n    public struct WNDCLASSEXW\n    {\n        public uint cbSize;\n        public uint style;\n        public WndProcDelegate lpfnWndProc;\n        public int cbClsExtra;\n        public int cbWndExtra;\n        public IntPtr hInstance;\n        public IntPtr hIcon;\n        public IntPtr hCursor;\n        public IntPtr hbrBackground;\n        public string lpszMenuName;\n        public string lpszClassName;\n        public IntPtr hIconSm;\n    }\n\n    [StructLayout(LayoutKind.Sequential)]\n    public struct MSG\n    {\n        public IntPtr hwnd;\n        public uint message;\n        public IntPtr wParam;\n        public IntPtr lParam;\n        public uint time;\n        public POINT pt;\n    }\n\n    public delegate IntPtr WndProcDelegate(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);\n\n    class Program\n    {\n        [DllImport(\"user32.dll\")]\n        static extern bool SetProcessDPIAware();\n\n        [DllImport(\"user32.dll\")]\n        static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);\n        delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);\n\n        [DllImport(\"user32.dll\")]\n        static extern bool IsWindow(IntPtr hWnd);\n\n        [DllImport(\"user32.dll\")]\n        static extern bool IsWindowVisible(IntPtr hWnd);\n\n        [DllImport(\"user32.dll\")]\n        static extern bool IsIconic(IntPtr hWnd);\n\n        [DllImport(\"user32.dll\")]\n        static extern bool IsZoomed(IntPtr hWnd);\n\n        [DllImport(\"user32.dll\", CharSet = CharSet.Unicode)]\n        static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);\n\n        [DllImport(\"user32.dll\", CharSet = CharSet.Unicode)]\n        static extern int GetWindowTextLength(IntPtr hWnd);\n\n        [DllImport(\"user32.dll\", CharSet = CharSet.Unicode)]\n        static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);\n\n        [DllImport(\"user32.dll\")]\n        static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);\n\n        [DllImport(\"user32.dll\")]\n        static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);\n\n        [DllImport(\"user32.dll\")]\n        static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);\n\n        [DllImport(\"user32.dll\")]\n        static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);\n\n        [DllImport(\"user32.dll\")]\n        static extern IntPtr GetParent(IntPtr hWnd);\n\n        [DllImport(\"user32.dll\")]\n        static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);\n\n        [DllImport(\"user32.dll\", EntryPoint = \"GetWindowLong\")]\n        static extern int GetWindowLong32(IntPtr hWnd, int nIndex);\n\n        [DllImport(\"user32.dll\", EntryPoint = \"SetWindowLong\")]\n        static extern int SetWindowLong32(IntPtr hWnd, int nIndex, int dwNewLong);\n\n        [DllImport(\"user32.dll\", EntryPoint = \"GetWindowLongPtr\")]\n        static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);\n\n        [DllImport(\"user32.dll\", EntryPoint = \"SetWindowLongPtr\")]\n        static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);\n\n        static IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex)\n        {\n            if (IntPtr.Size == 8) return GetWindowLongPtr64(hWnd, nIndex);\n            return new IntPtr(GetWindowLong32(hWnd, nIndex));\n        }\n\n        static IntPtr SetWindowLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong)\n        {\n            if (IntPtr.Size == 8) return SetWindowLongPtr64(hWnd, nIndex, dwNewLong);\n            return new IntPtr(SetWindowLong32(hWnd, nIndex, dwNewLong.ToInt32()));\n        }\n\n        [DllImport(\"user32.dll\")]\n        static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);\n\n        [DllImport(\"user32.dll\")]\n        static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);\n\n        [DllImport(\"user32.dll\")]\n        static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);\n\n        [DllImport(\"user32.dll\")]\n        static extern bool GetCursorPos(out POINT lpPoint);\n\n        [DllImport(\"user32.dll\")]\n        static extern IntPtr WindowFromPoint(POINT Point);\n\n        [DllImport(\"user32.dll\")]\n        static extern IntPtr GetAncestor(IntPtr hwnd, uint gaFlags);\n\n        [DllImport(\"user32.dll\")]\n        static extern short GetAsyncKeyState(int vKey);\n\n        [DllImport(\"user32.dll\")]\n        static extern IntPtr GetForegroundWindow();\n\n        [DllImport(\"user32.dll\")]\n        static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);\n\n        [DllImport(\"user32.dll\")]\n        static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags);\n\n        [DllImport(\"user32.dll\")]\n        static extern int SetWindowRgn(IntPtr hWnd, IntPtr hRgn, bool bRedraw);\n\n        [DllImport(\"gdi32.dll\")]\n        static extern IntPtr CreateRoundRectRgn(int x1, int y1, int x2, int y2, int cx, int cy);\n\n        [DllImport(\"gdi32.dll\")]\n        static extern bool DeleteObject(IntPtr hObject);\n\n        [DllImport(\"user32.dll\", CharSet = CharSet.Unicode)]\n        static extern ushort RegisterClassExW(ref WNDCLASSEXW lpwcx);\n\n        [DllImport(\"user32.dll\", CharSet = CharSet.Unicode)]\n        static extern IntPtr CreateWindowExW(\n            uint dwExStyle,\n            string lpClassName,\n            string lpWindowName,\n            uint dwStyle,\n            int x,\n            int y,\n            int nWidth,\n            int nHeight,\n            IntPtr hWndParent,\n            IntPtr hMenu,\n            IntPtr hInstance,\n            IntPtr lpParam);\n\n        [DllImport(\"user32.dll\", CharSet = CharSet.Unicode)]\n        static extern IntPtr DefWindowProcW(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);\n\n        [DllImport(\"user32.dll\", CharSet = CharSet.Unicode)]\n        static extern int GetMessageW(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);\n\n        [DllImport(\"user32.dll\")]\n        static extern bool TranslateMessage(ref MSG lpMsg);\n\n        [DllImport(\"user32.dll\", CharSet = CharSet.Unicode)]\n        static extern IntPtr DispatchMessageW(ref MSG lpMsg);\n\n        [DllImport(\"user32.dll\")]\n        static extern bool PostMessageW(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);\n\n        [DllImport(\"kernel32.dll\", CharSet = CharSet.Unicode)]\n        static extern IntPtr GetModuleHandleW(string lpModuleName);\n\n        [DllImport(\"dwmapi.dll\")]\n        static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);\n\n        [DllImport(\"dwmapi.dll\")]\n        static extern int DwmSetWindowAttribute(IntPtr hwnd, int dwAttribute, ref int pvAttribute, int cbAttribute);\n\n        [DllImport(\"dwmapi.dll\")]\n        static extern int DwmRegisterThumbnail(IntPtr hwndDestination, IntPtr hwndSource, out IntPtr phThumbnailId);\n\n        [DllImport(\"dwmapi.dll\")]\n        static extern int DwmUnregisterThumbnail(IntPtr hThumbnailId);\n\n        [DllImport(\"dwmapi.dll\")]\n        static extern int DwmUpdateThumbnailProperties(IntPtr hThumbnailId, ref DWM_THUMBNAIL_PROPERTIES ptnProperties);\n\n        const int GWL_STYLE = -16;\n        const int GWL_EXSTYLE = -20;\n        const int GWLP_HWNDPARENT = -8;\n\n        const int WS_CHILD = 0x40000000;\n        const int WS_POPUP = unchecked((int)0x80000000);\n        const int WS_CAPTION = 0x00C00000;\n        const int WS_THICKFRAME = 0x00040000;\n        const int WS_MINIMIZEBOX = 0x00020000;\n        const int WS_MAXIMIZEBOX = 0x00010000;\n        const int WS_SYSMENU = 0x00080000;\n        const int WS_BORDER = 0x00800000;\n        const int WS_CLIPSIBLINGS = 0x04000000;\n        const int WS_CLIPCHILDREN = 0x02000000;\n\n        const int WS_EX_DLGMODALFRAME = 0x00000001;\n        const int WS_EX_TOPMOST = 0x00000008;\n        const int WS_EX_TRANSPARENT = 0x00000020;\n        const int WS_EX_TOOLWINDOW = 0x00000080;\n        const int WS_EX_WINDOWEDGE = 0x00000100;\n        const int WS_EX_CLIENTEDGE = 0x00000200;\n        const int WS_EX_STATICEDGE = 0x00020000;\n        const int WS_EX_APPWINDOW = 0x00040000;\n        const int WS_EX_LAYERED = 0x00080000;\n        const int WS_EX_NOACTIVATE = 0x08000000;\n\n        const uint LWA_ALPHA = 0x00000002;\n\n        const uint SWP_NOSIZE = 0x0001;\n        const uint SWP_NOMOVE = 0x0002;\n        const uint SWP_NOZORDER = 0x0004;\n        const uint SWP_NOACTIVATE = 0x0010;\n        const uint SWP_FRAMECHANGED = 0x0020;\n        const uint SWP_SHOWWINDOW = 0x0040;\n        const uint SWP_HIDEWINDOW = 0x0080;\n        const uint SWP_NOOWNERZORDER = 0x0200;\n        const uint SWP_NOSENDCHANGING = 0x0400;\n\n        static readonly IntPtr HWND_TOP = new IntPtr(0);\n        static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);\n\n        const int SW_HIDE = 0;\n        const int SW_SHOWNORMAL = 1;\n        const int SW_SHOWNOACTIVATE = 4;\n        const int SW_SHOW = 5;\n        const int SW_RESTORE = 9;\n\n        const uint GA_ROOT = 2;\n        const int VK_LBUTTON = 0x01;\n        const int VK_ESCAPE = 0x1B;\n        const int DWMWA_CLOAKED = 14;\n        const int DWMWA_WINDOW_CORNER_PREFERENCE = 33;\n        const int DWMWA_BORDER_COLOR = 34;\n\n        const uint DWM_TNP_RECTDESTINATION = 0x00000001;\n        const uint DWM_TNP_RECTSOURCE = 0x00000002;\n        const uint DWM_TNP_OPACITY = 0x00000004;\n        const uint DWM_TNP_VISIBLE = 0x00000008;\n\n        const uint WM_NCHITTEST = 0x0084;\n        const uint WM_MOUSEACTIVATE = 0x0021;\n        const uint WM_ERASEBKGND = 0x0014;\n        const uint WM_APP_SYNC_OVERLAYS = 0x8001;\n\n        static readonly object SyncLock = new object();\n        static readonly Dictionary<long, DockedWindowState> DockedWindows = new Dictionary<long, DockedWindowState>();\n        static readonly Dictionary<string, DragZoneInfo> DragZones = new Dictionary<string, DragZoneInfo>();\n\n        static IntPtr OverlayObsidianHwnd = IntPtr.Zero;\n        static List<OverlayRectInfo> DesiredOverlayRects = new List<OverlayRectInfo>();\n        static readonly List<OverlayPopupSlot> PopupSlots = new List<OverlayPopupSlot>();\n        static WndProcDelegate KeepAliveWndProc;\n        static IntPtr OverlayMsgHwnd = IntPtr.Zero;\n\n        static volatile bool IsPicking = false;\n        static volatile bool IsRunning = true;\n\n        static void Main(string[] args)\n        {\n            try { SetProcessDPIAware(); } catch { }\n\n            Console.InputEncoding = Encoding.UTF8;\n            Console.OutputEncoding = Encoding.UTF8;\n\n            Thread overlayThread = new Thread(OverlayUiThreadLoop);\n            overlayThread.IsBackground = true;\n            overlayThread.SetApartmentState(ApartmentState.STA);\n            overlayThread.Start();\n\n            Thread syncThread = new Thread(SyncLoop);\n            syncThread.IsBackground = true;\n            syncThread.Start();\n\n            string line;\n            while ((line = Console.ReadLine()) != null)\n            {\n                line = line.Trim();\n                if (string.IsNullOrEmpty(line)) continue;\n                HandleCommand(line);\n            }\n\n            IsRunning = false;\n            ClearAllOverlayPopups();\n            UndockAll();\n        }\n\n        static void OverlayUiThreadLoop()\n        {\n            try\n            {\n                KeepAliveWndProc = OverlayWndProc;\n                IntPtr hInst = GetModuleHandleW(null);\n                string clsName = \"ObsidianDockerOverlayPopup\";\n\n                WNDCLASSEXW wcex = new WNDCLASSEXW();\n                wcex.cbSize = (uint)Marshal.SizeOf(typeof(WNDCLASSEXW));\n                wcex.style = 0;\n                wcex.lpfnWndProc = KeepAliveWndProc;\n                wcex.hInstance = hInst;\n                wcex.hbrBackground = IntPtr.Zero;\n                wcex.lpszClassName = clsName;\n\n                RegisterClassExW(ref wcex);\n\n                uint exStyle = (uint)(WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_LAYERED | WS_EX_TRANSPARENT);\n                uint style = unchecked((uint)WS_POPUP);\n\n                lock (SyncLock)\n                {\n                    for (int i = 0; i < 4; i++)\n                    {\n                        IntPtr hwnd = CreateWindowExW(exStyle, clsName, \"\", style, 0, 0, 1, 1, IntPtr.Zero, IntPtr.Zero, hInst, IntPtr.Zero);\n                        if (hwnd != IntPtr.Zero)\n                        {\n                            SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA);\n                            try\n                            {\n                                int colorNone = unchecked((int)0xFFFFFFFE);\n                                DwmSetWindowAttribute(hwnd, DWMWA_BORDER_COLOR, ref colorNone, sizeof(int));\n                            }\n                            catch { }\n\n                            PopupSlots.Add(new OverlayPopupSlot\n                            {\n                                Hwnd = hwnd,\n                                ThumbId = IntPtr.Zero,\n                                SourceHwnd = IntPtr.Zero,\n                                IsVisible = false,\n                                LastCornerPref = 0\n                            });\n                            if (OverlayMsgHwnd == IntPtr.Zero)\n                            {\n                                OverlayMsgHwnd = hwnd;\n                            }\n                        }\n                    }\n                }\n\n                MSG msg;\n                while (IsRunning && GetMessageW(out msg, IntPtr.Zero, 0, 0) > 0)\n                {\n                    TranslateMessage(ref msg);\n                    DispatchMessageW(ref msg);\n                }\n            }\n            catch { }\n        }\n\n        static IntPtr OverlayWndProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam)\n        {\n            if (msg == WM_NCHITTEST)\n            {\n                return new IntPtr(-1); // HTTRANSPARENT\n            }\n            if (msg == WM_MOUSEACTIVATE)\n            {\n                return new IntPtr(3); // MA_NOACTIVATE\n            }\n            if (msg == WM_ERASEBKGND)\n            {\n                return new IntPtr(1);\n            }\n            if (msg == WM_APP_SYNC_OVERLAYS)\n            {\n                ApplyOverlaysOnUiThread();\n                return IntPtr.Zero;\n            }\n            return DefWindowProcW(hWnd, msg, wParam, lParam);\n        }\n\n        static void RequestOverlayUiSync()\n        {\n            IntPtr target = OverlayMsgHwnd;\n            if (target != IntPtr.Zero)\n            {\n                PostMessageW(target, WM_APP_SYNC_OVERLAYS, IntPtr.Zero, IntPtr.Zero);\n            }\n        }\n\n        static void ApplyOverlaysOnUiThread()\n        {\n            lock (SyncLock)\n            {\n                IntPtr obsHwnd = OverlayObsidianHwnd;\n                bool obsValid = obsHwnd != IntPtr.Zero && IsWindow(obsHwnd) && IsWindowVisible(obsHwnd) && !IsIconic(obsHwnd);\n\n                if (!obsValid || DesiredOverlayRects.Count == 0)\n                {\n                    for (int i = 0; i < PopupSlots.Count; i++)\n                    {\n                        var slot = PopupSlots[i];\n                        if (slot.IsVisible)\n                        {\n                            ShowWindow(slot.Hwnd, SW_HIDE);\n                            slot.IsVisible = false;\n                        }\n                    }\n                    return;\n                }\n\n                RECT winRect;\n                GetWindowRect(obsHwnd, out winRect);\n                POINT clientOrigin = new POINT { X = 0, Y = 0 };\n                ClientToScreen(obsHwnd, ref clientOrigin);\n\n                int srcOffsetX = clientOrigin.X - winRect.Left;\n                int srcOffsetY = clientOrigin.Y - winRect.Top;\n\n                for (int i = 0; i < PopupSlots.Count; i++)\n                {\n                    var slot = PopupSlots[i];\n                    if (i < DesiredOverlayRects.Count)\n                    {\n                        OverlayRectInfo r = DesiredOverlayRects[i];\n                        if (r.Width <= 4 || r.Height <= 4)\n                        {\n                            if (slot.IsVisible)\n                            {\n                                ShowWindow(slot.Hwnd, SW_HIDE);\n                                slot.IsVisible = false;\n                            }\n                            continue;\n                        }\n\n                        if (slot.ThumbId == IntPtr.Zero || slot.SourceHwnd != obsHwnd)\n                        {\n                            if (slot.ThumbId != IntPtr.Zero)\n                            {\n                                try { DwmUnregisterThumbnail(slot.ThumbId); } catch { }\n                                slot.ThumbId = IntPtr.Zero;\n                            }\n                            IntPtr newThumb;\n                            if (DwmRegisterThumbnail(slot.Hwnd, obsHwnd, out newThumb) == 0)\n                            {\n                                slot.ThumbId = newThumb;\n                                slot.SourceHwnd = obsHwnd;\n                            }\n                        }\n\n                        int screenX = clientOrigin.X + r.X;\n                        int screenY = clientOrigin.Y + r.Y;\n\n                        if (slot.LastX != screenX || slot.LastY != screenY || slot.LastW != r.Width || slot.LastH != r.Height)\n                        {\n                            SetWindowPos(slot.Hwnd, HWND_TOPMOST, screenX, screenY, r.Width, r.Height,\n                                SWP_NOACTIVATE | SWP_NOSENDCHANGING | (slot.IsVisible ? SWP_SHOWWINDOW : 0));\n                        }\n\n                        if (slot.LastCornerPref != r.CornerPref || slot.LastW != r.Width || slot.LastH != r.Height)\n                        {\n                            slot.LastCornerPref = r.CornerPref;\n                            int pref = r.CornerPref;\n                            int hr = -1;\n                            try\n                            {\n                                hr = DwmSetWindowAttribute(slot.Hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, ref pref, sizeof(int));\n                            }\n                            catch { }\n\n                            if (hr != 0)\n                            {\n                                int rad = r.CornerPref == 3 ? 8 : 16;\n                                IntPtr rgn = CreateRoundRectRgn(0, 0, r.Width + 1, r.Height + 1, rad, rad);\n                                if (rgn != IntPtr.Zero)\n                                {\n                                    if (SetWindowRgn(slot.Hwnd, rgn, false) == 0)\n                                    {\n                                        DeleteObject(rgn);\n                                    }\n                                }\n                            }\n                        }\n\n                        if (slot.ThumbId != IntPtr.Zero)\n                        {\n                            DWM_THUMBNAIL_PROPERTIES props = new DWM_THUMBNAIL_PROPERTIES();\n                            props.dwFlags = DWM_TNP_RECTDESTINATION | DWM_TNP_RECTSOURCE | DWM_TNP_VISIBLE | DWM_TNP_OPACITY;\n                            props.fSourceClientAreaOnly = false;\n                            props.fVisible = true;\n                            props.opacity = 255;\n                            props.rcSource = new RECT\n                            {\n                                Left = srcOffsetX + r.X,\n                                Top = srcOffsetY + r.Y,\n                                Right = srcOffsetX + r.X + r.Width,\n                                Bottom = srcOffsetY + r.Y + r.Height\n                            };\n                            props.rcDestination = new RECT\n                            {\n                                Left = 0,\n                                Top = 0,\n                                Right = r.Width,\n                                Bottom = r.Height\n                            };\n                            DwmUpdateThumbnailProperties(slot.ThumbId, ref props);\n                        }\n\n                        slot.LastX = screenX;\n                        slot.LastY = screenY;\n                        slot.LastW = r.Width;\n                        slot.LastH = r.Height;\n\n                        if (!slot.IsVisible)\n                        {\n                            SetWindowPos(slot.Hwnd, HWND_TOPMOST, screenX, screenY, r.Width, r.Height,\n                                SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_NOSENDCHANGING);\n                            slot.IsVisible = true;\n                        }\n                    }\n                    else\n                    {\n                        if (slot.IsVisible)\n                        {\n                            ShowWindow(slot.Hwnd, SW_HIDE);\n                            slot.IsVisible = false;\n                        }\n                    }\n                }\n            }\n        }\n\n        static void ClearAllOverlayPopups()\n        {\n            lock (SyncLock)\n            {\n                DesiredOverlayRects.Clear();\n                foreach (var slot in PopupSlots)\n                {\n                    if (slot.ThumbId != IntPtr.Zero)\n                    {\n                        try { DwmUnregisterThumbnail(slot.ThumbId); } catch { }\n                        slot.ThumbId = IntPtr.Zero;\n                    }\n                    if (slot.Hwnd != IntPtr.Zero && IsWindow(slot.Hwnd))\n                    {\n                        ShowWindow(slot.Hwnd, SW_HIDE);\n                    }\n                    slot.IsVisible = false;\n                }\n            }\n        }\n\n        static void SendJson(string json)\n        {\n            lock (Console.Out)\n            {\n                Console.Out.WriteLine(json);\n                Console.Out.Flush();\n            }\n        }\n\n        static string EscapeJson(string s)\n        {\n            if (s == null) return \"\";\n            StringBuilder sb = new StringBuilder(s.Length + 8);\n            foreach (char c in s)\n            {\n                switch (c)\n                {\n                    case '\\\\': sb.Append(\"\\\\\\\\\"); break;\n                    case '\"': sb.Append(\"\\\\\\\"\"); break;\n                    case '\\n': sb.Append(\"\\\\n\"); break;\n                    case '\\r': sb.Append(\"\\\\r\"); break;\n                    case '\\t': sb.Append(\"\\\\t\"); break;\n                    default:\n                        if (c < 32) sb.AppendFormat(\"\\\\u{0:x4}\", (int)c);\n                        else sb.Append(c);\n                        break;\n                }\n            }\n            return sb.ToString();\n        }\n\n        static string GetJsonString(string json, string key)\n        {\n            string pattern = \"\\\"\" + key + \"\\\"\";\n            int idx = json.IndexOf(pattern, StringComparison.Ordinal);\n            if (idx < 0) return \"\";\n            idx = json.IndexOf(':', idx + pattern.Length);\n            if (idx < 0) return \"\";\n            idx++;\n            while (idx < json.Length && char.IsWhiteSpace(json[idx])) idx++;\n            if (idx >= json.Length) return \"\";\n            if (json[idx] == '\"')\n            {\n                idx++;\n                StringBuilder sb = new StringBuilder();\n                while (idx < json.Length)\n                {\n                    char c = json[idx++];\n                    if (c == '\\\\' && idx < json.Length)\n                    {\n                        char next = json[idx++];\n                        if (next == 'n') sb.Append('\\n');\n                        else if (next == 'r') sb.Append('\\r');\n                        else if (next == 't') sb.Append('\\t');\n                        else sb.Append(next);\n                    }\n                    else if (c == '\"') break;\n                    else sb.Append(c);\n                }\n                return sb.ToString();\n            }\n            else\n            {\n                int start = idx;\n                while (idx < json.Length && json[idx] != ',' && json[idx] != '}' && !char.IsWhiteSpace(json[idx])) idx++;\n                return json.Substring(start, idx - start);\n            }\n        }\n\n        static long GetJsonLong(string json, string key, long defaultVal = 0)\n        {\n            string val = GetJsonString(json, key);\n            long res;\n            if (long.TryParse(val, out res)) return res;\n            return defaultVal;\n        }\n\n        static bool GetJsonBool(string json, string key, bool defaultVal = false)\n        {\n            string val = GetJsonString(json, key).ToLowerInvariant();\n            if (val == \"true\" || val == \"1\") return true;\n            if (val == \"false\" || val == \"0\") return false;\n            return defaultVal;\n        }\n\n        static string GetWindowTitle(IntPtr hWnd)\n        {\n            int len = GetWindowTextLength(hWnd);\n            if (len <= 0) return \"\";\n            StringBuilder sb = new StringBuilder(len + 2);\n            GetWindowText(hWnd, sb, sb.Capacity);\n            return sb.ToString();\n        }\n\n        static string GetWindowClass(IntPtr hWnd)\n        {\n            StringBuilder sb = new StringBuilder(256);\n            GetClassName(hWnd, sb, sb.Capacity);\n            return sb.ToString();\n        }\n\n        static string GetProcessNameSafe(uint pid)\n        {\n            try\n            {\n                using (Process p = Process.GetProcessById((int)pid))\n                {\n                    return p.ProcessName;\n                }\n            }\n            catch\n            {\n                return \"Unknown\";\n            }\n        }\n\n        static bool IsWindowCloaked(IntPtr hWnd)\n        {\n            try\n            {\n                int cloaked = 0;\n                int hr = DwmGetWindowAttribute(hWnd, DWMWA_CLOAKED, out cloaked, sizeof(int));\n                return hr == 0 && cloaked != 0;\n            }\n            catch\n            {\n                return false;\n            }\n        }\n\n        static void HandleCommand(string json)\n        {\n            string id = GetJsonString(json, \"id\");\n            string cmd = GetJsonString(json, \"cmd\");\n\n            try\n            {\n                if (cmd == \"find_obsidian\")\n                {\n                    long pid = GetJsonLong(json, \"pid\", 0);\n                    long ppid = GetJsonLong(json, \"ppid\", 0);\n                    string titleHint = GetJsonString(json, \"title\");\n                    IntPtr found = FindObsidianWindow((uint)pid, (uint)ppid, titleHint);\n                    SendJson(string.Format(\"{{\\\"id\\\":\\\"{0}\\\",\\\"ok\\\":true,\\\"hwnd\\\":\\\"{1}\\\"}}\", EscapeJson(id), found.ToInt64()));\n                }\n                else if (cmd == \"list_windows\")\n                {\n                    long obsidianHwndVal = GetJsonLong(json, \"obsidianHwnd\", 0);\n                    string listJson = ListWindowsJson(new IntPtr(obsidianHwndVal));\n                    SendJson(string.Format(\"{{\\\"id\\\":\\\"{0}\\\",\\\"ok\\\":true,\\\"windows\\\":{1}}}\", EscapeJson(id), listJson));\n                }\n                else if (cmd == \"dock\")\n                {\n                    long hwndVal = GetJsonLong(json, \"hwnd\", 0);\n                    long obsVal = GetJsonLong(json, \"obsidianHwnd\", 0);\n                    string mode = GetJsonString(json, \"mode\");\n                    if (string.IsNullOrEmpty(mode)) mode = \"overlay\";\n                    bool borderless = GetJsonBool(json, \"borderless\", false);\n                    int opacity = (int)GetJsonLong(json, \"opacity\", 100);\n                    int x = (int)GetJsonLong(json, \"x\", 0);\n                    int y = (int)GetJsonLong(json, \"y\", 0);\n                    int w = (int)GetJsonLong(json, \"width\", 400);\n                    int h = (int)GetJsonLong(json, \"height\", 300);\n\n                    bool ok = DockWindow(new IntPtr(hwndVal), new IntPtr(obsVal), mode, borderless, opacity, x, y, w, h);\n                    string title = GetWindowTitle(new IntPtr(hwndVal));\n                    uint pid;\n                    GetWindowThreadProcessId(new IntPtr(hwndVal), out pid);\n                    string proc = GetProcessNameSafe(pid);\n                    SendJson(string.Format(\"{{\\\"id\\\":\\\"{0}\\\",\\\"ok\\\":{1},\\\"hwnd\\\":\\\"{2}\\\",\\\"title\\\":\\\"{3}\\\",\\\"processName\\\":\\\"{4}\\\"}}\",\n                        EscapeJson(id), ok ? \"true\" : \"false\", hwndVal, EscapeJson(title), EscapeJson(proc)));\n                }\n                else if (cmd == \"update_rect\")\n                {\n                    long hwndVal = GetJsonLong(json, \"hwnd\", 0);\n                    int x = (int)GetJsonLong(json, \"x\", 0);\n                    int y = (int)GetJsonLong(json, \"y\", 0);\n                    int w = (int)GetJsonLong(json, \"width\", 0);\n                    int h = (int)GetJsonLong(json, \"height\", 0);\n                    bool visible = GetJsonBool(json, \"visible\", true);\n                    bool clearMinimized = GetJsonBool(json, \"restore\", false);\n                    UpdateDockedRect(hwndVal, x, y, w, h, visible, clearMinimized);\n                    SendJson(string.Format(\"{{\\\"id\\\":\\\"{0}\\\",\\\"ok\\\":true}}\", EscapeJson(id)));\n                }\n                else if (cmd == \"sync_overlays\")\n                {\n                    long obsVal = GetJsonLong(json, \"obsidianHwnd\", 0);\n                    bool interactive = GetJsonBool(json, \"interactive\", false);\n                    string rectsRaw = GetJsonString(json, \"rects\");\n                    SyncOverlays(new IntPtr(obsVal), interactive, rectsRaw);\n                    SendJson(string.Format(\"{{\\\"id\\\":\\\"{0}\\\",\\\"ok\\\":true}}\", EscapeJson(id)));\n                }\n                else if (cmd == \"restore_window\")\n                {\n                    long hwndVal = GetJsonLong(json, \"hwnd\", 0);\n                    RestoreMinimizedDockedWindow(hwndVal);\n                    SendJson(string.Format(\"{{\\\"id\\\":\\\"{0}\\\",\\\"ok\\\":true}}\", EscapeJson(id)));\n                }\n                else if (cmd == \"set_style\")\n                {\n                    long hwndVal = GetJsonLong(json, \"hwnd\", 0);\n                    string mode = GetJsonString(json, \"mode\");\n                    bool borderless = GetJsonBool(json, \"borderless\", false);\n                    int opacity = (int)GetJsonLong(json, \"opacity\", 100);\n                    UpdateDockedStyle(hwndVal, mode, borderless, opacity);\n                    SendJson(string.Format(\"{{\\\"id\\\":\\\"{0}\\\",\\\"ok\\\":true}}\", EscapeJson(id)));\n                }\n                else if (cmd == \"undock\")\n                {\n                    long hwndVal = GetJsonLong(json, \"hwnd\", 0);\n                    UndockWindow(hwndVal);\n                    SendJson(string.Format(\"{{\\\"id\\\":\\\"{0}\\\",\\\"ok\\\":true}}\", EscapeJson(id)));\n                }\n                else if (cmd == \"undock_all\")\n                {\n                    ClearAllOverlayPopups();\n                    UndockAll();\n                    SendJson(string.Format(\"{{\\\"id\\\":\\\"{0}\\\",\\\"ok\\\":true}}\", EscapeJson(id)));\n                }\n                else if (cmd == \"pick_window\")\n                {\n                    long obsVal = GetJsonLong(json, \"obsidianHwnd\", 0);\n                    Thread pickThread = new Thread(() => RunPickWindow(id, new IntPtr(obsVal)));\n                    pickThread.IsBackground = true;\n                    pickThread.Start();\n                }\n                else if (cmd == \"cancel_pick\")\n                {\n                    IsPicking = false;\n                    SendJson(string.Format(\"{{\\\"id\\\":\\\"{0}\\\",\\\"ok\\\":true}}\", EscapeJson(id)));\n                }\n                else if (cmd == \"set_drag_zone\")\n                {\n                    string viewId = GetJsonString(json, \"viewId\");\n                    if (string.IsNullOrEmpty(viewId)) viewId = \"default\";\n                    bool enabled = GetJsonBool(json, \"enabled\", false);\n                    lock (SyncLock)\n                    {\n                        if (!enabled)\n                        {\n                            DragZones.Remove(viewId);\n                        }\n                        else\n                        {\n                            DragZones[viewId] = new DragZoneInfo\n                            {\n                                ViewId = viewId,\n                                ObsidianHwnd = new IntPtr(GetJsonLong(json, \"obsidianHwnd\", 0)),\n                                RelX = (int)GetJsonLong(json, \"x\", 0),\n                                RelY = (int)GetJsonLong(json, \"y\", 0),\n                                Width = (int)GetJsonLong(json, \"width\", 0),\n                                Height = (int)GetJsonLong(json, \"height\", 0)\n                            };\n                        }\n                    }\n                    SendJson(string.Format(\"{{\\\"id\\\":\\\"{0}\\\",\\\"ok\\\":true}}\", EscapeJson(id)));\n                }\n                else\n                {\n                    SendJson(string.Format(\"{{\\\"id\\\":\\\"{0}\\\",\\\"ok\\\":false,\\\"error\\\":\\\"Unknown cmd\\\"}}\", EscapeJson(id)));\n                }\n            }\n            catch (Exception ex)\n            {\n                SendJson(string.Format(\"{{\\\"id\\\":\\\"{0}\\\",\\\"ok\\\":false,\\\"error\\\":\\\"{1}\\\"}}\", EscapeJson(id), EscapeJson(ex.Message)));\n            }\n        }\n\n        // Format of rectsRaw: \"x,y,w,h,cornerPref;x,y,w,h,cornerPref\"\n        static void SyncOverlays(IntPtr obsHwnd, bool interactive, string rectsRaw)\n        {\n            lock (SyncLock)\n            {\n                if (obsHwnd != IntPtr.Zero)\n                {\n                    OverlayObsidianHwnd = obsHwnd;\n                }\n\n                DesiredOverlayRects.Clear();\n                if (!string.IsNullOrEmpty(rectsRaw))\n                {\n                    string[] items = rectsRaw.Split(new char[] { ';' }, StringSplitOptions.RemoveEmptyEntries);\n                    for (int i = 0; i < items.Length && DesiredOverlayRects.Count < 4; i++)\n                    {\n                        string[] parts = items[i].Split(',');\n                        if (parts.Length >= 5)\n                        {\n                            int rx, ry, rw, rh, cp;\n                            if (int.TryParse(parts[0], out rx) &&\n                                int.TryParse(parts[1], out ry) &&\n                                int.TryParse(parts[2], out rw) &&\n                                int.TryParse(parts[3], out rh) &&\n                                int.TryParse(parts[4], out cp))\n                            {\n                                if (rw > 4 && rh > 4)\n                                {\n                                    DesiredOverlayRects.Add(new OverlayRectInfo\n                                    {\n                                        X = rx,\n                                        Y = ry,\n                                        Width = rw,\n                                        Height = rh,\n                                        CornerPref = cp\n                                    });\n                                }\n                            }\n                        }\n                    }\n                }\n\n                foreach (var kv in DockedWindows)\n                {\n                    var st = kv.Value;\n                    if (st.InputPassthrough != interactive)\n                    {\n                        st.InputPassthrough = interactive;\n                        ApplyExtendedStyle(st);\n                    }\n                }\n            }\n\n            RequestOverlayUiSync();\n        }\n\n        static void ApplyExtendedStyle(DockedWindowState state)\n        {\n            IntPtr hWnd = state.Hwnd;\n            if (!IsWindow(hWnd)) return;\n\n            int exStyle = state.OriginalExStyle;\n            if (state.Opacity < 100 || state.InputPassthrough)\n            {\n                exStyle |= WS_EX_LAYERED;\n                if (state.InputPassthrough)\n                {\n                    exStyle |= WS_EX_TRANSPARENT;\n                }\n                else\n                {\n                    exStyle &= ~WS_EX_TRANSPARENT;\n                }\n                SetWindowLong32(hWnd, GWL_EXSTYLE, exStyle);\n                byte alpha = (byte)Math.Max(50, Math.Min(255, (state.Opacity * 255) / 100));\n                SetLayeredWindowAttributes(hWnd, 0, alpha, LWA_ALPHA);\n            }\n            else\n            {\n                exStyle &= ~WS_EX_TRANSPARENT;\n                SetWindowLong32(hWnd, GWL_EXSTYLE, exStyle);\n                if ((exStyle & WS_EX_LAYERED) != 0)\n                {\n                    SetLayeredWindowAttributes(hWnd, 0, 255, LWA_ALPHA);\n                }\n            }\n        }\n\n        static IntPtr FindObsidianWindow(uint targetPid, uint targetPpid, string titleHint)\n        {\n            IntPtr exactMatch = IntPtr.Zero;\n            IntPtr pidMatch = IntPtr.Zero;\n            IntPtr fallbackMatch = IntPtr.Zero;\n\n            EnumWindows((hWnd, lParam) =>\n            {\n                if (!IsWindowVisible(hWnd)) return true;\n                string title = GetWindowTitle(hWnd);\n                if (string.IsNullOrEmpty(title)) return true;\n                string cls = GetWindowClass(hWnd);\n                if (cls != \"Chrome_WidgetWin_1\") return true;\n\n                uint pid;\n                GetWindowThreadProcessId(hWnd, out pid);\n\n                if (!string.IsNullOrEmpty(titleHint) && title.Equals(titleHint, StringComparison.OrdinalIgnoreCase))\n                {\n                    exactMatch = hWnd;\n                    return false;\n                }\n                if ((targetPpid != 0 && pid == targetPpid) || (targetPid != 0 && pid == targetPid))\n                {\n                    pidMatch = hWnd;\n                }\n                if (!string.IsNullOrEmpty(titleHint) && title.IndexOf(titleHint, StringComparison.OrdinalIgnoreCase) >= 0)\n                {\n                    if (exactMatch == IntPtr.Zero) exactMatch = hWnd;\n                }\n                if (title.IndexOf(\"Obsidian\", StringComparison.OrdinalIgnoreCase) >= 0)\n                {\n                    fallbackMatch = hWnd;\n                }\n                return true;\n            }, IntPtr.Zero);\n\n            if (exactMatch != IntPtr.Zero) return exactMatch;\n            if (pidMatch != IntPtr.Zero) return pidMatch;\n            return fallbackMatch;\n        }\n\n        class WinCandidate\n        {\n            public long Hwnd;\n            public string Title;\n            public string ProcessName;\n            public uint Pid;\n            public string ClassName;\n            public int Width;\n            public int Height;\n            public long Area;\n        }\n\n        static bool IsSingleMainWindowProcess(string procName)\n        {\n            if (string.IsNullOrEmpty(procName)) return false;\n            string p = procName.ToLowerInvariant();\n            return p.Contains(\"weixin\") || p.Contains(\"wechat\") || p.Contains(\"flclash\") || p.Contains(\"chatgpt\") || p == \"qq\" || p == \"tim\";\n        }\n\n        static string ListWindowsJson(IntPtr obsidianHwnd)\n        {\n            uint obsidianPid = 0;\n            if (obsidianHwnd != IntPtr.Zero)\n            {\n                GetWindowThreadProcessId(obsidianHwnd, out obsidianPid);\n            }\n            uint selfPid = (uint)Process.GetCurrentProcess().Id;\n\n            HashSet<uint> dockedSinglePids = new HashSet<uint>();\n            HashSet<long> dockedHwnds = new HashSet<long>();\n            lock (SyncLock)\n            {\n                foreach (var kv in DockedWindows)\n                {\n                    dockedHwnds.Add(kv.Key);\n                    if (kv.Value.ProcessId != 0)\n                    {\n                        string dProc = GetProcessNameSafe(kv.Value.ProcessId);\n                        if (IsSingleMainWindowProcess(dProc))\n                        {\n                            dockedSinglePids.Add(kv.Value.ProcessId);\n                        }\n                    }\n                }\n            }\n\n            Dictionary<string, WinCandidate> bestByGroup = new Dictionary<string, WinCandidate>();\n\n            EnumWindows((hWnd, lParam) =>\n            {\n                if (hWnd == obsidianHwnd) return true;\n                if (!IsWindowVisible(hWnd)) return true;\n                if (IsWindowCloaked(hWnd)) return true;\n                if (dockedHwnds.Contains(hWnd.ToInt64())) return true;\n\n                uint pid;\n                GetWindowThreadProcessId(hWnd, out pid);\n                if (pid == selfPid || (obsidianPid != 0 && pid == obsidianPid)) return true;\n                if (dockedSinglePids.Contains(pid)) return true;\n\n                int exStyle = GetWindowLong32(hWnd, GWL_EXSTYLE);\n                if ((exStyle & WS_EX_TOOLWINDOW) != 0 && (exStyle & WS_EX_APPWINDOW) == 0)\n                    return true;\n                if ((exStyle & WS_EX_NOACTIVATE) != 0 || (exStyle & WS_EX_TRANSPARENT) != 0)\n                    return true;\n\n                IntPtr owner = GetWindow(hWnd, 4); // GW_OWNER = 4\n                if (owner != IntPtr.Zero && (exStyle & WS_EX_APPWINDOW) == 0)\n                    return true;\n\n                string title = GetWindowTitle(hWnd);\n                if (string.IsNullOrWhiteSpace(title)) return true;\n\n                string cls = GetWindowClass(hWnd);\n                if (cls == \"Progman\" || cls == \"WorkerW\" || cls == \"Shell_TrayWnd\" ||\n                    cls == \"Windows.UI.Core.CoreWindow\" ||\n                    cls.IndexOf(\"Shadow\", StringComparison.OrdinalIgnoreCase) >= 0 ||\n                    cls.IndexOf(\"ToolTip\", StringComparison.OrdinalIgnoreCase) >= 0)\n                    return true;\n\n                RECT r;\n                GetWindowRect(hWnd, out r);\n                int w = r.Right - r.Left;\n                int h = r.Bottom - r.Top;\n\n                if (!IsIconic(hWnd) && (w < 240 || h < 180))\n                    return true;\n\n                string procName = GetProcessNameSafe(pid);\n                long area = (long)Math.Max(1, w) * Math.Max(1, h);\n\n                string groupKey = IsSingleMainWindowProcess(procName)\n                    ? (\"pid:\" + pid.ToString())\n                    : (\"pid_title:\" + pid.ToString() + \":\" + title);\n\n                WinCandidate existing;\n                if (!bestByGroup.TryGetValue(groupKey, out existing) || area > existing.Area)\n                {\n                    bestByGroup[groupKey] = new WinCandidate\n                    {\n                        Hwnd = hWnd.ToInt64(),\n                        Title = title,\n                        ProcessName = procName,\n                        Pid = pid,\n                        ClassName = cls,\n                        Width = w,\n                        Height = h,\n                        Area = area\n                    };\n                }\n                return true;\n            }, IntPtr.Zero);\n\n            List<WinCandidate> candidates = new List<WinCandidate>(bestByGroup.Values);\n            candidates.Sort((a, b) => b.Area.CompareTo(a.Area));\n\n            StringBuilder sb = new StringBuilder();\n            sb.Append(\"[\");\n            for (int i = 0; i < candidates.Count; i++)\n            {\n                var c = candidates[i];\n                if (i > 0) sb.Append(\",\");\n                sb.AppendFormat(\"{{\\\"hwnd\\\":\\\"{0}\\\",\\\"title\\\":\\\"{1}\\\",\\\"processName\\\":\\\"{2}\\\",\\\"pid\\\":{3},\\\"className\\\":\\\"{4}\\\",\\\"width\\\":{5},\\\"height\\\":{6}}}\",\n                    c.Hwnd, EscapeJson(c.Title), EscapeJson(c.ProcessName), c.Pid, EscapeJson(c.ClassName), c.Width, c.Height);\n            }\n            sb.Append(\"]\");\n            return sb.ToString();\n        }\n\n        static bool DockWindow(IntPtr targetHwnd, IntPtr obsidianHwnd, string mode, bool borderless, int opacity, int x, int y, int w, int h)\n        {\n            if (!IsWindow(targetHwnd) || !IsWindow(obsidianHwnd)) return false;\n\n            SetWindowRgn(targetHwnd, IntPtr.Zero, true);\n\n            uint targetPid;\n            GetWindowThreadProcessId(targetHwnd, out targetPid);\n\n            lock (SyncLock)\n            {\n                OverlayObsidianHwnd = obsidianHwnd;\n                long key = targetHwnd.ToInt64();\n                DockedWindowState state;\n                if (!DockedWindows.TryGetValue(key, out state))\n                {\n                    if (IsIconic(targetHwnd))\n                    {\n                        ShowWindow(targetHwnd, SW_RESTORE);\n                        Thread.Sleep(50);\n                    }\n                    bool zoomed = IsZoomed(targetHwnd);\n                    if (zoomed)\n                    {\n                        ShowWindow(targetHwnd, SW_RESTORE);\n                        Thread.Sleep(50);\n                    }\n\n                    RECT rect;\n                    GetWindowRect(targetHwnd, out rect);\n\n                    state = new DockedWindowState\n                    {\n                        Hwnd = targetHwnd,\n                        ObsidianHwnd = obsidianHwnd,\n                        ProcessId = targetPid,\n                        OriginalParent = GetParent(targetHwnd),\n                        OriginalOwner = GetWindowLongPtr(targetHwnd, GWLP_HWNDPARENT),\n                        OriginalStyle = GetWindowLong32(targetHwnd, GWL_STYLE),\n                        OriginalExStyle = GetWindowLong32(targetHwnd, GWL_EXSTYLE),\n                        OriginalRect = rect,\n                        WasMaximized = zoomed,\n                        Mode = mode,\n                        Borderless = borderless,\n                        Opacity = Math.Max(20, Math.Min(100, opacity)),\n                        RelX = x,\n                        RelY = y,\n                        Width = Math.Max(100, w),\n                        Height = Math.Max(100, h),\n                        Visible = true,\n                        MinimizedByUser = false,\n                        InputPassthrough = false\n                    };\n                    DockedWindows[key] = state;\n                }\n                else\n                {\n                    state.ObsidianHwnd = obsidianHwnd;\n                    state.ProcessId = targetPid;\n                    state.Mode = mode;\n                    state.Borderless = borderless;\n                    state.Opacity = Math.Max(20, Math.Min(100, opacity));\n                    state.RelX = x;\n                    state.RelY = y;\n                    state.Width = Math.Max(100, w);\n                    state.Height = Math.Max(100, h);\n                    state.Visible = true;\n                    state.MinimizedByUser = false;\n                    state.InputPassthrough = false;\n                }\n\n                ApplyDockStyle(state);\n                ApplyWindowPosition(state, true);\n            }\n            return true;\n        }\n\n        static void ApplyDockStyle(DockedWindowState state)\n        {\n            IntPtr hWnd = state.Hwnd;\n            if (!IsWindow(hWnd)) return;\n\n            if (IsIconic(hWnd))\n            {\n                ShowWindow(hWnd, SW_RESTORE);\n            }\n\n            SetWindowRgn(hWnd, IntPtr.Zero, false);\n\n            int style = state.OriginalStyle;\n            if (state.Borderless)\n            {\n                style &= ~(WS_CAPTION | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU | WS_BORDER);\n            }\n\n            if (state.Mode == \"child\")\n            {\n                SetWindowLongPtr(hWnd, GWLP_HWNDPARENT, IntPtr.Zero);\n                style &= ~WS_POPUP;\n                style |= WS_CHILD | WS_CLIPSIBLINGS | WS_CLIPCHILDREN;\n                SetWindowLong32(hWnd, GWL_STYLE, style);\n                SetParent(hWnd, state.ObsidianHwnd);\n\n                uint targetTid, obsTid, dummy1, dummy2;\n                targetTid = GetWindowThreadProcessId(hWnd, out dummy1);\n                obsTid = GetWindowThreadProcessId(state.ObsidianHwnd, out dummy2);\n                if (targetTid != 0 && obsTid != 0 && targetTid != obsTid)\n                {\n                    AttachThreadInput(targetTid, obsTid, true);\n                }\n            }\n            else\n            {\n                if (GetParent(hWnd) == state.ObsidianHwnd)\n                {\n                    SetParent(hWnd, IntPtr.Zero);\n                }\n                style &= ~WS_CHILD;\n                SetWindowLong32(hWnd, GWL_STYLE, style);\n                SetWindowLongPtr(hWnd, GWLP_HWNDPARENT, state.ObsidianHwnd);\n            }\n\n            ApplyExtendedStyle(state);\n\n            SetWindowPos(hWnd, IntPtr.Zero, 0, 0, 0, 0,\n                SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);\n        }\n\n        static void ApplyWindowPosition(DockedWindowState state, bool forceFrameChanged)\n        {\n            if (!IsWindow(state.Hwnd) || !IsWindow(state.ObsidianHwnd)) return;\n\n            bool obsMinimized = IsIconic(state.ObsidianHwnd);\n            if (!state.Visible || state.MinimizedByUser || obsMinimized || state.Width <= 20 || state.Height <= 20)\n            {\n                ShowWindow(state.Hwnd, SW_HIDE);\n                return;\n            }\n\n            if (IsIconic(state.Hwnd))\n            {\n                ShowWindow(state.Hwnd, SW_RESTORE);\n            }\n\n            int targetX = state.RelX;\n            int targetY = state.RelY;\n\n            if (state.Mode != \"child\")\n            {\n                SetWindowLongPtr(state.Hwnd, GWLP_HWNDPARENT, state.ObsidianHwnd);\n                POINT pt = new POINT { X = 0, Y = 0 };\n                ClientToScreen(state.ObsidianHwnd, ref pt);\n                targetX += pt.X;\n                targetY += pt.Y;\n            }\n\n            uint flags = SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_NOOWNERZORDER | SWP_NOSENDCHANGING;\n            if (forceFrameChanged) flags |= SWP_FRAMECHANGED;\n\n            SetWindowPos(state.Hwnd, HWND_TOP, targetX, targetY, state.Width, state.Height, flags);\n            MoveWindow(state.Hwnd, targetX, targetY, state.Width, state.Height, true);\n        }\n\n        static void UpdateDockedRect(long hwndVal, int x, int y, int w, int h, bool visible, bool clearMinimized)\n        {\n            lock (SyncLock)\n            {\n                DockedWindowState state;\n                if (DockedWindows.TryGetValue(hwndVal, out state))\n                {\n                    state.RelX = x;\n                    state.RelY = y;\n                    state.Width = w;\n                    state.Height = h;\n                    state.Visible = visible;\n                    if (clearMinimized) state.MinimizedByUser = false;\n                    ApplyWindowPosition(state, false);\n                }\n            }\n        }\n\n        static void RestoreMinimizedDockedWindow(long hwndVal)\n        {\n            lock (SyncLock)\n            {\n                DockedWindowState state;\n                if (DockedWindows.TryGetValue(hwndVal, out state))\n                {\n                    state.MinimizedByUser = false;\n                    state.Visible = true;\n                    if (IsIconic(state.Hwnd))\n                    {\n                        ShowWindow(state.Hwnd, SW_RESTORE);\n                    }\n                    ApplyDockStyle(state);\n                    ApplyWindowPosition(state, true);\n                }\n            }\n        }\n\n        static void UpdateDockedStyle(long hwndVal, string mode, bool borderless, int opacity)\n        {\n            lock (SyncLock)\n            {\n                DockedWindowState state;\n                if (DockedWindows.TryGetValue(hwndVal, out state))\n                {\n                    if (!string.IsNullOrEmpty(mode)) state.Mode = mode;\n                    state.Borderless = borderless;\n                    if (opacity > 0) state.Opacity = Math.Max(20, Math.Min(100, opacity));\n                    ApplyDockStyle(state);\n                    ApplyWindowPosition(state, true);\n                }\n            }\n        }\n\n        static void UndockWindow(long hwndVal)\n        {\n            lock (SyncLock)\n            {\n                DockedWindowState state;\n                if (DockedWindows.TryGetValue(hwndVal, out state))\n                {\n                    DockedWindows.Remove(hwndVal);\n                    RestoreWindowState(state);\n                }\n            }\n        }\n\n        static void UndockAll()\n        {\n            lock (SyncLock)\n            {\n                foreach (var kv in DockedWindows)\n                {\n                    RestoreWindowState(kv.Value);\n                }\n                DockedWindows.Clear();\n            }\n        }\n\n        static void RestoreWindowState(DockedWindowState state)\n        {\n            IntPtr hWnd = state.Hwnd;\n            if (!IsWindow(hWnd)) return;\n\n            try\n            {\n                uint targetTid, obsTid, d1, d2;\n                targetTid = GetWindowThreadProcessId(hWnd, out d1);\n                obsTid = GetWindowThreadProcessId(state.ObsidianHwnd, out d2);\n                if (targetTid != 0 && obsTid != 0 && targetTid != obsTid)\n                {\n                    AttachThreadInput(targetTid, obsTid, false);\n                }\n            }\n            catch { }\n\n            SetWindowRgn(hWnd, IntPtr.Zero, false);\n\n            if (IsIconic(hWnd))\n            {\n                ShowWindow(hWnd, SW_RESTORE);\n            }\n\n            SetParent(hWnd, state.OriginalParent);\n            SetWindowLongPtr(hWnd, GWLP_HWNDPARENT, state.OriginalOwner);\n            SetWindowLong32(hWnd, GWL_STYLE, state.OriginalStyle);\n            int origEx = state.OriginalExStyle & ~WS_EX_TRANSPARENT;\n            SetWindowLong32(hWnd, GWL_EXSTYLE, origEx);\n            if ((origEx & WS_EX_LAYERED) != 0)\n            {\n                SetLayeredWindowAttributes(hWnd, 0, 255, LWA_ALPHA);\n            }\n\n            int w = Math.Max(300, state.OriginalRect.Right - state.OriginalRect.Left);\n            int h = Math.Max(200, state.OriginalRect.Bottom - state.OriginalRect.Top);\n\n            SetWindowPos(hWnd, IntPtr.Zero, state.OriginalRect.Left, state.OriginalRect.Top, w, h,\n                SWP_NOZORDER | SWP_FRAMECHANGED | SWP_SHOWWINDOW);\n            ShowWindow(hWnd, state.WasMaximized ? SW_SHOW : SW_SHOWNORMAL);\n        }\n\n        static void RunPickWindow(string reqId, IntPtr obsidianHwnd)\n        {\n            IsPicking = true;\n            while (IsPicking && (GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0)\n            {\n                Thread.Sleep(20);\n            }\n\n            IntPtr lastHover = IntPtr.Zero;\n            while (IsPicking && IsRunning)\n            {\n                if ((GetAsyncKeyState(VK_ESCAPE) & 0x8000) != 0)\n                {\n                    IsPicking = false;\n                    SendJson(string.Format(\"{{\\\"id\\\":\\\"{0}\\\",\\\"ok\\\":false,\\\"cancelled\\\":true}}\", EscapeJson(reqId)));\n                    return;\n                }\n\n                POINT pt;\n                if (GetCursorPos(out pt))\n                {\n                    IntPtr hWnd = WindowFromPoint(pt);\n                    IntPtr root = GetAncestor(hWnd, GA_ROOT);\n                    if (root != IntPtr.Zero && root != lastHover)\n                    {\n                        lastHover = root;\n                        string hoverTitle = GetWindowTitle(root);\n                        uint hoverPid;\n                        GetWindowThreadProcessId(root, out hoverPid);\n                        string hoverProc = GetProcessNameSafe(hoverPid);\n                        SendJson(string.Format(\"{{\\\"event\\\":\\\"pick_hover\\\",\\\"hwnd\\\":\\\"{0}\\\",\\\"title\\\":\\\"{1}\\\",\\\"processName\\\":\\\"{2}\\\"}}\",\n                            root.ToInt64(), EscapeJson(hoverTitle), EscapeJson(hoverProc)));\n                    }\n\n                    if ((GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0)\n                    {\n                        IsPicking = false;\n                        if (root != IntPtr.Zero && root != obsidianHwnd)\n                        {\n                            string title = GetWindowTitle(root);\n                            uint pid;\n                            GetWindowThreadProcessId(root, out pid);\n                            string proc = GetProcessNameSafe(pid);\n                            SendJson(string.Format(\"{{\\\"id\\\":\\\"{0}\\\",\\\"ok\\\":true,\\\"hwnd\\\":\\\"{1}\\\",\\\"title\\\":\\\"{2}\\\",\\\"processName\\\":\\\"{3}\\\"}}\",\n                                EscapeJson(reqId), root.ToInt64(), EscapeJson(title), EscapeJson(proc)));\n                        }\n                        else\n                        {\n                            SendJson(string.Format(\"{{\\\"id\\\":\\\"{0}\\\",\\\"ok\\\":false,\\\"cancelled\\\":true,\\\"reason\\\":\\\"Clicked Obsidian itself\\\"}}\", EscapeJson(reqId)));\n                        }\n                        return;\n                    }\n                }\n                Thread.Sleep(25);\n            }\n        }\n\n        static void SyncLoop()\n        {\n            IntPtr draggingHwnd = IntPtr.Zero;\n            RECT dragInitialRect = new RECT();\n            bool wasMouseDown = false;\n            string hoveredViewId = null;\n\n            while (IsRunning)\n            {\n                try\n                {\n                    lock (SyncLock)\n                    {\n                        if (DockedWindows.Count > 0)\n                        {\n                            List<long> deadKeys = null;\n                            foreach (var kv in DockedWindows)\n                            {\n                                var st = kv.Value;\n                                if (!IsWindow(st.Hwnd))\n                                {\n                                    if (deadKeys == null) deadKeys = new List<long>();\n                                    deadKeys.Add(kv.Key);\n                                    continue;\n                                }\n\n                                if (IsIconic(st.Hwnd) && !IsIconic(st.ObsidianHwnd))\n                                {\n                                    ShowWindow(st.Hwnd, SW_RESTORE);\n                                    ShowWindow(st.Hwnd, SW_HIDE);\n                                    if (!st.MinimizedByUser)\n                                    {\n                                        st.MinimizedByUser = true;\n                                        SendJson(string.Format(\"{{\\\"event\\\":\\\"window_minimized\\\",\\\"hwnd\\\":\\\"{0}\\\"}}\", kv.Key));\n                                    }\n                                    continue;\n                                }\n\n                                if (st.MinimizedByUser)\n                                {\n                                    if (IsWindowVisible(st.Hwnd)) ShowWindow(st.Hwnd, SW_HIDE);\n                                    continue;\n                                }\n\n                                if (st.Mode != \"child\" && st.Visible && IsWindow(st.ObsidianHwnd))\n                                {\n                                    if (IsIconic(st.ObsidianHwnd))\n                                    {\n                                        if (IsWindowVisible(st.Hwnd)) ShowWindow(st.Hwnd, SW_HIDE);\n                                    }\n                                    else\n                                    {\n                                        POINT pt = new POINT { X = 0, Y = 0 };\n                                        ClientToScreen(st.ObsidianHwnd, ref pt);\n                                        RECT curRect;\n                                        GetWindowRect(st.Hwnd, out curRect);\n                                        int expectedX = pt.X + st.RelX;\n                                        int expectedY = pt.Y + st.RelY;\n                                        int curW = curRect.Right - curRect.Left;\n                                        int curH = curRect.Bottom - curRect.Top;\n\n                                        if (Math.Abs(curRect.Left - expectedX) > 1 ||\n                                            Math.Abs(curRect.Top - expectedY) > 1 ||\n                                            Math.Abs(curW - st.Width) > 1 ||\n                                            Math.Abs(curH - st.Height) > 1)\n                                        {\n                                            SetWindowPos(st.Hwnd, IntPtr.Zero, expectedX, expectedY, st.Width, st.Height,\n                                                SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_NOOWNERZORDER | SWP_NOSENDCHANGING);\n                                        }\n                                    }\n                                }\n                            }\n\n                            if (deadKeys != null)\n                            {\n                                foreach (long k in deadKeys)\n                                {\n                                    DockedWindows.Remove(k);\n                                    SendJson(string.Format(\"{{\\\"event\\\":\\\"window_closed\\\",\\\"hwnd\\\":\\\"{0}\\\"}}\", k));\n                                }\n                            }\n                        }\n\n                        if (DragZones.Count > 0 && !IsPicking)\n                        {\n                            bool mouseDown = (GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0;\n                            IntPtr fg = GetForegroundWindow();\n\n                            if (mouseDown)\n                            {\n                                if (!wasMouseDown)\n                                {\n                                    wasMouseDown = true;\n                                    bool isObsidian = false;\n                                    foreach (var dz in DragZones.Values)\n                                    {\n                                        if (fg == dz.ObsidianHwnd) { isObsidian = true; break; }\n                                    }\n                                    if (fg != IntPtr.Zero && !isObsidian && !DockedWindows.ContainsKey(fg.ToInt64()))\n                                    {\n                                        draggingHwnd = fg;\n                                        GetWindowRect(fg, out dragInitialRect);\n                                    }\n                                    else\n                                    {\n                                        draggingHwnd = IntPtr.Zero;\n                                    }\n                                }\n                                else if (draggingHwnd != IntPtr.Zero && IsWindow(draggingHwnd))\n                                {\n                                    RECT nowRect;\n                                    GetWindowRect(draggingHwnd, out nowRect);\n                                    bool moved = Math.Abs(nowRect.Left - dragInitialRect.Left) > 8 ||\n                                                 Math.Abs(nowRect.Top - dragInitialRect.Top) > 8;\n                                    if (moved)\n                                    {\n                                        POINT cursor;\n                                        GetCursorPos(out cursor);\n                                        string matchViewId = null;\n\n                                        foreach (var dz in DragZones.Values)\n                                        {\n                                            if (!IsWindow(dz.ObsidianHwnd)) continue;\n                                            POINT obsOrigin = new POINT { X = 0, Y = 0 };\n                                            ClientToScreen(dz.ObsidianHwnd, ref obsOrigin);\n                                            int zoneLeft = obsOrigin.X + dz.RelX;\n                                            int zoneTop = obsOrigin.Y + dz.RelY;\n                                            int zoneRight = zoneLeft + dz.Width;\n                                            int zoneBottom = zoneTop + dz.Height;\n\n                                            if (cursor.X >= zoneLeft && cursor.X <= zoneRight &&\n                                                cursor.Y >= zoneTop && cursor.Y <= zoneBottom)\n                                            {\n                                                matchViewId = dz.ViewId;\n                                                break;\n                                            }\n                                        }\n\n                                        if (matchViewId != hoveredViewId)\n                                        {\n                                            hoveredViewId = matchViewId;\n                                            string t = GetWindowTitle(draggingHwnd);\n                                            SendJson(string.Format(\"{{\\\"event\\\":\\\"drag_hover\\\",\\\"viewId\\\":\\\"{0}\\\",\\\"inside\\\":{1},\\\"hwnd\\\":\\\"{2}\\\",\\\"title\\\":\\\"{3}\\\"}}\",\n                                                EscapeJson(matchViewId ?? \"\"), matchViewId != null ? \"true\" : \"false\", draggingHwnd.ToInt64(), EscapeJson(t)));\n                                        }\n                                    }\n                                }\n                            }\n                            else if (wasMouseDown)\n                            {\n                                wasMouseDown = false;\n                                if (hoveredViewId != null && draggingHwnd != IntPtr.Zero && IsWindow(draggingHwnd))\n                                {\n                                    string t = GetWindowTitle(draggingHwnd);\n                                    uint pid;\n                                    GetWindowThreadProcessId(draggingHwnd, out pid);\n                                    string proc = GetProcessNameSafe(pid);\n                                    SendJson(string.Format(\"{{\\\"id\\\":\\\"\\\",\\\"event\\\":\\\"drag_dropped\\\",\\\"viewId\\\":\\\"{0}\\\",\\\"hwnd\\\":\\\"{1}\\\",\\\"title\\\":\\\"{2}\\\",\\\"processName\\\":\\\"{3}\\\"}}\",\n                                        EscapeJson(hoveredViewId), draggingHwnd.ToInt64(), EscapeJson(t), EscapeJson(proc)));\n                                }\n                                hoveredViewId = null;\n                                draggingHwnd = IntPtr.Zero;\n                            }\n                        }\n                    }\n                }\n                catch { }\n\n                Thread.Sleep(16);\n            }\n        }\n    }\n}\n";
