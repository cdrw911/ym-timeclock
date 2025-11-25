# TimeClock Backend API

> 出勤打卡系統後端 API - Phase 1 Implementation

## 技術棧

- **Framework**: NestJS 10.x
- **Database**: PostgreSQL 16
- **ORM**: Prisma 5.x
- **Language**: TypeScript 5.x
- **Authentication**: JWT
- **Integrations**: Discord.js, Google APIs, Notion API

## 快速開始

### 前置需求

- Node.js 20.x
- Docker & Docker Compose
- pnpm (推薦) 或 npm

### 安裝依賴

```bash
npm install
```

### 環境變數設定

```bash
cp .env.example .env
# 編輯 .env 填入必要的環境變數
```

### 啟動開發環境（使用 Docker）

```bash
# 啟動資料庫 + 後端
docker-compose up -d

# 查看日誌
docker-compose logs -f backend
```

### 本機開發（不使用 Docker）

```bash
# 啟動 PostgreSQL（需要獨立安裝或使用 Docker）
docker-compose up -d db

# 生成 Prisma Client
npm run prisma:generate

# 執行資料庫遷移
npm run prisma:migrate

# 啟動開發伺服器
npm run start:dev
```

## 資料庫管理

### Prisma Studio（圖形化介面）

```bash
npm run prisma:studio
```

### 建立新的 Migration

```bash
npx prisma migrate dev --name <migration-name>
```

### 重置資料庫（開發環境）

```bash
npx prisma migrate reset
```

### 資料庫初始化（Seed）

```bash
npm run prisma:seed
```

## API 文件

### 健康檢查

```
GET /api/health
```

### 打卡相關 API

```
POST /api/clock/in          # 上班打卡
POST /api/clock/out         # 下班打卡
POST /api/clock/break-start # 休息開始
POST /api/clock/break-end   # 休息結束
```

### 個人查詢 API

```
GET /api/me/today                        # 今日出勤狀態
GET /api/me/day-summary?date=YYYY-MM-DD  # 特定日期摘要
GET /api/me/month-summary?month=YYYY-MM  # 當月統計
GET /api/me/score?month=YYYY-MM          # 當月分數
```

### 管理端 API（需要 Admin 權限）

```
GET  /api/admin/users                      # 使用者列表
GET  /api/admin/leave-requests?status=...  # 請假申請列表
POST /api/admin/leave-requests/:id/approve # 核准請假
POST /api/admin/leave-requests/:id/reject  # 駁回請假
```

### 系統設定 API（需要 Admin 權限）

```
GET /api/admin/config              # 取得所有系統設定
GET /api/admin/config/:key         # 取得特定設定
PUT /api/admin/config/:key         # 更新特定設定
```

## 專案結構

```
backend/
├── prisma/
│   └── schema.prisma           # 資料庫 Schema
├── src/
│   ├── auth/                   # 認證模組（JWT）
│   ├── users/                  # 使用者模組
│   ├── attendance/             # 出勤模組（打卡、工時計算）
│   ├── leave/                  # 請假模組
│   ├── retro-clock/            # 補打卡模組
│   ├── score/                  # 評分引擎
│   ├── advance-notice/         # 預先告知模組
│   ├── system-config/          # 系統設定模組
│   ├── integrations/           # 外部整合（Google, Notion）
│   ├── discord-bot/            # Discord Bot
│   ├── prisma/                 # Prisma 服務
│   ├── common/                 # 共用工具
│   ├── app.module.ts
│   └── main.ts
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## 系統設定參數

所有系統參數都可透過 API 動態調整，無需重啟服務：

### 排班設定 (schedule)
- `work_start_time`: 標準上班時間（預設 08:30）
- `work_end_time`: 標準下班時間（預設 18:00）
- `lunch_start_time`: 午休開始（預設 12:00）
- `lunch_end_time`: 午休結束（預設 13:30）

### 規則設定 (rules)
- `late_grace_minutes`: 遲到寬限時間（預設 5 分鐘）
- `advance_notice_minutes`: 預先告知時限（預設 30 分鐘）
- `advance_notice_late_limit`: 預先告知遲到免扣分上限（預設 3 次/月）

### 評分設定 (scoring)
- `late_points_with_notice`: 預先告知遲到扣分規則
- `late_points_no_notice`: 未預先告知遲到扣分規則
- `early_leave_first_time`: 第一次早退扣分（預設 -3）
- `early_leave_repeat`: 第二次起早退扣分（預設 -5）
- `retro_clock_limit`: 補打卡扣分規則
- `perfect_attendance_bonus`: 全勤獎勵（預設 +3）

### 安全設定 (security)
- `token_expiry_days`: Token 過期天數（預設 30）

## 開發指令

```bash
# 開發模式
npm run start:dev

# 建置
npm run build

# 生產模式
npm run start:prod

# 測試
npm run test
npm run test:watch
npm run test:cov

# Lint & Format
npm run lint
npm run format
```

## Phase 1 實作範圍

✅ 已完成：
- [x] Prisma Schema 設計
- [x] Docker Compose 開發環境
- [x] 基本 NestJS 架構
- [x] Auth 模組（JWT + Token 驗證）
- [x] SystemConfig 模組（可配置參數）
- [x] Users 模組

🚧 進行中：
- [ ] Attendance 模組（打卡 + 工時計算）
- [ ] Leave 模組（請假流程）
- [ ] RetroC lock 模組（補打卡）
- [ ] Score 模組（評分引擎）
- [ ] AdvanceNotice 模組（預先告知）
- [ ] Discord Bot
- [ ] 外部整合（Google Calendar/Notion/Drive）

## 部署

### 建置 Docker Image

```bash
docker build -t timeclock-backend:latest .
```

### 部署至 GCP Cloud Run

```bash
# 標記 image
docker tag timeclock-backend:latest gcr.io/[PROJECT-ID]/timeclock-backend:latest

# 推送至 GCR
docker push gcr.io/[PROJECT-ID]/timeclock-backend:latest

# 部署
gcloud run deploy timeclock-backend \
  --image gcr.io/[PROJECT-ID]/timeclock-backend:latest \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated
```

## License

UNLICENSED - Internal use only
