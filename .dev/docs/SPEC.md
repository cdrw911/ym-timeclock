# TimeClock 出勤系統規格說明（Spec）

> 版本：v2.0
> 更新日期：2025-11-18
> 架構：小型後端服務 + Web 後台 + Discord Bot + Google / Notion / Google Drive 整合
> 後端語言：TypeScript + Node.js
> DB：PostgreSQL（開發：本機；正式：Supabase / GCP）
> 前端：Web 後台（React / Next.js 類型）
> 部署：GCP + Docker（Cloud Run 或 GKE）

---

## 1. 目標與非目標

### 1.1 目標

- 精準紀錄實習生出勤事件（上班、下班、休息、實地、遠端）。
- 依管理規則，自動計算：
  - 每日工時（實地 / 遠端分開統計）
  - 遲到 / 早退 / 補打卡 / 請假統計
  - 扣分與當月出勤分數
- 提供：
  - 公開出勤看板（timeclock.vdo.tw）
  - 個人出勤頁面（token 驗證）
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
- **不追蹤自主學習時間**（已移除該功能）。

---

## 2. 系統架構總覽

### 2.1 元件

1. **Backend API**
   - 技術：Node.js + TypeScript（NestJS）
   - 功能：
     - REST API
     - 出勤事件寫入與計算
     - 請假 / 補打卡 / 扣分邏輯
     - 對外整合（Google / Notion / Discord）
     - 所有參數可配置（遲到寬限、扣分規則等）

2. **Database**
   - PostgreSQL
     - 開發：本機 Postgres（Docker）
     - 正式：Supabase 或 GCP Cloud SQL
   - ORM：Prisma

3. **Web 前台 / 後台**
   - 技術：React / Next.js（TypeScript）
   - 模組：
     - 公開首頁（出勤看板）
     - 個人頁面（打卡 + 紀錄，Token 驗證）
     - Admin 後台（管理員操作）

4. **Discord Bot**
   - 技術：Node.js + `discord.js`
   - 功能：
     - slash commands：打卡、查詢、請假申請入口、預先告知
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
   - 打卡（上班、下班、休息、實地、遠端）
   - 申請請假 / 補打卡
   - 預先告知遲到或請假
   - 上傳證明檔案
   - 查看個人出勤紀錄與扣分

2. **管理員 / 主管**
   - 查看所有實習生出勤紀錄與統計
   - 審核請假 / 補打卡
   - 手動調整紀錄（保留 audit log）
   - 設定班表與實習起訖日期
   - 調整系統參數（遲到寬限、扣分規則等）
   - 匯出報表（CSV / Excel）

3. **系統管理者（DevOps / Admin）**
   - 管理服務帳戶與 API 金鑰
   - 管理部署與備份策略
   - 管理系統設定檔

---

## 4. 功能需求（Functional Requirements）

### FR-1 出勤事件紀錄

- 支援事件類型：
  - `WORK_ONSITE_START`, `WORK_ONSITE_END` （實地上班）
  - `WORK_REMOTE_START`, `WORK_REMOTE_END` （遠端上班）
  - `BREAK_OFFSITE_START`, `BREAK_OFFSITE_END` （中途外出）
  - **移除**：~~`SELF_STUDY_START`, `SELF_STUDY_END`~~

- 每個事件至少包含：
  - user_id
  - event_type
  - timestamp（伺服器時間）
  - source（web / discord / admin / retro_approved）
  - metadata（如 IP、user agent）

### FR-2 日工時與遲到判定

- **標準工作時間**：
  - 上班：08:30
  - 下班：18:00
  - 午休：12:00 - 13:30（固定 1.5 小時，自動扣除）

- **每日計算邏輯**：
  - 將當日事件排序，配對 start/end 形成 segments。
  - 計算有效工作時間：
    - 實地與遠端分開統計
    - 僅計算在班表時間內的時段
  - 自動扣除午休 1.5 小時（若工作時段跨越午休）
  - 扣除中途外出時間（BREAK_OFFSITE）

