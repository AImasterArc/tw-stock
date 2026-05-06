# 🇹🇼 台灣股市每日大數據自動化看板 (Taiwan Stock Automation Dashboard)

## 📂 MEMORY.md — 專案功能與技術架構備忘錄

本文件詳細記錄了目前 `tw-stock` 專案所實作的所有核心功能、底層技術細節、設計模式與自動化部署架構，以便作為後續迭代、維護與擴充之重要參考依據。

---

### 1. 專案概述 (Project Overview)

本專案是一個**高度自動化的台灣股市每日技術指標與法人籌碼監控看板**。其核心理念在於利用 Python 爬蟲，將分散在 Google Sheet 上的歷史與每日個股數據進行清洗與均線計算，轉化為高效、輕量的靜態 JSON 資料庫。
前端採用 **Vite + React + TypeScript + Lightweight Charts** 構建極致美觀的 SPA 圖表，並透過 **GitHub Actions** 實現每日定時拉取最新數據、自動編譯並部署至 GitHub Pages，達成零維護成本的現代化看盤應用。

---

### 2. 核心功能清單 (Core Features)

1. **大盤與櫃買指數追蹤 (Market & OTC Index Tracking)**
   - 每日追蹤並呈現 **加權指數 (TAEX)** 與 **櫃買指數 (TPEx)**。
   - 計算並繪製最新 K 線圖，以及 MA5、MA10、MA20、MA60 四條經典均線。
   - 提供右上角「最新更新時間」指示，精準掌握最新收盤日期。

2. **產業分類個股追蹤 (Industry Stock Tracking)**
   - 依照自定義的核心產業板塊（目前為 **PCB**、**散熱**、**石英**）對精選個股進行深度追蹤。
   - 單頁支援多檔核心成分股流暢切換。

3. **雙圖表上下堆疊同步 (Synchronized Stacked Charts) — 🚀 專業看盤體驗**
   - **主圖表 (高度 350px)**：展示主價格 K 線、移動平均線、成交量柱狀圖。
   - **副圖表 (高度 120px)**：獨立呈現外資與投信的**每日買賣超變化量**。
   - **時間軸滾動與縮放同步 (Zoom & Scroll Sync)**：當使用者在任何一張圖表上進行左右拖拽、滾動或手勢縮放時，兩張圖表會以 **100% 的同步率** 移動時間軸。
   - **跨圖表游標與數據同步 (Crosshair & Tooltip Sync)**：當滑鼠游標懸浮於任何一張圖表時，兩張圖表的十字線與左下角的「外資、投信、成交量 Legend」會完美同步更新當日數值。

4. **智慧法人回退邏輯 (Smart Fallback Logic)**
   - 若當日收盤後初期尚未公佈最新法人資料（數據為 0），系統不會顯示空白或全零，而是**自動往前尋找最近一日非零的有效法人數據**進行呈現，確保數據的連貫性。
   - 若整張圖表在 180 天內完全無 any 法人數據，則會安全呈現 `<Unknown>`。

5. **跌破均線智慧提醒 (Broken MA Alerts)**
   - 前端會動態比對「當日收盤價」與各條「移動平均線 (MA)」，若最新收盤價跌破 MA5、MA10、MA20 或 MA60，會於右上角以**亮橘色警示標籤**醒目列出（例如：`跌破: MA5`）。

6. **GitHub Pages 零碰撞部署 (Collision-Free SPA Deployment)**
   - 全網址加入 `tw-stock` 子路徑前綴，確保與其他個人專案發布 Pages 時網址絕不衝突。
   - 採用 `HashRouter` 徹底避免 GitHub Pages 靜態伺服器因 F5 重新整理導致的 404 路由失效問題。

---

### 3. 前端技術實現詳情 (Frontend Technical Stack)

* **圖表核心：TradingView Lightweight Charts (v4.x)**
  - 使用 Canvas 進行極致流暢的硬體加速渲染。
  - **同步實現細節**：
    在 [StockChart.tsx](file:///c:/Users/f2289/Arc/AI_Code/tw-stock/src/components/StockChart.tsx) 中：
    ```typescript
    // 利用 Flag 機制防堵 VisibleLogicalRange 雙向訂閱產生的無窮遞迴
    let isSyncingMain = false;
    let isSyncingSub = false;

    mainTimeScale.subscribeVisibleLogicalRangeChange((range) => {
      if (isSyncingSub) return;
      isSyncingMain = true;
      subTimeScale.setVisibleLogicalRange(range);
      isSyncingMain = false;
    });
    ```
  - **副圖表繪製**：採用 `addLineSeries` 建立外資與投信折線，並加上 `createPriceLine` 在 `y=0` 處繪製一條虛線作為基準線。

* **高質感 UI 系統 (Modern Glassmorphic UI)**
  - **極致深色面板**：主體底色採用 `#0f111a`，配卡片毛玻璃效果 `rgba(25, 28, 36, 0.7)` 搭配 `backdrop-filter: blur(16px)`。
  - **懸浮側邊欄 (Expandable Sidebar)**：純 CSS 動態側邊導覽，平時僅佔 80px（僅顯 icon），滑鼠 hover 時平滑展開至 240px 並顯現文字。
  - **台股經典配色**：買進與上漲使用高飽和紅色 (`#ef4444`)，賣出與下跌使用綠色 (`#22c55e`)。

---

### 4. 爬蟲與資料自動化 (Crawler & Data Automation)

* **Python 資料清洗腳本 (`scripts/fetch_data.py`)**：
  - **免去複雜 OAuth**：繞過繁瑣的 Google Sheets API 授權，直接利用 CSV 下載網址（`https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}`）高速、穩定地拉取大數據。
  - **指標預處理**：自動將抓取到的價格資料補全，並精準計算 `MA5`、`MA10`、`MA20`、`MA60` 數值。
  - **統一資料庫**：將大盤、櫃買指數及所有成分股資料打包壓縮至單一 `public/data.json` 靜態檔案，減少多個 HTTP 請求的開銷。

---

### 5. 自動化部署架構 (CI/CD Workflow)

* **GitHub Actions 流程 (`.github/workflows/deploy.yml`)**：
  1. 定時（或手動 push 時）觸發任務。
  2. 設定 Python 環境並自動執行 `fetch_data.py` 爬蟲，將最新的 Google Sheet 數據抓取並更新至 `public/data.json`。
  3. 安裝 Node 依賴，將整個 React 前端專案打包（指定 base 路徑為 `/tw-stock/`）。
  4. 一鍵發布至 `gh-pages` 分支，實現完全無痛的日更看盤網頁。

---

### 6. 專案目錄結構摘要 (Directory Structure)

```bash
tw-stock/
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions 部署工作流
├── public/
│   └── data.json           # 唯一資料庫 (爬蟲生成)
├── scripts/
│   └── fetch_data.py       # Python 爬蟲清洗程式
├── src/
│   ├── components/
│   │   └── StockChart.tsx  # 核心同步圖表元件
│   ├── App.tsx             # SPA 主要頁面架構與路由
│   ├── index.css           # 全域現代化暗色 Glassmorphism 樣式
│   └── main.tsx            # React 進入點
├── vite.config.ts          # Base path 設定 (/tw-stock/)
└── MEMORY.md               # 本備忘錄檔案
```

---
*備忘錄最後更新時間：2026-05-06 21:22:00*
