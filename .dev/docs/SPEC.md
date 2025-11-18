## 三、系統規格（Spec.md）

```markdown
# TimeClock 出勤系統規格說明（Spec）

> 版本：v1.0  
> 架構：小型後端服務 + Web 後台 + Discord Bot + Google / Notion / Google Drive 整合  
> 後端語言：TypeScript + Node.js  
> DB：PostgreSQL（開發：本機；正式：Supabase / GCP）  
> 前端：Web 後台（React / Next.js 類型）  
> 部署：GCP + Docker（Cloud Run 或 GKE）

---

## 1. 目標與非目標

### 1.1 目標

- 精準紀錄實習生出勤事件（上班、下班、休息、遠端、自主學習）。
- 依管理規則，自動計算：
  - 每日工時
  - 遲到 / 早退 / 補打卡 / 請假統計
  - 扣分與當月出勤分數
- 提供：
  - 公開出勤看板（timeclock.vdo.tw）
  - 個人出勤頁面
  - 管理後台（審核、調整、統計）
- 整合：
  - Discord Bot（打卡、提醒、公告）
  - Google Calendar（請假事件）
  - Notion 看板（請假記錄）
  - Google Drive（上傳請假證明 / 補打卡證明）

### 1.2 非目標

- 不處理薪資計算（只輸出出勤資料供其他系統使用）。
- 不作為正式 HR 系統（僅支援實習與簡單兼職情境）。
- 不支援高度複雜的班表（輪班制等），只針對「固定或簡單排班」。

---

## 2. 系統架構總覽

### 2.1 元件

1. **Backend API**
   - 技術：Node.js + TypeScript（建議使用 NestJS）
   - 功能：
     - REST / GraphQL API
     - 出勤事件寫入與計算
     - 請假 / 補打卡 / 扣分邏輯
     - 對外整合（Google / Notion / Discord）

2. **Database**
   - PostgreSQL
     - 開發：本機 Postgres（Docker）
     - 正式：Supabase 或 GCP Cloud SQL
   - ORM：Prisma

3. **Web 前台 / 後台**
   - 技術：React / Next.js（TypeScript）
   - 模組：
     - 公開首頁（出勤看板）
     - 個人頁面（打卡 + 紀錄）
     - Admin 後台（管理員操作）

4. **Discord Bot**
   - 技術：Node.js + `discord.js`
   - 功能：
     - slash commands：打卡、查詢、請假申請入口
     - 通知：提醒打卡、請假審核結果、每週統計公告

5. **外部整合**
   - Google Calendar API：請假通過後，建立/更新事件。
   - Notion API：同步請假看板（卡片）。
   - Google Drive API：上傳請假與補打卡證明（檔案）。

6. **部署**
   - 開發：
     - Docker Compose：Backend + DB + Admin 前端
   - 正式：
     - Build Docker Image
     - 部署到 GCP Cloud Run（或 GKE）
     - DB 使用 Supabase / Cloud SQL

---

## 3. 使用者角色與權限

1. **實習生 / 一般使用者**
   - 打卡（上班、下班、休息、遠端、自主學習）
   - 申請請假 / 補打卡
   - 上傳證明檔案
   - 查看個人出勤紀錄與扣分

2. **管理員 / 主管**
   - 查看所有實習生出勤紀錄與統計
   - 審核請假 / 補打卡
   - 手動調整紀錄（保留 audit log）
   - 設定班表與實習起訖日期
   - 匯出報表（CSV / Excel）

3. **系統管理者（DevOps / Admin）**
   - 管理服務帳戶與 API 金鑰
   - 管理部署與備份策略
   - 管理系統設定檔（如遲到寬限、扣分規則）

---

## 4. 功能需求（Functional Requirements）

### FR-1 出勤事件紀錄

- 支援事件類型：
  - `WORK_ONSITE_START`, `WORK_ONSITE_END`
  - `WORK_REMOTE_START`, `WORK_REMOTE_END`
  - `SELF_STUDY_START`, `SELF_STUDY_END`
  - `BREAK_OFFSITE_START`, `BREAK_OFFSITE_END`
- 每個事件至少包含：
  - user_id
  - event_type
  - timestamp（伺服器時間）
  - source（web / discord / admin / retro）
  - metadata（如 IP、user agent）

### FR-2 日工時與遲到判定

- 每日計算邏輯：
  - 將當日事件排序，配對 start/end 形成 segments。
  - 計算有效工作時間：
    - 實地 + 遠端 + 自主學習（依規則權重可不同）。
  - 自動扣除午休 1.5 小時。
- 遲到計算：
  - 比對第一個 WORK_START 事件與排班時間。
- 早退判定：
  - 實際工時顯著低於預定工時，且未經同意。

### FR-3 請假管理

- 功能：
  - 實習生送出請假申請（含預告與正式）。
  - 管理員審核（approve / reject）。
  - 審核通過：
    - 寫入 DB
    - 呼叫 Google Calendar 新增/更新事件
    - 呼叫 Notion API 更新請假看板
- 請假類型與規則：
  - 符合管理規定文件（rules.md）所定義。

### FR-4 補打卡管理

- 功能：
  - 實習生送出補打卡申請：
    - 日期、時間、類型、原因、改善方案。
    - 可上傳證明檔案（存 Google Drive）。
  - 管理員審核：
    - 通過：寫入對應的 `AttendanceEvent`（source=retro_approved）。
    - 駁回：紀錄理由，不修改原出勤。
- 系統需支援統計補打卡次數。

### FR-5 扣分與評分引擎

- 將 rules.md 中的規則轉為可配置參數：
  - 遲到時間區間 → 對應扣分。
  - 是否預先告知 → 套用不同條件。
  - 補打卡次數門檻。
- 每日或每次事件變動時更新：
  - 當日狀態
  - 當月出勤扣分與總分
- 需保留扣分明細：
  - 原因、關聯事件、審核人、時間。

### FR-6 公開首頁（timeclock.vdo.tw）

- 顯示目前在職實習生列表：
  - 姓名（或代碼）、目前狀態（上班中 / 下班 / 請假 / 遠端…）
  - 簡易統計（本月出勤天數、遲到次數…）
- 可突出顯示：
  - 出勤優良榜。
  - 遲到或補打卡異常提醒區（呈現方式需注意不過度羞辱）。
- 提供連結至個人頁面。

### FR-7 個人頁面（timeclock.vdo.tw/{code}）

- 功能：
  - 上班 / 下班 / 休息打卡操作。
  - 當日視圖：
    - 當日打卡紀錄與工時。
    - 是否遲到 / 早退。
    - 當日扣分（若有）。
  - 歷史視圖：
    - 可選日期範圍查看出勤與扣分。
  - 請假 / 補打卡入口。
  - 上傳證明檔案入口。

### FR-8 班表與實習期間管理

- 管理員可設定：
  - 實習開始與結束日期。
  - 每位實習生預定上班時間與每週工作日。
- 系統依班表決定：
  - 哪些日期需要出勤。
  - 不排班的日子不計入遲到 / 缺勤。

### FR-9 Discord Bot 功能

- Slash Commands（示意）：
  - `/in` 上班打卡
  - `/out` 下班打卡
  - `/break_start` 休息開始
  - `/break_end` 休息結束
  - `/leave` 開啟請假申請入口（回覆表單網址或互動式表單）
  - `/retro_clock` 補打卡申請入口
  - `/today` 查詢今天出勤狀態
  - `/my_score` 查詢本月出勤分數與扣分明細
- 通知：
  - 上班時間過 N 分鐘未打卡 → 發 DM 提醒。
  - 管理員審核結果 → 通知申請人。
  - 每週統計 → 在指定 Discord 看板頻道發公告。

### FR-10 Google / Notion / Google Drive 整合

- Google Calendar：
  - 使用服務帳戶或專用帳號管理「團隊行事曆」。
  - 請假通過 → 新增/更新事件。
  - 請假取消 → 刪除或標註事件。

- Notion：
  - 一個固定 Database 作為請假看板。
  - 每一筆請假對應一頁或一列，欄位包含：
    - 員工、日期、類型、狀態、連結到系統紀錄。

- Google Drive：
  - 專用資料夾存放證明檔案。
  - 每筆檔案記錄：
    - 所屬 user_id
    - 關聯請假 / 補打卡申請 id
    - Drive file id

---

## 5. 資料模型（概略）

### 5.1 主要資料表（示意）

- `User`
  - id
  - code（如 I86）
  - name
  - email
  - role（intern / admin）
  - is_active
  - discord_id（可選）
  - google_account（可選）

- `InternshipTerm`
  - id
  - user_id
  - start_date
  - end_date
  - base_schedule (JSON：每週何時上班)

- `AttendanceEvent`
  - id
  - user_id
  - type（enum）
  - timestamp
  - source（web / discord / admin / retro）
  - related_request_id（補打卡 / 請假 id）
  - created_at

- `DaySummary`
  - id
  - user_id
  - date
  - total_work_seconds
  - is_late
  - late_minutes
  - is_early_leave
  - is_absent
  - status_notes

- `LeaveRequest`
  - id
  - user_id
  - start_datetime
  - end_datetime
  - type
  - reason
  - status（pending / approved / rejected）
  - approver_id
  - calendar_event_id
  - notion_page_id
  - created_at
  - updated_at

- `RetroClockRequest`
  - id
  - user_id
  - date
  - time
  - type
  - reason
  - improvement_plan
  - status
  - approver_id
  - drive_file_id

- `ScoreRecord`
  - id
  - user_id
  - month
  - base_score
  - total_deduction
  - final_score

- `ScoreDetail`
  - id
  - score_record_id
  - reason_type（late / absence / retro / misconduct）
  - related_date
  - related_event_id
  - points_delta（負值為扣分）
  - notes

---

## 6. API（概略列舉）

> 僅列出主要路由，實作時可再細化。

### 6.1 使用者端 API

- `POST /api/clock/in`
- `POST /api/clock/out`
- `POST /api/clock/break-start`
- `POST /api/clock/break-end`
- `POST /api/leave`
- `POST /api/retro-clock`
- `GET  /api/me/day-summary?date=YYYY-MM-DD`
- `GET  /api/me/month-summary?month=YYYY-MM`

### 6.2 管理端 API

- `GET  /api/admin/users`
- `GET  /api/admin/attendance?user_id=&date_range=`
- `GET  /api/admin/leave-requests?status=pending`
- `POST /api/admin/leave-requests/{id}/approve`
- `POST /api/admin/leave-requests/{id}/reject`
- `GET  /api/admin/retro-requests?status=pending`
- `POST /api/admin/retro-requests/{id}/approve`
- `POST /api/admin/retro-requests/{id}/reject`
- `POST /api/admin/attendance/manual-adjust`
- `GET  /api/admin/scores?month=YYYY-MM`
- `GET  /api/admin/report/export?month=YYYY-MM`

### 6.3 公開 / 半公開 API

- `GET /api/public/board`  
  - 回傳在職實習生的簡單出勤統計給首頁使用。
- `GET /api/public/user/{code}/summary`  
  - 個人頁面資料（需做基本防護，如簡易簽章或限縮資訊）。

---

## 7. 認證與安全性

### 7.1 簡易識別方式（短期）

- 個人頁 URL：`/I86`  
- 風險：
  - URL 若被猜到或外流，可能被他人代為打卡。
- 緩解措施（建議）：
  - 加一層簡單 token（例如 `/u/I86?token=xxx`）並定期更換。
  - 嚴禁共享個人連結，違者依規定處理。

### 7.2 進階登入（中長期建議）

- 支援：
  - Discord OAuth2
  - Google OAuth2
- 流程：
  - 使用者登入 → 授權 → 後端綁定 `user_id`。
- 優點：
  - 無需記密碼、避免代打卡。
- Side effect：
  - 實作成本增加，需要申請與維護 OAuth 憑證。

---

## 8. 非功能性需求（NFR）

- 可用性：
  - 平日上班時間目標可用率 ≥ 99%。
- 效能：
  - 單次打卡 API 延遲目標 < 300ms（不含外部 API）。
- 安全：
  - 所有外部連線需使用 HTTPS。
  - 機敏設定（API Key、Service Account）存於 GCP Secret Manager 或同等機制。
- 備份：
  - DB 每日自動備份。
- 稽核：
  - 所有管理端操作需有 audit log。

---

## 9. 開發與部署流程

1. 開發環境（Mac）
   - 使用 Docker Compose：
     - `backend`（NestJS）
     - `db`（PostgreSQL）
     - `admin-frontend`（Next.js）
   - 使用 Prisma migration 管理 schema。

2. CI/CD
   - push 到 main / release 分支 → 自動 build Docker image。
   - 執行測試通過後 → 部署到 GCP Cloud Run。

3. 正式環境
   - Backend / Bot：
     - Docker image 跑在 Cloud Run。
   - DB：
     - Supabase / Cloud SQL。
   - 靜態前端：
     - 部署於 Cloud Run 或 Cloud Storage + CDN。

---

## 10. 後續可擴充功能（建議）

1. **異常偵測**
   - 自動標記：
     - 只有上班沒下班打卡。
     - 只有下班沒上班打卡。
     - 工時異常過短或過長。

2. **匿名求助 / 反饋**
   - 在系統中保留匿名求助管道，對應你們原本表單的功能。

3. **個人月報表**
   - 一鍵產出 PDF / CSV，提供給實習生自存或附在實習證明。

4. **群組 / 小隊長視圖**
   - 小隊長只看到自己負責的實習生，避免資訊過度公開。

5. **規則配置介面**
   - 管理者可在後台調整：
     - 遲到寬限
     - 每一種違規的扣分點數
     - 預告期限等參數
   - 減少改 code 的頻率。

````

---

如果你要開始實作，下一步可以直接從：

* 把 rules.md & manual.md 放進 Notion/Repo 當「制度文件」
* 在 `Spec.md` 的基礎上先實作：
  **User / AttendanceEvent / DaySummary / LeaveRequest** 這幾張表 + `/in` `/out` `/leave` API + 最簡單的個人頁面

之後需要，我也可以幫你把 Prisma schema 或 NestJS module skeleton 寫出來。