- **遲到計算**：
  - 比對第一個 WORK_START 事件與排班時間
  - 寬限時間（預設 5 分鐘，可配置）
  - 記錄是否有預先告知

- **早退判定**：
  - 下班打卡時間 < 預定下班時間，即視為早退
  - 嚴格執行，無寬限時間

### FR-3 請假管理

- **功能**：
  - 實習生送出請假申請（含預先告知與正式申請）。
  - 管理員審核（approve / reject）。
  - 審核通過：
    - 寫入 DB
    - 呼叫 Google Calendar 新增/更新事件
    - 呼叫 Notion API 更新請假看板

- **預先告知系統**：
  - 支援透過 Discord Bot 或 Web 預先告知
  - 記錄預先告知時間與內容
  - 系統自動比對正式申請與預先告知

- **請假類型與規則**：
  - 符合管理規定文件（rules.md）所定義
  - 病假、生理假、事假、其他

### FR-4 補打卡管理

- **功能**：
  - 實習生送出補打卡申請：
    - 日期、時間、類型（實地/遠端/上班/下班/休息）
    - 原因、改善方案
    - 可上傳證明檔案（存 Google Drive）
  - 管理員審核：
    - 通過：寫入對應的 `AttendanceEvent`（source=retro_approved）
    - 駁回：紀錄理由，不修改原出勤
  - 審核通過後，重新計算當日 DaySummary 與扣分

- **系統需支援統計補打卡次數**（每月、累計）

### FR-5 扣分與評分引擎

- **可配置規則參數**（存於 DB 配置表）：
  - 遲到寬限時間（預設 5 分鐘）
  - 預先告知時限（預設 30 分鐘）
  - 各類遲到的扣分點數
  - 早退扣分（第一次 -3，第二次起 -5）
  - 補打卡次數門檻與扣分
  - 預先告知遲到的免扣分上限（預設 3 次/月）
  - 慣性遲到防濫用機制

- **每日或每次事件變動時更新**：
  - 當日狀態（DaySummary）
  - 當月出勤扣分與總分（ScoreRecord）

- **扣分明細追蹤**：
  - 原因、關聯事件、審核人、時間
  - 是否有預先告知
  - 改善計畫與追蹤

### FR-6 公開首頁（timeclock.vdo.tw）

- 顯示目前在職實習生列表：
  - 姓名（或代碼）、目前狀態（上班中 / 下班 / 請假 / 遠端…）
  - 簡易統計（本月出勤天數、遲到次數…）
- 可突出顯示：
  - 出勤優良榜
  - 需改善提醒區（呈現方式需注意不過度羞辱）
- 提供連結至個人頁面

### FR-7 個人頁面（timeclock.vdo.tw/{code}?token=xxx）

- **Token 驗證機制**：
  - 每位實習生有唯一 token
  - Token 定期更換（可配置週期）
  - 防止 URL 猜測或外洩

- **功能**：
  - 上班 / 下班 / 休息打卡操作（實地 / 遠端選擇）
  - 當日視圖：
    - 當日打卡紀錄與工時
    - 是否遲到 / 早退
    - 當日扣分（若有）
  - 歷史視圖：
    - 可選日期範圍查看出勤與扣分
    - 實地 / 遠端工時分開顯示
  - 請假 / 補打卡入口
  - 預先告知功能
  - 上傳證明檔案入口

### FR-8 班表與實習期間管理

- **班表設定流程**：
  1. 初始設定：依實習期間產生預覽班表
  2. 實習生確認後成為正式班表
  3. 支援每週不同時段（如週三因課程時間不同）

- **班表異動**：
  - 提前異動（1 個月前）：調整班表，不需請假
  - 臨時變動：走請假流程，影響出勤率

- **管理員可設定**：
  - 實習開始與結束日期
  - 每位實習生每週工作日與時段
  - 例外日期（國定假日、颱風假等）

- **系統依班表決定**：
  - 哪些日期需要出勤
  - 不排班的日子不計入遲到 / 缺勤

### FR-9 Discord Bot 功能

