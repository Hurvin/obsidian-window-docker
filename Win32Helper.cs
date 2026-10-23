using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace ObsidianWindowDocker
{
    public class DockedWindowState
    {
        public IntPtr Hwnd;
        public IntPtr ObsidianHwnd;
        public uint ProcessId;
        public IntPtr OriginalParent;
        public IntPtr OriginalOwner;
        public int OriginalStyle;
        public int OriginalExStyle;
        public RECT OriginalRect;
        public bool WasMaximized;
        public string Mode; // "overlay" or "child"
        public bool Borderless;
        public int Opacity; // 20 - 100
        public int RelX;
        public int RelY;
        public int Width;
        public int Height;
        public bool Visible;
        public bool MinimizedByUser;
        public bool InputPassthrough;
    }

    public class DragZoneInfo
    {
        public string ViewId;
        public IntPtr ObsidianHwnd;
        public int RelX;
        public int RelY;
        public int Width;
        public int Height;
    }

    public class OverlayRectInfo
    {
        public int X;
        public int Y;
        public int Width;
        public int Height;
        public int CornerPref; // 2 = DWMWCP_ROUND (8px), 3 = DWMWCP_ROUNDSMALL (4px)
    }

    public class OverlayPopupSlot
    {
        public IntPtr Hwnd;
        public IntPtr ThumbId;
        public IntPtr SourceHwnd;
        public bool IsVisible;
        public int LastCornerPref;
        public int LastX;
        public int LastY;
        public int LastW;
        public int LastH;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct DWM_THUMBNAIL_PROPERTIES
    {
        public uint dwFlags;
        public RECT rcDestination;
        public RECT rcSource;
        public byte opacity;
        [MarshalAs(UnmanagedType.Bool)]
        public bool fVisible;
        [MarshalAs(UnmanagedType.Bool)]
        public bool fSourceClientAreaOnly;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct WNDCLASSEXW
    {
        public uint cbSize;
        public uint style;
        public WndProcDelegate lpfnWndProc;
        public int cbClsExtra;
        public int cbWndExtra;
        public IntPtr hInstance;
        public IntPtr hIcon;
        public IntPtr hCursor;
        public IntPtr hbrBackground;
        public string lpszMenuName;
        public string lpszClassName;
        public IntPtr hIconSm;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG
    {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public POINT pt;
    }

    public delegate IntPtr WndProcDelegate(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    class Program
    {
        [DllImport("user32.dll")]
        static extern bool SetProcessDPIAware();

        [DllImport("user32.dll")]
        static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
        delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        static extern bool IsWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        static extern bool IsIconic(IntPtr hWnd);

        [DllImport("user32.dll")]
        static extern bool IsZoomed(IntPtr hWnd);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern int GetWindowTextLength(IntPtr hWnd);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

        [DllImport("user32.dll")]
        static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [DllImport("user32.dll")]
        static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

        [DllImport("user32.dll")]
        static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);

        [DllImport("user32.dll")]
        static extern IntPtr GetParent(IntPtr hWnd);

        [DllImport("user32.dll")]
        static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);

        [DllImport("user32.dll", EntryPoint = "GetWindowLong")]
        static extern int GetWindowLong32(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll", EntryPoint = "SetWindowLong")]
        static extern int SetWindowLong32(IntPtr hWnd, int nIndex, int dwNewLong);

        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtr")]
        static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr")]
        static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

        static IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex)
        {
            if (IntPtr.Size == 8) return GetWindowLongPtr64(hWnd, nIndex);
            return new IntPtr(GetWindowLong32(hWnd, nIndex));
        }

        static IntPtr SetWindowLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong)
        {
            if (IntPtr.Size == 8) return SetWindowLongPtr64(hWnd, nIndex, dwNewLong);
            return new IntPtr(SetWindowLong32(hWnd, nIndex, dwNewLong.ToInt32()));
        }

        [DllImport("user32.dll")]
        static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        [DllImport("user32.dll")]
        static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

        [DllImport("user32.dll")]
        static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        static extern bool GetCursorPos(out POINT lpPoint);

        [DllImport("user32.dll")]
        static extern IntPtr WindowFromPoint(POINT Point);

        [DllImport("user32.dll")]
        static extern IntPtr GetAncestor(IntPtr hwnd, uint gaFlags);

        [DllImport("user32.dll")]
        static extern short GetAsyncKeyState(int vKey);

        [DllImport("user32.dll")]
        static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

        [DllImport("user32.dll")]
        static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags);

        [DllImport("user32.dll")]
        static extern int SetWindowRgn(IntPtr hWnd, IntPtr hRgn, bool bRedraw);

        [DllImport("gdi32.dll")]
        static extern IntPtr CreateRoundRectRgn(int x1, int y1, int x2, int y2, int cx, int cy);

        [DllImport("gdi32.dll")]
        static extern bool DeleteObject(IntPtr hObject);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern ushort RegisterClassExW(ref WNDCLASSEXW lpwcx);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern IntPtr CreateWindowExW(
            uint dwExStyle,
            string lpClassName,
            string lpWindowName,
            uint dwStyle,
            int x,
            int y,
            int nWidth,
            int nHeight,
            IntPtr hWndParent,
            IntPtr hMenu,
            IntPtr hInstance,
            IntPtr lpParam);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern IntPtr DefWindowProcW(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern int GetMessageW(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

        [DllImport("user32.dll")]
        static extern bool TranslateMessage(ref MSG lpMsg);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern IntPtr DispatchMessageW(ref MSG lpMsg);

        [DllImport("user32.dll")]
        static extern bool PostMessageW(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        static extern IntPtr GetModuleHandleW(string lpModuleName);

        [DllImport("dwmapi.dll")]
        static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);

        [DllImport("dwmapi.dll")]
        static extern int DwmSetWindowAttribute(IntPtr hwnd, int dwAttribute, ref int pvAttribute, int cbAttribute);

        [DllImport("dwmapi.dll")]
        static extern int DwmRegisterThumbnail(IntPtr hwndDestination, IntPtr hwndSource, out IntPtr phThumbnailId);

        [DllImport("dwmapi.dll")]
        static extern int DwmUnregisterThumbnail(IntPtr hThumbnailId);

        [DllImport("dwmapi.dll")]
        static extern int DwmUpdateThumbnailProperties(IntPtr hThumbnailId, ref DWM_THUMBNAIL_PROPERTIES ptnProperties);

        const int GWL_STYLE = -16;
        const int GWL_EXSTYLE = -20;
        const int GWLP_HWNDPARENT = -8;

        const int WS_CHILD = 0x40000000;
        const int WS_POPUP = unchecked((int)0x80000000);
        const int WS_CAPTION = 0x00C00000;
        const int WS_THICKFRAME = 0x00040000;
        const int WS_MINIMIZEBOX = 0x00020000;
        const int WS_MAXIMIZEBOX = 0x00010000;
        const int WS_SYSMENU = 0x00080000;
        const int WS_BORDER = 0x00800000;
        const int WS_CLIPSIBLINGS = 0x04000000;
        const int WS_CLIPCHILDREN = 0x02000000;

        const int WS_EX_DLGMODALFRAME = 0x00000001;
        const int WS_EX_TOPMOST = 0x00000008;
        const int WS_EX_TRANSPARENT = 0x00000020;
        const int WS_EX_TOOLWINDOW = 0x00000080;
        const int WS_EX_WINDOWEDGE = 0x00000100;
        const int WS_EX_CLIENTEDGE = 0x00000200;
        const int WS_EX_STATICEDGE = 0x00020000;
        const int WS_EX_APPWINDOW = 0x00040000;
        const int WS_EX_LAYERED = 0x00080000;
        const int WS_EX_NOACTIVATE = 0x08000000;

        const uint LWA_ALPHA = 0x00000002;

        const uint SWP_NOSIZE = 0x0001;
        const uint SWP_NOMOVE = 0x0002;
        const uint SWP_NOZORDER = 0x0004;
        const uint SWP_NOACTIVATE = 0x0010;
        const uint SWP_FRAMECHANGED = 0x0020;
        const uint SWP_SHOWWINDOW = 0x0040;
        const uint SWP_HIDEWINDOW = 0x0080;
        const uint SWP_NOOWNERZORDER = 0x0200;
        const uint SWP_NOSENDCHANGING = 0x0400;

        static readonly IntPtr HWND_TOP = new IntPtr(0);
        static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);

        const int SW_HIDE = 0;
        const int SW_SHOWNORMAL = 1;
        const int SW_SHOWNOACTIVATE = 4;
        const int SW_SHOW = 5;
        const int SW_RESTORE = 9;

        const uint GA_ROOT = 2;
        const int VK_LBUTTON = 0x01;
        const int VK_ESCAPE = 0x1B;
        const int DWMWA_CLOAKED = 14;
        const int DWMWA_WINDOW_CORNER_PREFERENCE = 33;
        const int DWMWA_BORDER_COLOR = 34;

        const uint DWM_TNP_RECTDESTINATION = 0x00000001;
        const uint DWM_TNP_RECTSOURCE = 0x00000002;
        const uint DWM_TNP_OPACITY = 0x00000004;
        const uint DWM_TNP_VISIBLE = 0x00000008;

        const uint WM_NCHITTEST = 0x0084;
        const uint WM_MOUSEACTIVATE = 0x0021;
        const uint WM_ERASEBKGND = 0x0014;
        const uint WM_APP_SYNC_OVERLAYS = 0x8001;

        static readonly object SyncLock = new object();
        static readonly Dictionary<long, DockedWindowState> DockedWindows = new Dictionary<long, DockedWindowState>();
        static readonly Dictionary<string, DragZoneInfo> DragZones = new Dictionary<string, DragZoneInfo>();

        static IntPtr OverlayObsidianHwnd = IntPtr.Zero;
        static List<OverlayRectInfo> DesiredOverlayRects = new List<OverlayRectInfo>();
        static readonly List<OverlayPopupSlot> PopupSlots = new List<OverlayPopupSlot>();
        static WndProcDelegate KeepAliveWndProc;
        static IntPtr OverlayMsgHwnd = IntPtr.Zero;

        static volatile bool IsPicking = false;
        static volatile bool IsRunning = true;

        static void Main(string[] args)
        {
            try { SetProcessDPIAware(); } catch { }

            Console.InputEncoding = Encoding.UTF8;
            Console.OutputEncoding = Encoding.UTF8;

            Thread overlayThread = new Thread(OverlayUiThreadLoop);
            overlayThread.IsBackground = true;
            overlayThread.SetApartmentState(ApartmentState.STA);
            overlayThread.Start();

            Thread syncThread = new Thread(SyncLoop);
            syncThread.IsBackground = true;
            syncThread.Start();

            string line;
            while ((line = Console.ReadLine()) != null)
            {
                line = line.Trim();
                if (string.IsNullOrEmpty(line)) continue;
                HandleCommand(line);
            }

            IsRunning = false;
            ClearAllOverlayPopups();
            UndockAll();
        }

        static void OverlayUiThreadLoop()
        {
            try
            {
                KeepAliveWndProc = OverlayWndProc;
                IntPtr hInst = GetModuleHandleW(null);
                string clsName = "ObsidianDockerOverlayPopup";

                WNDCLASSEXW wcex = new WNDCLASSEXW();
                wcex.cbSize = (uint)Marshal.SizeOf(typeof(WNDCLASSEXW));
                wcex.style = 0;
                wcex.lpfnWndProc = KeepAliveWndProc;
                wcex.hInstance = hInst;
                wcex.hbrBackground = IntPtr.Zero;
                wcex.lpszClassName = clsName;

                RegisterClassExW(ref wcex);

                uint exStyle = (uint)(WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_LAYERED | WS_EX_TRANSPARENT);
                uint style = unchecked((uint)WS_POPUP);

                lock (SyncLock)
                {
                    for (int i = 0; i < 4; i++)
                    {
                        IntPtr hwnd = CreateWindowExW(exStyle, clsName, "", style, 0, 0, 1, 1, IntPtr.Zero, IntPtr.Zero, hInst, IntPtr.Zero);
                        if (hwnd != IntPtr.Zero)
                        {
                            SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA);
                            try
                            {
                                int colorNone = unchecked((int)0xFFFFFFFE);
                                DwmSetWindowAttribute(hwnd, DWMWA_BORDER_COLOR, ref colorNone, sizeof(int));
                            }
                            catch { }

                            PopupSlots.Add(new OverlayPopupSlot
                            {
                                Hwnd = hwnd,
                                ThumbId = IntPtr.Zero,
                                SourceHwnd = IntPtr.Zero,
                                IsVisible = false,
                                LastCornerPref = 0
                            });
                            if (OverlayMsgHwnd == IntPtr.Zero)
                            {
                                OverlayMsgHwnd = hwnd;
                            }
                        }
                    }
                }

                MSG msg;
                while (IsRunning && GetMessageW(out msg, IntPtr.Zero, 0, 0) > 0)
                {
                    TranslateMessage(ref msg);
                    DispatchMessageW(ref msg);
                }
            }
            catch { }
        }

        static IntPtr OverlayWndProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam)
        {
            if (msg == WM_NCHITTEST)
            {
                return new IntPtr(-1); // HTTRANSPARENT
            }
            if (msg == WM_MOUSEACTIVATE)
            {
                return new IntPtr(3); // MA_NOACTIVATE
            }
            if (msg == WM_ERASEBKGND)
            {
                return new IntPtr(1);
            }
            if (msg == WM_APP_SYNC_OVERLAYS)
            {
                ApplyOverlaysOnUiThread();
                return IntPtr.Zero;
            }
            return DefWindowProcW(hWnd, msg, wParam, lParam);
        }

        static void RequestOverlayUiSync()
        {
            IntPtr target = OverlayMsgHwnd;
            if (target != IntPtr.Zero)
            {
                PostMessageW(target, WM_APP_SYNC_OVERLAYS, IntPtr.Zero, IntPtr.Zero);
            }
        }

        static void ApplyOverlaysOnUiThread()
        {
            lock (SyncLock)
            {
                IntPtr obsHwnd = OverlayObsidianHwnd;
                bool obsValid = obsHwnd != IntPtr.Zero && IsWindow(obsHwnd) && IsWindowVisible(obsHwnd) && !IsIconic(obsHwnd);

                if (!obsValid || DesiredOverlayRects.Count == 0)
                {
                    for (int i = 0; i < PopupSlots.Count; i++)
                    {
                        var slot = PopupSlots[i];
                        if (slot.IsVisible)
                        {
                            ShowWindow(slot.Hwnd, SW_HIDE);
                            slot.IsVisible = false;
                        }
                    }
                    return;
                }

                RECT winRect;
                GetWindowRect(obsHwnd, out winRect);
                POINT clientOrigin = new POINT { X = 0, Y = 0 };
                ClientToScreen(obsHwnd, ref clientOrigin);

                int srcOffsetX = clientOrigin.X - winRect.Left;
                int srcOffsetY = clientOrigin.Y - winRect.Top;

                for (int i = 0; i < PopupSlots.Count; i++)
                {
                    var slot = PopupSlots[i];
                    if (i < DesiredOverlayRects.Count)
                    {
                        OverlayRectInfo r = DesiredOverlayRects[i];
                        if (r.Width <= 4 || r.Height <= 4)
                        {
                            if (slot.IsVisible)
                            {
                                ShowWindow(slot.Hwnd, SW_HIDE);
                                slot.IsVisible = false;
                            }
                            continue;
                        }

                        if (slot.ThumbId == IntPtr.Zero || slot.SourceHwnd != obsHwnd)
                        {
                            if (slot.ThumbId != IntPtr.Zero)
                            {
                                try { DwmUnregisterThumbnail(slot.ThumbId); } catch { }
                                slot.ThumbId = IntPtr.Zero;
                            }
                            IntPtr newThumb;
                            if (DwmRegisterThumbnail(slot.Hwnd, obsHwnd, out newThumb) == 0)
                            {
                                slot.ThumbId = newThumb;
                                slot.SourceHwnd = obsHwnd;
                            }
                        }

                        int screenX = clientOrigin.X + r.X;
                        int screenY = clientOrigin.Y + r.Y;

                        if (slot.LastX != screenX || slot.LastY != screenY || slot.LastW != r.Width || slot.LastH != r.Height)
                        {
                            SetWindowPos(slot.Hwnd, HWND_TOPMOST, screenX, screenY, r.Width, r.Height,
                                SWP_NOACTIVATE | SWP_NOSENDCHANGING | (slot.IsVisible ? SWP_SHOWWINDOW : 0));
                        }

                        if (slot.LastCornerPref != r.CornerPref || slot.LastW != r.Width || slot.LastH != r.Height)
                        {
                            slot.LastCornerPref = r.CornerPref;
                            int pref = r.CornerPref;
                            int hr = -1;
                            try
                            {
                                hr = DwmSetWindowAttribute(slot.Hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, ref pref, sizeof(int));
                            }
                            catch { }

                            if (hr != 0)
                            {
                                int rad = r.CornerPref == 3 ? 8 : 16;
                                IntPtr rgn = CreateRoundRectRgn(0, 0, r.Width + 1, r.Height + 1, rad, rad);
                                if (rgn != IntPtr.Zero)
                                {
                                    if (SetWindowRgn(slot.Hwnd, rgn, false) == 0)
                                    {
                                        DeleteObject(rgn);
                                    }
                                }
                            }
                        }

                        if (slot.ThumbId != IntPtr.Zero)
                        {
                            DWM_THUMBNAIL_PROPERTIES props = new DWM_THUMBNAIL_PROPERTIES();
                            props.dwFlags = DWM_TNP_RECTDESTINATION | DWM_TNP_RECTSOURCE | DWM_TNP_VISIBLE | DWM_TNP_OPACITY;
                            props.fSourceClientAreaOnly = false;
                            props.fVisible = true;
                            props.opacity = 255;
                            props.rcSource = new RECT
                            {
                                Left = srcOffsetX + r.X,
                                Top = srcOffsetY + r.Y,
                                Right = srcOffsetX + r.X + r.Width,
                                Bottom = srcOffsetY + r.Y + r.Height
                            };
                            props.rcDestination = new RECT
                            {
                                Left = 0,
                                Top = 0,
                                Right = r.Width,
                                Bottom = r.Height
                            };
                            DwmUpdateThumbnailProperties(slot.ThumbId, ref props);
                        }

                        slot.LastX = screenX;
                        slot.LastY = screenY;
                        slot.LastW = r.Width;
                        slot.LastH = r.Height;

                        if (!slot.IsVisible)
                        {
                            SetWindowPos(slot.Hwnd, HWND_TOPMOST, screenX, screenY, r.Width, r.Height,
                                SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_NOSENDCHANGING);
                            slot.IsVisible = true;
                        }
                    }
                    else
                    {
                        if (slot.IsVisible)
                        {
                            ShowWindow(slot.Hwnd, SW_HIDE);
                            slot.IsVisible = false;
                        }
                    }
                }
            }
        }

        static void ClearAllOverlayPopups()
        {
            lock (SyncLock)
            {
                DesiredOverlayRects.Clear();
                foreach (var slot in PopupSlots)
                {
                    if (slot.ThumbId != IntPtr.Zero)
                    {
                        try { DwmUnregisterThumbnail(slot.ThumbId); } catch { }
                        slot.ThumbId = IntPtr.Zero;
                    }
                    if (slot.Hwnd != IntPtr.Zero && IsWindow(slot.Hwnd))
                    {
                        ShowWindow(slot.Hwnd, SW_HIDE);
                    }
                    slot.IsVisible = false;
                }
            }
        }

        static void SendJson(string json)
        {
            lock (Console.Out)
            {
                Console.Out.WriteLine(json);
                Console.Out.Flush();
            }
        }

        static string EscapeJson(string s)
        {
            if (s == null) return "";
            StringBuilder sb = new StringBuilder(s.Length + 8);
            foreach (char c in s)
            {
                switch (c)
                {
                    case '\\': sb.Append("\\\\"); break;
                    case '"': sb.Append("\\\""); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 32) sb.AppendFormat("\\u{0:x4}", (int)c);
                        else sb.Append(c);
                        break;
                }
            }
            return sb.ToString();
        }

        static string GetJsonString(string json, string key)
        {
            string pattern = "\"" + key + "\"";
            int idx = json.IndexOf(pattern, StringComparison.Ordinal);
            if (idx < 0) return "";
            idx = json.IndexOf(':', idx + pattern.Length);
            if (idx < 0) return "";
            idx++;
            while (idx < json.Length && char.IsWhiteSpace(json[idx])) idx++;
            if (idx >= json.Length) return "";
            if (json[idx] == '"')
            {
                idx++;
                StringBuilder sb = new StringBuilder();
                while (idx < json.Length)
                {
                    char c = json[idx++];
                    if (c == '\\' && idx < json.Length)
                    {
                        char next = json[idx++];
                        if (next == 'n') sb.Append('\n');
                        else if (next == 'r') sb.Append('\r');
                        else if (next == 't') sb.Append('\t');
                        else sb.Append(next);
                    }
                    else if (c == '"') break;
                    else sb.Append(c);
                }
                return sb.ToString();
            }
            else
            {
                int start = idx;
                while (idx < json.Length && json[idx] != ',' && json[idx] != '}' && !char.IsWhiteSpace(json[idx])) idx++;
                return json.Substring(start, idx - start);
            }
        }

        static long GetJsonLong(string json, string key, long defaultVal = 0)
        {
            string val = GetJsonString(json, key);
            long res;
            if (long.TryParse(val, out res)) return res;
            return defaultVal;
        }

        static bool GetJsonBool(string json, string key, bool defaultVal = false)
        {
            string val = GetJsonString(json, key).ToLowerInvariant();
            if (val == "true" || val == "1") return true;
            if (val == "false" || val == "0") return false;
            return defaultVal;
        }

        static string GetWindowTitle(IntPtr hWnd)
        {
            int len = GetWindowTextLength(hWnd);
            if (len <= 0) return "";
            StringBuilder sb = new StringBuilder(len + 2);
            GetWindowText(hWnd, sb, sb.Capacity);
            return sb.ToString();
        }

        static string GetWindowClass(IntPtr hWnd)
        {
            StringBuilder sb = new StringBuilder(256);
            GetClassName(hWnd, sb, sb.Capacity);
            return sb.ToString();
        }

        static string GetProcessNameSafe(uint pid)
        {
            try
            {
                using (Process p = Process.GetProcessById((int)pid))
                {
                    return p.ProcessName;
                }
            }
            catch
            {
                return "Unknown";
            }
        }

        static bool IsWindowCloaked(IntPtr hWnd)
        {
            try
            {
                int cloaked = 0;
                int hr = DwmGetWindowAttribute(hWnd, DWMWA_CLOAKED, out cloaked, sizeof(int));
                return hr == 0 && cloaked != 0;
            }
            catch
            {
                return false;
            }
        }

        static void HandleCommand(string json)
        {
            string id = GetJsonString(json, "id");
            string cmd = GetJsonString(json, "cmd");

            try
            {
                if (cmd == "find_obsidian")
                {
                    long pid = GetJsonLong(json, "pid", 0);
                    long ppid = GetJsonLong(json, "ppid", 0);
                    string titleHint = GetJsonString(json, "title");
                    IntPtr found = FindObsidianWindow((uint)pid, (uint)ppid, titleHint);
                    SendJson(string.Format("{{\"id\":\"{0}\",\"ok\":true,\"hwnd\":\"{1}\"}}", EscapeJson(id), found.ToInt64()));
                }
                else if (cmd == "list_windows")
                {
                    long obsidianHwndVal = GetJsonLong(json, "obsidianHwnd", 0);
                    string listJson = ListWindowsJson(new IntPtr(obsidianHwndVal));
                    SendJson(string.Format("{{\"id\":\"{0}\",\"ok\":true,\"windows\":{1}}}", EscapeJson(id), listJson));
                }
                else if (cmd == "dock")
                {
                    long hwndVal = GetJsonLong(json, "hwnd", 0);
                    long obsVal = GetJsonLong(json, "obsidianHwnd", 0);
                    string mode = GetJsonString(json, "mode");
                    if (string.IsNullOrEmpty(mode)) mode = "overlay";
                    bool borderless = GetJsonBool(json, "borderless", false);
                    int opacity = (int)GetJsonLong(json, "opacity", 100);
                    int x = (int)GetJsonLong(json, "x", 0);
                    int y = (int)GetJsonLong(json, "y", 0);
                    int w = (int)GetJsonLong(json, "width", 400);
                    int h = (int)GetJsonLong(json, "height", 300);

                    bool ok = DockWindow(new IntPtr(hwndVal), new IntPtr(obsVal), mode, borderless, opacity, x, y, w, h);
                    string title = GetWindowTitle(new IntPtr(hwndVal));
                    uint pid;
                    GetWindowThreadProcessId(new IntPtr(hwndVal), out pid);
                    string proc = GetProcessNameSafe(pid);
                    SendJson(string.Format("{{\"id\":\"{0}\",\"ok\":{1},\"hwnd\":\"{2}\",\"title\":\"{3}\",\"processName\":\"{4}\"}}",
                        EscapeJson(id), ok ? "true" : "false", hwndVal, EscapeJson(title), EscapeJson(proc)));
                }
                else if (cmd == "update_rect")
                {
                    long hwndVal = GetJsonLong(json, "hwnd", 0);
                    int x = (int)GetJsonLong(json, "x", 0);
                    int y = (int)GetJsonLong(json, "y", 0);
                    int w = (int)GetJsonLong(json, "width", 0);
                    int h = (int)GetJsonLong(json, "height", 0);
                    bool visible = GetJsonBool(json, "visible", true);
                    bool clearMinimized = GetJsonBool(json, "restore", false);
                    UpdateDockedRect(hwndVal, x, y, w, h, visible, clearMinimized);
                    SendJson(string.Format("{{\"id\":\"{0}\",\"ok\":true}}", EscapeJson(id)));
                }
                else if (cmd == "sync_overlays")
                {
                    long obsVal = GetJsonLong(json, "obsidianHwnd", 0);
                    bool interactive = GetJsonBool(json, "interactive", false);
                    string rectsRaw = GetJsonString(json, "rects");
                    SyncOverlays(new IntPtr(obsVal), interactive, rectsRaw);
                    SendJson(string.Format("{{\"id\":\"{0}\",\"ok\":true}}", EscapeJson(id)));
                }
                else if (cmd == "restore_window")
                {
                    long hwndVal = GetJsonLong(json, "hwnd", 0);
                    RestoreMinimizedDockedWindow(hwndVal);
                    SendJson(string.Format("{{\"id\":\"{0}\",\"ok\":true}}", EscapeJson(id)));
                }
                else if (cmd == "set_style")
                {
                    long hwndVal = GetJsonLong(json, "hwnd", 0);
                    string mode = GetJsonString(json, "mode");
                    bool borderless = GetJsonBool(json, "borderless", false);
                    int opacity = (int)GetJsonLong(json, "opacity", 100);
                    UpdateDockedStyle(hwndVal, mode, borderless, opacity);
                    SendJson(string.Format("{{\"id\":\"{0}\",\"ok\":true}}", EscapeJson(id)));
                }
                else if (cmd == "undock")
                {
                    long hwndVal = GetJsonLong(json, "hwnd", 0);
                    UndockWindow(hwndVal);
                    SendJson(string.Format("{{\"id\":\"{0}\",\"ok\":true}}", EscapeJson(id)));
                }
                else if (cmd == "undock_all")
                {
                    ClearAllOverlayPopups();
                    UndockAll();
                    SendJson(string.Format("{{\"id\":\"{0}\",\"ok\":true}}", EscapeJson(id)));
                }
                else if (cmd == "pick_window")
                {
                    long obsVal = GetJsonLong(json, "obsidianHwnd", 0);
                    Thread pickThread = new Thread(() => RunPickWindow(id, new IntPtr(obsVal)));
                    pickThread.IsBackground = true;
                    pickThread.Start();
                }
                else if (cmd == "cancel_pick")
                {
                    IsPicking = false;
                    SendJson(string.Format("{{\"id\":\"{0}\",\"ok\":true}}", EscapeJson(id)));
                }
                else if (cmd == "set_drag_zone")
                {
                    string viewId = GetJsonString(json, "viewId");
                    if (string.IsNullOrEmpty(viewId)) viewId = "default";
                    bool enabled = GetJsonBool(json, "enabled", false);
                    lock (SyncLock)
                    {
                        if (!enabled)
                        {
                            DragZones.Remove(viewId);
                        }
                        else
                        {
                            DragZones[viewId] = new DragZoneInfo
                            {
                                ViewId = viewId,
                                ObsidianHwnd = new IntPtr(GetJsonLong(json, "obsidianHwnd", 0)),
                                RelX = (int)GetJsonLong(json, "x", 0),
                                RelY = (int)GetJsonLong(json, "y", 0),
                                Width = (int)GetJsonLong(json, "width", 0),
                                Height = (int)GetJsonLong(json, "height", 0)
                            };
                        }
                    }
                    SendJson(string.Format("{{\"id\":\"{0}\",\"ok\":true}}", EscapeJson(id)));
                }
                else
                {
                    SendJson(string.Format("{{\"id\":\"{0}\",\"ok\":false,\"error\":\"Unknown cmd\"}}", EscapeJson(id)));
                }
            }
            catch (Exception ex)
            {
                SendJson(string.Format("{{\"id\":\"{0}\",\"ok\":false,\"error\":\"{1}\"}}", EscapeJson(id), EscapeJson(ex.Message)));
            }
        }

        // Format of rectsRaw: "x,y,w,h,cornerPref;x,y,w,h,cornerPref"
        static void SyncOverlays(IntPtr obsHwnd, bool interactive, string rectsRaw)
        {
            lock (SyncLock)
            {
                if (obsHwnd != IntPtr.Zero)
                {
                    OverlayObsidianHwnd = obsHwnd;
                }

                DesiredOverlayRects.Clear();
                if (!string.IsNullOrEmpty(rectsRaw))
                {
                    string[] items = rectsRaw.Split(new char[] { ';' }, StringSplitOptions.RemoveEmptyEntries);
                    for (int i = 0; i < items.Length && DesiredOverlayRects.Count < 4; i++)
                    {
                        string[] parts = items[i].Split(',');
                        if (parts.Length >= 5)
                        {
                            int rx, ry, rw, rh, cp;
                            if (int.TryParse(parts[0], out rx) &&
                                int.TryParse(parts[1], out ry) &&
                                int.TryParse(parts[2], out rw) &&
                                int.TryParse(parts[3], out rh) &&
                                int.TryParse(parts[4], out cp))
                            {
                                if (rw > 4 && rh > 4)
                                {
                                    DesiredOverlayRects.Add(new OverlayRectInfo
                                    {
                                        X = rx,
                                        Y = ry,
                                        Width = rw,
                                        Height = rh,
                                        CornerPref = cp
                                    });
                                }
                            }
                        }
                    }
                }

                foreach (var kv in DockedWindows)
                {
                    var st = kv.Value;
                    if (st.InputPassthrough != interactive)
                    {
                        st.InputPassthrough = interactive;
                        ApplyExtendedStyle(st);
                    }
                }
            }

            RequestOverlayUiSync();
        }

        static void ApplyExtendedStyle(DockedWindowState state)
        {
            IntPtr hWnd = state.Hwnd;
            if (!IsWindow(hWnd)) return;

            int exStyle = state.OriginalExStyle;
            if (state.Opacity < 100 || state.InputPassthrough)
            {
                exStyle |= WS_EX_LAYERED;
                if (state.InputPassthrough)
                {
                    exStyle |= WS_EX_TRANSPARENT;
                }
                else
                {
                    exStyle &= ~WS_EX_TRANSPARENT;
                }
                SetWindowLong32(hWnd, GWL_EXSTYLE, exStyle);
                byte alpha = (byte)Math.Max(50, Math.Min(255, (state.Opacity * 255) / 100));
                SetLayeredWindowAttributes(hWnd, 0, alpha, LWA_ALPHA);
            }
            else
            {
                exStyle &= ~WS_EX_TRANSPARENT;
                SetWindowLong32(hWnd, GWL_EXSTYLE, exStyle);
                if ((exStyle & WS_EX_LAYERED) != 0)
                {
                    SetLayeredWindowAttributes(hWnd, 0, 255, LWA_ALPHA);
                }
            }
        }

        static IntPtr FindObsidianWindow(uint targetPid, uint targetPpid, string titleHint)
        {
            IntPtr exactMatch = IntPtr.Zero;
            IntPtr pidMatch = IntPtr.Zero;
            IntPtr fallbackMatch = IntPtr.Zero;

            EnumWindows((hWnd, lParam) =>
            {
                if (!IsWindowVisible(hWnd)) return true;
                string title = GetWindowTitle(hWnd);
                if (string.IsNullOrEmpty(title)) return true;
                string cls = GetWindowClass(hWnd);
                if (cls != "Chrome_WidgetWin_1") return true;

                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);

                if (!string.IsNullOrEmpty(titleHint) && title.Equals(titleHint, StringComparison.OrdinalIgnoreCase))
                {
                    exactMatch = hWnd;
                    return false;
                }
                if ((targetPpid != 0 && pid == targetPpid) || (targetPid != 0 && pid == targetPid))
                {
                    pidMatch = hWnd;
                }
                if (!string.IsNullOrEmpty(titleHint) && title.IndexOf(titleHint, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    if (exactMatch == IntPtr.Zero) exactMatch = hWnd;
                }
                if (title.IndexOf("Obsidian", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    fallbackMatch = hWnd;
                }
                return true;
            }, IntPtr.Zero);

            if (exactMatch != IntPtr.Zero) return exactMatch;
            if (pidMatch != IntPtr.Zero) return pidMatch;
            return fallbackMatch;
        }

        class WinCandidate
        {
            public long Hwnd;
            public string Title;
            public string ProcessName;
            public uint Pid;
            public string ClassName;
            public int Width;
            public int Height;
            public long Area;
        }

        static bool IsSingleMainWindowProcess(string procName)
        {
            if (string.IsNullOrEmpty(procName)) return false;
            string p = procName.ToLowerInvariant();
            return p.Contains("weixin") || p.Contains("wechat") || p.Contains("flclash") || p.Contains("chatgpt") || p == "qq" || p == "tim";
        }

        static string ListWindowsJson(IntPtr obsidianHwnd)
        {
            uint obsidianPid = 0;
            if (obsidianHwnd != IntPtr.Zero)
            {
                GetWindowThreadProcessId(obsidianHwnd, out obsidianPid);
            }
            uint selfPid = (uint)Process.GetCurrentProcess().Id;

            HashSet<uint> dockedSinglePids = new HashSet<uint>();
            HashSet<long> dockedHwnds = new HashSet<long>();
            lock (SyncLock)
            {
                foreach (var kv in DockedWindows)
                {
                    dockedHwnds.Add(kv.Key);
                    if (kv.Value.ProcessId != 0)
                    {
                        string dProc = GetProcessNameSafe(kv.Value.ProcessId);
                        if (IsSingleMainWindowProcess(dProc))
                        {
                            dockedSinglePids.Add(kv.Value.ProcessId);
                        }
                    }
                }
            }

            Dictionary<string, WinCandidate> bestByGroup = new Dictionary<string, WinCandidate>();

            EnumWindows((hWnd, lParam) =>
            {
                if (hWnd == obsidianHwnd) return true;
                if (!IsWindowVisible(hWnd)) return true;
                if (IsWindowCloaked(hWnd)) return true;
                if (dockedHwnds.Contains(hWnd.ToInt64())) return true;

                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                if (pid == selfPid || (obsidianPid != 0 && pid == obsidianPid)) return true;
                if (dockedSinglePids.Contains(pid)) return true;

                int exStyle = GetWindowLong32(hWnd, GWL_EXSTYLE);
                if ((exStyle & WS_EX_TOOLWINDOW) != 0 && (exStyle & WS_EX_APPWINDOW) == 0)
                    return true;
                if ((exStyle & WS_EX_NOACTIVATE) != 0 || (exStyle & WS_EX_TRANSPARENT) != 0)
                    return true;

                IntPtr owner = GetWindow(hWnd, 4); // GW_OWNER = 4
                if (owner != IntPtr.Zero && (exStyle & WS_EX_APPWINDOW) == 0)
                    return true;

                string title = GetWindowTitle(hWnd);
                if (string.IsNullOrWhiteSpace(title)) return true;

                string cls = GetWindowClass(hWnd);
                if (cls == "Progman" || cls == "WorkerW" || cls == "Shell_TrayWnd" ||
                    cls == "Windows.UI.Core.CoreWindow" ||
                    cls.IndexOf("Shadow", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    cls.IndexOf("ToolTip", StringComparison.OrdinalIgnoreCase) >= 0)
                    return true;

                RECT r;
                GetWindowRect(hWnd, out r);
                int w = r.Right - r.Left;
                int h = r.Bottom - r.Top;

                if (!IsIconic(hWnd) && (w < 240 || h < 180))
                    return true;

                string procName = GetProcessNameSafe(pid);
                long area = (long)Math.Max(1, w) * Math.Max(1, h);

                string groupKey = IsSingleMainWindowProcess(procName)
                    ? ("pid:" + pid.ToString())
                    : ("pid_title:" + pid.ToString() + ":" + title);

                WinCandidate existing;
                if (!bestByGroup.TryGetValue(groupKey, out existing) || area > existing.Area)
                {
                    bestByGroup[groupKey] = new WinCandidate
                    {
                        Hwnd = hWnd.ToInt64(),
                        Title = title,
                        ProcessName = procName,
                        Pid = pid,
                        ClassName = cls,
                        Width = w,
                        Height = h,
                        Area = area
                    };
                }
                return true;
            }, IntPtr.Zero);

            List<WinCandidate> candidates = new List<WinCandidate>(bestByGroup.Values);
            candidates.Sort((a, b) => b.Area.CompareTo(a.Area));

            StringBuilder sb = new StringBuilder();
            sb.Append("[");
            for (int i = 0; i < candidates.Count; i++)
            {
                var c = candidates[i];
                if (i > 0) sb.Append(",");
                sb.AppendFormat("{{\"hwnd\":\"{0}\",\"title\":\"{1}\",\"processName\":\"{2}\",\"pid\":{3},\"className\":\"{4}\",\"width\":{5},\"height\":{6}}}",
                    c.Hwnd, EscapeJson(c.Title), EscapeJson(c.ProcessName), c.Pid, EscapeJson(c.ClassName), c.Width, c.Height);
            }
            sb.Append("]");
            return sb.ToString();
        }

        static bool DockWindow(IntPtr targetHwnd, IntPtr obsidianHwnd, string mode, bool borderless, int opacity, int x, int y, int w, int h)
        {
            if (!IsWindow(targetHwnd) || !IsWindow(obsidianHwnd)) return false;

            SetWindowRgn(targetHwnd, IntPtr.Zero, true);

            uint targetPid;
            GetWindowThreadProcessId(targetHwnd, out targetPid);

            lock (SyncLock)
            {
                OverlayObsidianHwnd = obsidianHwnd;
                long key = targetHwnd.ToInt64();
                DockedWindowState state;
                if (!DockedWindows.TryGetValue(key, out state))
                {
                    if (IsIconic(targetHwnd))
                    {
                        ShowWindow(targetHwnd, SW_RESTORE);
                        Thread.Sleep(50);
                    }
                    bool zoomed = IsZoomed(targetHwnd);
                    if (zoomed)
                    {
                        ShowWindow(targetHwnd, SW_RESTORE);
                        Thread.Sleep(50);
                    }

                    RECT rect;
                    GetWindowRect(targetHwnd, out rect);

                    state = new DockedWindowState
                    {
                        Hwnd = targetHwnd,
                        ObsidianHwnd = obsidianHwnd,
                        ProcessId = targetPid,
                        OriginalParent = GetParent(targetHwnd),
                        OriginalOwner = GetWindowLongPtr(targetHwnd, GWLP_HWNDPARENT),
                        OriginalStyle = GetWindowLong32(targetHwnd, GWL_STYLE),
                        OriginalExStyle = GetWindowLong32(targetHwnd, GWL_EXSTYLE),
                        OriginalRect = rect,
                        WasMaximized = zoomed,
                        Mode = mode,
                        Borderless = borderless,
                        Opacity = Math.Max(20, Math.Min(100, opacity)),
                        RelX = x,
                        RelY = y,
                        Width = Math.Max(100, w),
                        Height = Math.Max(100, h),
                        Visible = true,
                        MinimizedByUser = false,
                        InputPassthrough = false
                    };
                    DockedWindows[key] = state;
                }
                else
                {
                    state.ObsidianHwnd = obsidianHwnd;
                    state.ProcessId = targetPid;
                    state.Mode = mode;
                    state.Borderless = borderless;
                    state.Opacity = Math.Max(20, Math.Min(100, opacity));
                    state.RelX = x;
                    state.RelY = y;
                    state.Width = Math.Max(100, w);
                    state.Height = Math.Max(100, h);
                    state.Visible = true;
                    state.MinimizedByUser = false;
                    state.InputPassthrough = false;
                }

                ApplyDockStyle(state);
                ApplyWindowPosition(state, true);
            }
            return true;
        }

        static void ApplyDockStyle(DockedWindowState state)
        {
            IntPtr hWnd = state.Hwnd;
            if (!IsWindow(hWnd)) return;

            if (IsIconic(hWnd))
            {
                ShowWindow(hWnd, SW_RESTORE);
            }

            SetWindowRgn(hWnd, IntPtr.Zero, false);

            int style = state.OriginalStyle;
            if (state.Borderless)
            {
                style &= ~(WS_CAPTION | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU | WS_BORDER);
            }

            if (state.Mode == "child")
            {
                SetWindowLongPtr(hWnd, GWLP_HWNDPARENT, IntPtr.Zero);
                style &= ~WS_POPUP;
                style |= WS_CHILD | WS_CLIPSIBLINGS | WS_CLIPCHILDREN;
                SetWindowLong32(hWnd, GWL_STYLE, style);
                SetParent(hWnd, state.ObsidianHwnd);

                uint targetTid, obsTid, dummy1, dummy2;
                targetTid = GetWindowThreadProcessId(hWnd, out dummy1);
                obsTid = GetWindowThreadProcessId(state.ObsidianHwnd, out dummy2);
                if (targetTid != 0 && obsTid != 0 && targetTid != obsTid)
                {
                    AttachThreadInput(targetTid, obsTid, true);
                }
            }
            else
            {
                if (GetParent(hWnd) == state.ObsidianHwnd)
                {
                    SetParent(hWnd, IntPtr.Zero);
                }
                style &= ~WS_CHILD;
                SetWindowLong32(hWnd, GWL_STYLE, style);
                SetWindowLongPtr(hWnd, GWLP_HWNDPARENT, state.ObsidianHwnd);
            }

            ApplyExtendedStyle(state);

            SetWindowPos(hWnd, IntPtr.Zero, 0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
        }

        static void ApplyWindowPosition(DockedWindowState state, bool forceFrameChanged)
        {
            if (!IsWindow(state.Hwnd) || !IsWindow(state.ObsidianHwnd)) return;

            bool obsMinimized = IsIconic(state.ObsidianHwnd);
            if (!state.Visible || state.MinimizedByUser || obsMinimized || state.Width <= 20 || state.Height <= 20)
            {
                ShowWindow(state.Hwnd, SW_HIDE);
                return;
            }

            if (IsIconic(state.Hwnd))
            {
                ShowWindow(state.Hwnd, SW_RESTORE);
            }

            int targetX = state.RelX;
            int targetY = state.RelY;

            if (state.Mode != "child")
            {
                SetWindowLongPtr(state.Hwnd, GWLP_HWNDPARENT, state.ObsidianHwnd);
                POINT pt = new POINT { X = 0, Y = 0 };
                ClientToScreen(state.ObsidianHwnd, ref pt);
                targetX += pt.X;
                targetY += pt.Y;
            }

            uint flags = SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_NOOWNERZORDER | SWP_NOSENDCHANGING;
            if (forceFrameChanged) flags |= SWP_FRAMECHANGED;

            SetWindowPos(state.Hwnd, HWND_TOP, targetX, targetY, state.Width, state.Height, flags);
            MoveWindow(state.Hwnd, targetX, targetY, state.Width, state.Height, true);
        }

        static void UpdateDockedRect(long hwndVal, int x, int y, int w, int h, bool visible, bool clearMinimized)
        {
            lock (SyncLock)
            {
                DockedWindowState state;
                if (DockedWindows.TryGetValue(hwndVal, out state))
                {
                    state.RelX = x;
                    state.RelY = y;
                    state.Width = w;
                    state.Height = h;
                    state.Visible = visible;
                    if (clearMinimized) state.MinimizedByUser = false;
                    ApplyWindowPosition(state, false);
                }
            }
        }

        static void RestoreMinimizedDockedWindow(long hwndVal)
        {
            lock (SyncLock)
            {
                DockedWindowState state;
                if (DockedWindows.TryGetValue(hwndVal, out state))
                {
                    state.MinimizedByUser = false;
                    state.Visible = true;
                    if (IsIconic(state.Hwnd))
                    {
                        ShowWindow(state.Hwnd, SW_RESTORE);
                    }
                    ApplyDockStyle(state);
                    ApplyWindowPosition(state, true);
                }
            }
        }

        static void UpdateDockedStyle(long hwndVal, string mode, bool borderless, int opacity)
        {
            lock (SyncLock)
            {
                DockedWindowState state;
                if (DockedWindows.TryGetValue(hwndVal, out state))
                {
                    if (!string.IsNullOrEmpty(mode)) state.Mode = mode;
                    state.Borderless = borderless;
                    if (opacity > 0) state.Opacity = Math.Max(20, Math.Min(100, opacity));
                    ApplyDockStyle(state);
                    ApplyWindowPosition(state, true);
                }
            }
        }

        static void UndockWindow(long hwndVal)
        {
            lock (SyncLock)
            {
                DockedWindowState state;
                if (DockedWindows.TryGetValue(hwndVal, out state))
                {
                    DockedWindows.Remove(hwndVal);
                    RestoreWindowState(state);
                }
            }
        }

        static void UndockAll()
        {
            lock (SyncLock)
            {
                foreach (var kv in DockedWindows)
                {
                    RestoreWindowState(kv.Value);
                }
                DockedWindows.Clear();
            }
        }

        static void RestoreWindowState(DockedWindowState state)
        {
            IntPtr hWnd = state.Hwnd;
            if (!IsWindow(hWnd)) return;

            try
            {
                uint targetTid, obsTid, d1, d2;
                targetTid = GetWindowThreadProcessId(hWnd, out d1);
                obsTid = GetWindowThreadProcessId(state.ObsidianHwnd, out d2);
                if (targetTid != 0 && obsTid != 0 && targetTid != obsTid)
                {
                    AttachThreadInput(targetTid, obsTid, false);
                }
            }
            catch { }

            SetWindowRgn(hWnd, IntPtr.Zero, false);

            if (IsIconic(hWnd))
            {
                ShowWindow(hWnd, SW_RESTORE);
            }

            SetParent(hWnd, state.OriginalParent);
            SetWindowLongPtr(hWnd, GWLP_HWNDPARENT, state.OriginalOwner);
            SetWindowLong32(hWnd, GWL_STYLE, state.OriginalStyle);
            int origEx = state.OriginalExStyle & ~WS_EX_TRANSPARENT;
            SetWindowLong32(hWnd, GWL_EXSTYLE, origEx);
            if ((origEx & WS_EX_LAYERED) != 0)
            {
                SetLayeredWindowAttributes(hWnd, 0, 255, LWA_ALPHA);
            }

            int w = Math.Max(300, state.OriginalRect.Right - state.OriginalRect.Left);
            int h = Math.Max(200, state.OriginalRect.Bottom - state.OriginalRect.Top);

            SetWindowPos(hWnd, IntPtr.Zero, state.OriginalRect.Left, state.OriginalRect.Top, w, h,
                SWP_NOZORDER | SWP_FRAMECHANGED | SWP_SHOWWINDOW);
            ShowWindow(hWnd, state.WasMaximized ? SW_SHOW : SW_SHOWNORMAL);
        }

        static void RunPickWindow(string reqId, IntPtr obsidianHwnd)
        {
            IsPicking = true;
            while (IsPicking && (GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0)
            {
                Thread.Sleep(20);
            }

            IntPtr lastHover = IntPtr.Zero;
            while (IsPicking && IsRunning)
            {
                if ((GetAsyncKeyState(VK_ESCAPE) & 0x8000) != 0)
                {
                    IsPicking = false;
                    SendJson(string.Format("{{\"id\":\"{0}\",\"ok\":false,\"cancelled\":true}}", EscapeJson(reqId)));
                    return;
                }

                POINT pt;
                if (GetCursorPos(out pt))
                {
                    IntPtr hWnd = WindowFromPoint(pt);
                    IntPtr root = GetAncestor(hWnd, GA_ROOT);
                    if (root != IntPtr.Zero && root != lastHover)
                    {
                        lastHover = root;
                        string hoverTitle = GetWindowTitle(root);
                        uint hoverPid;
                        GetWindowThreadProcessId(root, out hoverPid);
                        string hoverProc = GetProcessNameSafe(hoverPid);
                        SendJson(string.Format("{{\"event\":\"pick_hover\",\"hwnd\":\"{0}\",\"title\":\"{1}\",\"processName\":\"{2}\"}}",
                            root.ToInt64(), EscapeJson(hoverTitle), EscapeJson(hoverProc)));
                    }

                    if ((GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0)
                    {
                        IsPicking = false;
                        if (root != IntPtr.Zero && root != obsidianHwnd)
                        {
                            string title = GetWindowTitle(root);
                            uint pid;
                            GetWindowThreadProcessId(root, out pid);
                            string proc = GetProcessNameSafe(pid);
                            SendJson(string.Format("{{\"id\":\"{0}\",\"ok\":true,\"hwnd\":\"{1}\",\"title\":\"{2}\",\"processName\":\"{3}\"}}",
                                EscapeJson(reqId), root.ToInt64(), EscapeJson(title), EscapeJson(proc)));
                        }
                        else
                        {
                            SendJson(string.Format("{{\"id\":\"{0}\",\"ok\":false,\"cancelled\":true,\"reason\":\"Clicked Obsidian itself\"}}", EscapeJson(reqId)));
                        }
                        return;
                    }
                }
                Thread.Sleep(25);
            }
        }

        static void SyncLoop()
        {
            IntPtr draggingHwnd = IntPtr.Zero;
            RECT dragInitialRect = new RECT();
            bool wasMouseDown = false;
            string hoveredViewId = null;

            while (IsRunning)
            {
                try
                {
                    lock (SyncLock)
                    {
                        if (DockedWindows.Count > 0)
                        {
                            List<long> deadKeys = null;
                            foreach (var kv in DockedWindows)
                            {
                                var st = kv.Value;
                                if (!IsWindow(st.Hwnd))
                                {
                                    if (deadKeys == null) deadKeys = new List<long>();
                                    deadKeys.Add(kv.Key);
                                    continue;
                                }

                                if (IsIconic(st.Hwnd) && !IsIconic(st.ObsidianHwnd))
                                {
                                    ShowWindow(st.Hwnd, SW_RESTORE);
                                    ShowWindow(st.Hwnd, SW_HIDE);
                                    if (!st.MinimizedByUser)
                                    {
                                        st.MinimizedByUser = true;
                                        SendJson(string.Format("{{\"event\":\"window_minimized\",\"hwnd\":\"{0}\"}}", kv.Key));
                                    }
                                    continue;
                                }

                                if (st.MinimizedByUser)
                                {
                                    if (IsWindowVisible(st.Hwnd)) ShowWindow(st.Hwnd, SW_HIDE);
                                    continue;
                                }

                                if (st.Mode != "child" && st.Visible && IsWindow(st.ObsidianHwnd))
                                {
                                    if (IsIconic(st.ObsidianHwnd))
                                    {
                                        if (IsWindowVisible(st.Hwnd)) ShowWindow(st.Hwnd, SW_HIDE);
                                    }
                                    else
                                    {
                                        POINT pt = new POINT { X = 0, Y = 0 };
                                        ClientToScreen(st.ObsidianHwnd, ref pt);
                                        RECT curRect;
                                        GetWindowRect(st.Hwnd, out curRect);
                                        int expectedX = pt.X + st.RelX;
                                        int expectedY = pt.Y + st.RelY;
                                        int curW = curRect.Right - curRect.Left;
                                        int curH = curRect.Bottom - curRect.Top;

                                        if (Math.Abs(curRect.Left - expectedX) > 1 ||
                                            Math.Abs(curRect.Top - expectedY) > 1 ||
                                            Math.Abs(curW - st.Width) > 1 ||
                                            Math.Abs(curH - st.Height) > 1)
                                        {
                                            SetWindowPos(st.Hwnd, IntPtr.Zero, expectedX, expectedY, st.Width, st.Height,
                                                SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_NOOWNERZORDER | SWP_NOSENDCHANGING);
                                        }
                                    }
                                }
                            }

                            if (deadKeys != null)
                            {
                                foreach (long k in deadKeys)
                                {
                                    DockedWindows.Remove(k);
                                    SendJson(string.Format("{{\"event\":\"window_closed\",\"hwnd\":\"{0}\"}}", k));
                                }
                            }
                        }

                        if (DragZones.Count > 0 && !IsPicking)
                        {
                            bool mouseDown = (GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0;
                            IntPtr fg = GetForegroundWindow();

                            if (mouseDown)
                            {
                                if (!wasMouseDown)
                                {
                                    wasMouseDown = true;
                                    bool isObsidian = false;
                                    foreach (var dz in DragZones.Values)
                                    {
                                        if (fg == dz.ObsidianHwnd) { isObsidian = true; break; }
                                    }
                                    if (fg != IntPtr.Zero && !isObsidian && !DockedWindows.ContainsKey(fg.ToInt64()))
                                    {
                                        draggingHwnd = fg;
                                        GetWindowRect(fg, out dragInitialRect);
                                    }
                                    else
                                    {
                                        draggingHwnd = IntPtr.Zero;
                                    }
                                }
                                else if (draggingHwnd != IntPtr.Zero && IsWindow(draggingHwnd))
                                {
                                    RECT nowRect;
                                    GetWindowRect(draggingHwnd, out nowRect);
                                    bool moved = Math.Abs(nowRect.Left - dragInitialRect.Left) > 8 ||
                                                 Math.Abs(nowRect.Top - dragInitialRect.Top) > 8;
                                    if (moved)
                                    {
                                        POINT cursor;
                                        GetCursorPos(out cursor);
                                        string matchViewId = null;

                                        foreach (var dz in DragZones.Values)
                                        {
                                            if (!IsWindow(dz.ObsidianHwnd)) continue;
                                            POINT obsOrigin = new POINT { X = 0, Y = 0 };
                                            ClientToScreen(dz.ObsidianHwnd, ref obsOrigin);
                                            int zoneLeft = obsOrigin.X + dz.RelX;
                                            int zoneTop = obsOrigin.Y + dz.RelY;
                                            int zoneRight = zoneLeft + dz.Width;
                                            int zoneBottom = zoneTop + dz.Height;

                                            if (cursor.X >= zoneLeft && cursor.X <= zoneRight &&
                                                cursor.Y >= zoneTop && cursor.Y <= zoneBottom)
                                            {
                                                matchViewId = dz.ViewId;
                                                break;
                                            }
                                        }

                                        if (matchViewId != hoveredViewId)
                                        {
                                            hoveredViewId = matchViewId;
                                            string t = GetWindowTitle(draggingHwnd);
                                            SendJson(string.Format("{{\"event\":\"drag_hover\",\"viewId\":\"{0}\",\"inside\":{1},\"hwnd\":\"{2}\",\"title\":\"{3}\"}}",
                                                EscapeJson(matchViewId ?? ""), matchViewId != null ? "true" : "false", draggingHwnd.ToInt64(), EscapeJson(t)));
                                        }
                                    }
                                }
                            }
                            else if (wasMouseDown)
                            {
                                wasMouseDown = false;
                                if (hoveredViewId != null && draggingHwnd != IntPtr.Zero && IsWindow(draggingHwnd))
                                {
                                    string t = GetWindowTitle(draggingHwnd);
                                    uint pid;
                                    GetWindowThreadProcessId(draggingHwnd, out pid);
                                    string proc = GetProcessNameSafe(pid);
                                    SendJson(string.Format("{{\"id\":\"\",\"event\":\"drag_dropped\",\"viewId\":\"{0}\",\"hwnd\":\"{1}\",\"title\":\"{2}\",\"processName\":\"{3}\"}}",
                                        EscapeJson(hoveredViewId), draggingHwnd.ToInt64(), EscapeJson(t), EscapeJson(proc)));
                                }
                                hoveredViewId = null;
                                draggingHwnd = IntPtr.Zero;
                            }
                        }
                    }
                }
                catch { }

                Thread.Sleep(16);
            }
        }
    }
}
