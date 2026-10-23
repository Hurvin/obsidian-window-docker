# Window Docker for Obsidian (Windows)

> **Platform Notice:** This plugin is **Windows Desktop only** (`isDesktopOnly: true`). It relies on native Win32 & DWM APIs to dock external desktop windows into Obsidian workspaces.

**Window Docker** lets you dock any external Windows desktop application—such as **WeChat (微信)**, **Microsoft Edge**, **ChatGPT**, **FlClash**, **Antigravity**, **QQ**, terminals, or media players—directly into **Obsidian tabs and sidebars**.

|[English](#-features) | [中文说明](#-核心功能中文说明)|

---

## ✨ Features

- **Native Tab & Sidebar Integration**:
  - Dock external desktop windows into main workspace tabs, split panes, or the left/right sidebars.
  - Automatically hides docked windows when switching to another tab or minimizing Obsidian, and seamlessly restores and resizes them when switching back.
- **Three Ways to Dock Windows**:
  - **Drag & Drop to Dock**: Drag any desktop window by its title bar into an empty Window Docker tab and release to snap it in.
  - **Crosshair Picker**: Click the crosshair button and click any visible window on your screen to capture it (`ESC` to cancel).
  - **Running Windows List & Preset Bar**: One-click dock or pin your favorite apps (**WeChat**, **FlClash**, **Edge**, **ChatGPT**, **Antigravity**) from the quick preset bar or searchable window list.
- **Pin Any App to Left Ribbon**:
  - Pin specific applications as dedicated icons in Obsidian's left ribbon. Click the ribbon icon to open or toggle the app in a tab or right sidebar.
- **Dual Docking Modes & DWM Popup Overlay Protection**:
  - **Overlay Mode (`GWLP_HWNDPARENT`, Recommended)**: Designed for hardware-accelerated / custom-drawn windows (WeChat, Electron, Chromium/Edge, Flutter/FlClash). Preserves IME candidate windows, context menus, and smooth rendering.
  - **DWM Thumbnail Popup Passthrough**: Automatically projects Obsidian menus, command palettes,modals, and tooltips above the docked external window using hardware-accelerated DWM thumbnails so Obsidian UI is never occluded.
  - **Child Mode (`SetParent`)**: Classic Win32 parent-child embedding for standard Win32 applications.
- **Safe Restoration**:
  - Closing the tab, clicking "Undock", or exiting Obsidian automatically restores all docked windows back to the Windows desktop with their original window styles and positions.

### How the Native Win32 Helper Works (Zero External Dependencies)

Upon first launch, the plugin writes `Win32Helper.cs` into the plugin folder (if not already present) and compiles `Win32Helper.exe` locally using the standard Windows built-in .NET Framework C# compiler (`C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`). All C# source code is 100% open-source and included in [`Win32Helper.cs`](./Win32Helper.cs).

---

## ✨ 核心功能（中文说明）

将 Windows 电脑上的**任意外部桌面窗口**（如 **微信 WeChat**、**FlClash**、**Edge 浏览器**、**ChatGPT**、**Antigravity**、**QQ**、终端、播放器等）直接拖拽或固定到 **Obsidian 的标签页（Tab）与左右侧边栏**中，像原生 Obsidian 标签页一样支持分屏、标签页切换、侧边栏折叠与自动尺寸同步。

1. **像原生标签页一样管理外部窗口**：
   - **支持分屏与多标签页并发固定**：切换到其他笔记标签页时，被固定的外部窗口会自动隐藏；切回该标签页时自动显示并对齐尺寸。
   - **支持固定到右侧边栏**：可将窗口容器移至右侧边栏，一边写笔记一边刷微信、查 ChatGPT 或看网页。
   - **DWM 硬件级防遮挡**：基于 Windows DWM Thumbnail 硬件合成技术，Obsidian 的右键菜单、`Ctrl + P` 命令面板、设置弹窗、悬浮提示（Tooltip）均会自动浮现在外部窗口上方，不会被外部窗口遮挡。

2. **专属常用软件适配与独立功能区图标（Ribbon）**：
   - 内置 **微信、FlClash、Edge、ChatGPT、Antigravity、QQ** 专属自适应矢量图标与快捷入口栏。
   - 支持将任意应用**单独固定到 Obsidian 左侧功能区（Ribbon）**：左键点击直接打开/定位到该应用窗口，右键可选择在「主标签页」或「右侧边栏」中打开。
   - 智能区分 **Edge 普通浏览器窗口**与 **ChatGPT 网页/应用窗口**，可同时将两者作为独立图标固定到左侧功能区。

3. **三种捕获外部窗口的方式**：
   - **直接拖入吸附**：打开空白容器标签页后，用鼠标按住桌面窗口拖入该区域松开即可自动吸附固定。
   - **准星点击捕获**：点击 `准星点击捕获` 按钮，再单击桌面上的目标窗口即可捕获（按 `ESC` 取消）。
   - **快捷栏 / 列表点选**：在容器面板直接点击常用软件芯片或搜索运行中的窗口。

4. **安全防丢失机制**：
   - 点击右上角的释放按钮、关闭标签页或直接关闭 Obsidian 时，所有被固定的外部窗口都会自动还原回桌面原本的位置与尺寸。

---

## 📦 Installation / 安装方法

### From Obsidian Community Plugins (Recommended)
1. Open **Settings -> Community plugins** in Obsidian.
2. Click **Browse** and search for **Window Docker**.
3. Click **Install**, then **Enable**.

### Using BRAT
1. Install the **BRAT** plugin in Obsidian.
2. Add beta plugin repository: `<your-github-username>/obsidian-window-docker`.
3. Enable **Window Docker** in **Settings -> Community plugins**.

### Manual Installation / 手动安装
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [GitHub Release](../../releases).
2. Create a folder `.obsidian/plugins/window-docker/` in your Obsidian vault and place the downloaded files inside.
3. Reload Obsidian and enable **Window Docker** in **Settings -> Community plugins**.

---

## 📄 License

[MIT License](./LICENSE)