- **Slash Commands**：
  - `/in onsite` - 實地上班打卡
  - `/in remote` - 遠端上班打卡
  - `/out` - 下班打卡
  - `/break_start` - 休息開始
  - `/break_end` - 休息結束
  - `/leave` - 開啟請假申請（回覆 Web 表單連結）
  - `/retro_clock` - 補打卡申請（回覆 Web 表單連結）
  - `/advance_notice` - 預先告知遲到或請假
  - `/today` - 查詢今天出勤狀態
  - `/my_score` - 查詢本月出勤分數與扣分明細
  - `/my_stats` - 查詢本月統計（工時、遲到、請假）

- **通知功能**：
  - 上班時間過 15 分鐘未打卡 → 發 DM 提醒
  - 下班時間過 30 分鐘未打卡 → 發 DM 提醒
  - 管理員審核結果 → 通知申請人
  - 每週統計 → 在指定 Discord 頻道發公告
  - 每月初發佈上月出勤分數排行

### FR-10 Google / Notion / Google Drive 整合

- **Google Calendar**：
  - 使用服務帳戶管理「團隊行事曆」
  - 請假通過 → 新增/更新事件
  - 請假取消 → 刪除或標註事件

- **Notion**：
  - 固定 Database 作為請假看板
  - 每筆請假對應一列，欄位：
    - 員工、日期、類型、狀態、系統連結

- **Google Drive**：
  - 專用資料夾存放證明檔案
  - 每筆檔案記錄：
    - user_id、請假/補打卡 id、Drive file id

---

## 5. 資料模型（概略）

### 5.1 主要資料表

#### User
```prisma
- id: UUID
- code: String (如 I86)
- name: String
- email: String
- role: Enum (intern / admin)
- is_active: Boolean
- access_token: String (個人頁面 token)
- token_expires_at: DateTime
- discord_id: String (可選)
- google_account: String (可選)
- created_at: DateTime
- updated_at: DateTime
```

#### InternshipTerm
```prisma
- id: UUID
- user_id: UUID
- start_date: Date
- end_date: Date
- base_schedule: JSON
  格式：{
    "monday": {"start": "08:30", "end": "18:00"},
    "tuesday": {"start": "08:30", "end": "18:00"},
    "wednesday": {"start": "10:00", "end": "18:00"},
    ...
  }
- status: Enum (draft / confirmed / archived)
- created_at: DateTime
- updated_at: DateTime
```

#### AttendanceEvent
```prisma
- id: UUID
- user_id: UUID
- type: Enum (
    WORK_ONSITE_START, WORK_ONSITE_END,
    WORK_REMOTE_START, WORK_REMOTE_END,
    BREAK_OFFSITE_START, BREAK_OFFSITE_END
  )
- timestamp: DateTime
- source: Enum (web / discord / admin / retro_approved)
- related_request_id: UUID (可選，補打卡 id)
- metadata: JSON (IP, user_agent, etc.)
- created_at: DateTime
```

#### DaySummary
```prisma
- id: UUID
- user_id: UUID
- date: Date
- work_onsite_seconds: Int (實地工時秒數)
- work_remote_seconds: Int (遠端工時秒數)
- total_work_seconds: Int (總工時)
- scheduled_work_seconds: Int (應工作時數)
- is_late: Boolean
- late_minutes: Int
- is_early_leave: Boolean
- early_leave_minutes: Int
- is_absent: Boolean
- lunch_break_seconds: Int (午休扣除，預設 5400)
- break_offsite_seconds: Int (中途外出時間)
- has_advance_notice: Boolean (是否有預先告知)
- status_notes: String
- created_at: DateTime
- updated_at: DateTime
```

#### LeaveRequest
```prisma
- id: UUID
- user_id: UUID
- start_datetime: DateTime
- end_datetime: DateTime
- type: Enum (sick / menstrual / personal / other)
- reason: Text
- has_advance_notice: Boolean
- advance_notice_datetime: DateTime (可選)
- status: Enum (pending / approved / rejected)
- approver_id: UUID (可選)
- review_notes: Text (可選)
- calendar_event_id: String (可選)
- notion_page_id: String (可選)
- drive_file_ids: JSON (證明檔案)
- created_at: DateTime
- updated_at: DateTime
```

