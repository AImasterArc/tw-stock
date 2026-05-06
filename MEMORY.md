# 看對產業買飆股 (Taiwan Stock Automation Dashboard)

## 📂 MEMORY.md — 專案功能與技術架構備忘錄

本文件詳細記錄了目前 `tw-stock` 專案所實作的所有核心功能、底層技術細節、設計模式與自動化部署架構，以便作為後續迭代、維護與擴充之重要參考依據。

---

### 1. 專案概述 (Project Overview)

本專案是一個**高度自動化的台灣股市每日技術指標與法人籌碼監控看板**。其核心理念在於利用 Python 爬蟲，將分散在 Google Sheet 上的歷史與每日個股數據進行清洗與均線計算，轉化為高效、輕量的靜態 JSON 資料庫。
前端採用 **Vite + React + TypeScript + Lightweight Charts** 構建極致美觀的 SPA 圖表，並透過 **GitHub Actions** 實現每日定時拉取最新數據、自動編譯並部署至 GitHub Pages，達成零維護成本的現代化看盤應用。

網頁官方名稱已全面更名為：**「看對產業買飆股」**。

---

### 2. 核心功能清單 (Core Features)

1. **大盤與櫃買指數追蹤 (Market & OTC Index Tracking)**
   - 每日追蹤並呈現 **加權指數 (TAEX)** 與 **櫃買指數 (TPEx)**。
   - 計算並繪製最新 K 線圖，以及 MA5、MA10、MA20、MA60 四條經典均線。
   - 提供右上角「最新更新時間」指示，精準掌握最新收盤日期。

2. **產業分類個股追蹤 (Industry Stock Tracking)**
   - 依照自定義的核心產業板塊（目前為 **PCB**、**散熱**、**石英**）對精選個股進行深度追蹤。
   - 單頁支援多檔核心成分股流暢切換。

3. **三圖表上下堆疊同步 (Three-way Stacked Charts) — 🚀 極致看盤體驗**
   - **主圖表 (高度 300px)**：展示主價格 K 線、移動平均線、成交量柱狀圖。
   - **外資副圖 (高度 100px)**：以**紅色（買超）與綠色（賣超）的柱狀圖 (Histogram)** 呈現外資每日買賣超張數（Shares / 1000）。
   - **投信副圖 (高度 110px)**：以**紅色（買超）與綠色（賣超）的柱狀圖 (Histogram)** 呈現投信每日買賣超張數（Shares / 1000）。
   - **等比例對稱比例尺 (Aligned & Aligned Y-Axis Scale)**：外資與投信副圖採用**完全一致且對稱的 Y 軸比例尺（由數據中的絕對最大值 `absMax` 動態計算）**。這樣做確保了 Y=0 基準線始終置於圖表中央，且兩大法人買賣超力道的視覺對比百分之百精確。
   - **時間軸滾動與縮放同步 (Zoom & Scroll Sync)**：三張圖表（主圖 + 兩張副圖）的時間軸 **100% 同步** 縮放與滾動。
   - **跨圖表游標與數據同步 (Crosshair & Tooltip Sync)**：游標懸浮在三張圖中的任何一個位置，所有圖表的十字線與左下角的「外資、投信、成交量 Legend」都會在對應日期精確對齊並同步更新數值。
   - **技術圖寬度完全一致 (Pixel-Perfect Alignment)**：利用 rightPriceScale 的 `minimumWidth: 80` 屬性，確保三張圖的右側價格/張數軸寬度一致，進而實現主圖、副圖1、副圖2 繪圖區在水平方向上的絕對對齊。

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
  - **三圖同步實現細節**：
    在 [StockChart.tsx](file:///c:/Users/f2289/Arc/AI_Code/tw-stock/src/components/StockChart.tsx) 中：
    ```typescript
    // 利用 Flag 機制防堵 VisibleLogicalRange 雙向訂閱產生的無窮遞迴
    let isSyncing = false;
    const syncCharts = (range: any, excludeScale: any) => {
      if (isSyncing) return;
      isSyncing = true;
      const scales = [chart.timeScale()];
      if (subChart1) scales.push(subChart1.timeScale());
      if (subChart2) scales.push(subChart2.timeScale());
      scales.forEach(scale => {
        if (scale !== excludeScale) {
          scale.setVisibleLogicalRange(range);
        }
      });
      isSyncing = false;
    };
    ```
  - **副圖表對稱比例尺鎖定**：
    ```typescript
    const fLots = institutionalData.map(item => (item.foreign || 0) / 1000);
    const tLots = institutionalData.map(item => (item.trust || 0) / 1000);
    const allLots = [...fLots, ...tLots];
    const absMax = Math.max(...allLots.map(Math.abs));
    const sharedMax = absMax > 0 ? absMax * 1.15 : 100;
    const sharedMin = -sharedMax;
    ```
    接著在 `foreignSeries` 與 `trustSeries` 內使用 `autoscaleInfoProvider` 鎖定該範圍，實現完美一致的比對。

* **高質感 UI 系統 (Modern Glassmorphic UI)**
  - **極致深色面板**：主體底色採用 `#0f111a`，配卡片毛玻璃效果 `rgba(25, 28, 36, 0.7)` 搭配 `backdrop-filter: blur(16px)`。
  - **懸浮側邊欄 (Expandable Sidebar)**：純 CSS 動態側邊導覽，主標題更名為 **「看對產業買飆股」**，平時僅佔 80px，滑鼠 hover 時平滑展開至 240px。

---

### 4. 爬蟲與資料自動化 (Crawler & Data Automation)

* **Python 資料清洗腳本 (`scripts/fetch_data.py`)**：
  - **免去複雜 OAuth**：繞過繁瑣的 Google Sheets API 授權，直接利用 CSV 下載網址（`https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}`）高速、穩定地拉取大數據。
  - **指標預處理**：自動將抓取到的價格資料補全，並精準計算 `MA5`、`MA10`、`MA20`、`MA60` 數值。
  - **統一資料庫**：將大盤、櫃買指數及所有成分股資料打包壓縮至單一 `public/data.json` 靜態檔案。

---

### 5. 自動化部署架構 (CI/CD Workflow)

* **GitHub Actions 流程 (`.github/workflows/deploy.yml`)**：
  1. 定時（或手動 push 時）觸發任務。
  2. 設定 Python 環境並自動執行 `fetch_data.py` 爬蟲，將最新的 Google Sheet 數據抓取並更新至 `public/data.json`。
  3. 安裝 Node 依賴，將整個 React 前端專案打包（指定 base 路徑為 `/tw-stock/`）。
  4. 一鍵發布至 `gh-pages` 分支。

---
*備忘錄最後更新時間：2026-05-06 21:33:00*