#### RetroClockRequest
```prisma
- id: UUID
- user_id: UUID
- date: Date
- time: Time
- type: Enum (
    work_onsite_start / work_onsite_end /
    work_remote_start / work_remote_end /
    break_start / break_end
  )
- reason: Text
- improvement_plan: Text
- status: Enum (pending / approved / rejected)
- approver_id: UUID (可選)
- review_notes: Text (可選)
- drive_file_ids: JSON (可選)
- created_at: DateTime
- updated_at: DateTime
```

#### ScoreRecord
```prisma
- id: UUID
- user_id: UUID
- year_month: String (YYYY-MM)
- base_score: Int (預設 100)
- total_deduction: Decimal
- bonus_points: Decimal (加分)
- final_score: Decimal
- status: Enum (calculating / final)
- created_at: DateTime
- updated_at: DateTime
```

#### ScoreDetail
```prisma
- id: UUID
- score_record_id: UUID
- reason_type: Enum (late / early_leave / absence / retro / misconduct / bonus)
- related_date: Date
- related_event_id: UUID (可選)
- points_delta: Decimal (負值為扣分，正值為加分)
- has_advance_notice: Boolean
- notes: Text
- created_at: DateTime
```

#### AdvanceNotice
```prisma
- id: UUID
- user_id: UUID
- notice_type: Enum (late / leave)
- expected_date: Date
- expected_minutes: Int (預計遲到分鐘數，可選)
- reason: String
- source: Enum (web / discord / teams)
- is_used: Boolean (是否已對應實際事件)
- related_event_id: UUID (可選)
- created_at: DateTime
```

#### SystemConfig
```prisma
- id: UUID
- key: String (唯一，如 "late_grace_minutes")
- value: String (JSON 格式)
- category: String (如 "attendance_rules")
- description: Text
- updated_by: UUID
- updated_at: DateTime
```

#### AuditLog
```prisma
- id: UUID
- user_id: UUID (操作者)
- action: String (如 "approve_leave", "adjust_score")
- target_type: String (如 "LeaveRequest")
- target_id: UUID
- changes: JSON (變更內容)
- created_at: DateTime
```

---

## 6. API（概略列舉）

> 僅列出主要路由，實作時可再細化。

### 6.1 使用者端 API

#### 打卡相關
- `POST /api/clock/in` - 上班打卡
  - Body: `{ type: 'onsite' | 'remote' }`
- `POST /api/clock/out` - 下班打卡
- `POST /api/clock/break-start` - 休息開始
- `POST /api/clock/break-end` - 休息結束

#### 預先告知
- `POST /api/advance-notice` - 提交預先告知
  - Body: `{ type: 'late' | 'leave', date, expected_minutes?, reason }`

#### 請假 / 補打卡
- `POST /api/leave` - 提交請假申請
- `POST /api/retro-clock` - 提交補打卡申請
- `POST /api/upload/proof` - 上傳證明檔案

#### 查詢
- `GET /api/me/today` - 查詢今日出勤狀態
- `GET /api/me/day-summary?date=YYYY-MM-DD` - 查詢特定日期
- `GET /api/me/month-summary?month=YYYY-MM` - 查詢當月統計
- `GET /api/me/score?month=YYYY-MM` - 查詢當月分數與扣分明細
- `GET /api/me/schedule` - 查詢個人班表

### 6.2 管理端 API

#### 使用者管理
- `GET /api/admin/users` - 使用者列表
- `GET /api/admin/users/:id` - 使用者詳情
- `POST /api/admin/users/:id/reset-token` - 重置 token

#### 出勤查詢
- `GET /api/admin/attendance?user_id=&date_range=` - 出勤記錄查詢
- `GET /api/admin/day-summary?user_id=&date=` - 特定日期詳情

#### 請假管理
- `GET /api/admin/leave-requests?status=pending` - 請假申請列表
- `POST /api/admin/leave-requests/:id/approve` - 核准請假
- `POST /api/admin/leave-requests/:id/reject` - 駁回請假

#### 補打卡管理
- `GET /api/admin/retro-requests?status=pending` - 補打卡申請列表
- `POST /api/admin/retro-requests/:id/approve` - 核准補打卡
- `POST /api/admin/retro-requests/:id/reject` - 駁回補打卡

#### 班表管理
- `POST /api/admin/schedule` - 建立/更新班表
- `GET /api/admin/schedule/:user_id` - 查詢使用者班表
- `POST /api/admin/schedule/:id/confirm` - 確認班表

#### 手動調整
- `POST /api/admin/attendance/manual-adjust` - 手動調整出勤記錄
- `POST /api/admin/score/adjust` - 手動調整分數

#### 統計與報表
- `GET /api/admin/scores?month=YYYY-MM` - 當月分數統計
- `GET /api/admin/report/export?month=YYYY-MM&format=csv` - 匯出報表

#### 系統設定
- `GET /api/admin/config` - 查詢系統參數
- `PUT /api/admin/config/:key` - 更新系統參數

### 6.3 公開 / 半公開 API

- `GET /api/public/board` - 公開看板資料
- `GET /api/public/user/:code/summary?token=xxx` - 個人頁面資料（Token 驗證）

---

## 7. 認證與安全性

### 7.1 Token 驗證方式（第一階段）

- **個人頁 URL**：`/{code}?token=xxx`
- **Token 特性**：
  - 每位使用者有唯一 token
  - Token 定期更換（預設 30 天，可配置）
  - Token 儲存於 DB，加密處理
- **緩解措施**：
  - Token 長度足夠（至少 32 字元）
  - 記錄每次 token 使用（IP、時間）
  - 異常使用偵測（短時間內多 IP 存取）
  - 使用者可主動要求重置 token

### 7.2 Admin API 認證

- 使用 JWT (JSON Web Token)
- 管理員登入後取得 token
- 所有 admin API 需驗證 token 與權限

### 7.3 進階登入（第二階段）

- 支援：
  - Discord OAuth2
  - Google OAuth2
- 流程：
  - 使用者登入 → 授權 → 後端綁定 `user_id`
- 優點：
  - 無需記密碼、避免代打卡
  - 可與 Discord Bot 整合

---

## 8. 非功能性需求（NFR）

- **可用性**：
  - 平日上班時間目標可用率 ≥ 99%

- **效能**：
  - 單次打卡 API 延遲目標 < 300ms（不含外部 API）
  - 日工時計算 < 100ms

- **安全**：
  - 所有外部連線使用 HTTPS
  - 機敏設定（API Key、Service Account）存於 GCP Secret Manager
  - Token 加密儲存

- **備份**：
  - DB 每日自動備份
  - 保留 30 天備份

- **稽核**：
  - 所有管理端操作需有 audit log
  - 記錄內容：操作者、時間、變更內容

---

## 9. 開發與部署流程

### 9.1 開發環境（Mac）

使用 Docker Compose：
```yaml
services:
  backend:  # NestJS
  db:       # PostgreSQL
  admin-frontend:  # Next.js
  discord-bot:  # Node.js
```

使用 Prisma migration 管理 schema。

### 9.2 CI/CD

- push 到 main / release 分支 → 自動 build Docker image
- 執行測試通過後 → 部署到 GCP Cloud Run

### 9.3 正式環境

- **Backend / Bot**：
  - Docker image 跑在 Cloud Run

- **DB**：
  - Supabase / Cloud SQL

- **靜態前端**：
  - 部署於 Cloud Run 或 Cloud Storage + CDN

---

## 10. 第一階段實作範圍（Phase 1）

### 10.1 必須實作

#### 後端核心
- [x] Prisma Schema 設計與 migration
- [x] 基本 NestJS 專案架構
- [x] Docker Compose 開發環境
- [x] 打卡 API（上班/下班/休息，實地/遠端）
- [x] 工時計算引擎（含午休扣除、中途外出）
- [x] 遲到/早退判定邏輯
- [x] Token 驗證機制

#### 請假與補打卡
- [x] 預先告知功能（API + DB）
- [x] 請假申請與審核流程
- [x] 補打卡申請與審核流程
- [x] 審核通過後重新計算 DaySummary

#### 扣分引擎
- [x] 基本扣分計算（遲到、早退、補打卡）
- [x] 預先告知優惠機制
- [x] 系統參數配置（SystemConfig 表）
- [x] 扣分明細追蹤

#### Discord Bot
- [x] 基本打卡指令（/in, /out, /break_start, /break_end）
- [x] 查詢指令（/today, /my_score）
- [x] 預先告知指令（/advance_notice）
- [x] 審核結果通知

#### 外部整合
- [x] Google Calendar API 整合
- [x] Notion API 整合
- [x] Google Drive 檔案上傳

#### Web 前端（簡易版）
- [x] 個人頁面（Token 驗證）
  - 打卡按鈕
  - 今日出勤顯示
  - 當月統計
- [x] 管理後台（基本）
  - 請假審核
  - 補打卡審核
  - 出勤記錄查詢

### 10.2 暫緩至第二階段

- 公開看板排行榜
- Discord Bot 的定期統計公告
- 班表異動申請流程（先手動調整）
- 改善計畫追蹤系統
- OAuth2 登入
- 匯出 PDF 報表

---

## 11. 後續可擴充功能（Phase 2+）

### 11.1 異常偵測

自動標記：
- 只有上班沒下班打卡
- 只有下班沒上班打卡
- 工時異常過短或過長
- 異常使用 token 的 IP 位址

### 11.2 進階統計

- 個人月報表（PDF / CSV）
- 小隊長視圖（只看負責的實習生）
- 趨勢分析（遲到改善趨勢）
- 預測模型（預警可能問題）

### 11.3 規則配置介面

管理者可在後台調整：
- 遲到寬限
- 各類違規扣分點數
- 預告期限等參數
- 減少修改程式碼的頻率

### 11.4 行動裝置優化

- PWA（Progressive Web App）
- 推播通知（Push Notification）
- 離線支援

---

## 12. 系統參數配置示例

以下為 SystemConfig 表的預設參數：

| Key | Value | Category | Description |
|-----|-------|----------|-------------|
| `work_start_time` | `"08:30"` | schedule | 標準上班時間 |
| `work_end_time` | `"18:00"` | schedule | 標準下班時間 |
| `lunch_start_time` | `"12:00"` | schedule | 午休開始時間 |
| `lunch_end_time` | `"13:30"` | schedule | 午休結束時間 |
| `late_grace_minutes` | `5` | rules | 遲到寬限時間（分鐘） |
| `advance_notice_minutes` | `30` | rules | 預先告知時限（分鐘） |
| `advance_notice_late_limit` | `3` | rules | 預先告知遲到免扣分上限（次/月） |
| `late_points_with_notice` | `{"<=30": 0, ">30": -1}` | scoring | 預先告知遲到扣分 |
| `late_points_no_notice` | `{"<=30": -1, "30-60": -2, ">60": -3}` | scoring | 未預先告知遲到扣分 |
| `early_leave_first_time` | `-3` | scoring | 第一次早退扣分 |
| `early_leave_repeat` | `-5` | scoring | 第二次起早退扣分 |
| `retro_clock_limit` | `{"1-2": 0, "3-4": -1, ">=5": -2}` | scoring | 補打卡扣分規則 |
| `perfect_attendance_bonus` | `3` | scoring | 全勤獎勵 |
| `token_expiry_days` | `30` | security | Token 過期天數 |

---

## 附錄：版本更新記錄

**v2.0** (2025-11-18)：
- 移除自主學習功能
- 新增 Token 驗證機制
- 明確第一階段實作範圍
- 新增預先告知系統
- 強化班表管理規則
- 新增颱風假相關規定
- 所有參數改為可配置
- 實地/遠端工時分開統計
- 新增 AdvanceNotice、SystemConfig、AuditLog 資料表

**v1.0**：初始版本
