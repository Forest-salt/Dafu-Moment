# 大福食刻 DAFU MOMENT

**大福食刻 DAFU MOMENT** —— 福州大学校园就餐点评平台（团队「知食份子」出品）。围绕学生就餐决策提供 **查、评、藏** 一站式闭环：查点位/档口/菜品、多维度评分点评、收藏想吃清单；配套 AI 助手「福宝」（评价即知识库）与点位众包提交审核，纯内容平台，**不做外卖、下单、支付**。

- 中文名 **大福食刻**，英文名 **DAFU MOMENT**（DAFU＝大福拼音，取传统福气的「大福」；MOMENT＝食刻，记录美食瞬间）
- 品牌口径：知食份子 · 大福食刻 DAFU MOMENT

## 功能特性

- **四类点位**：校内食堂 / 永嘉天地 / 学生街 / 周边其他（`canteen.type` 0-3），每点位带人均价 `avg_price`，地图选点校位后台拖拽即存
- **维度化评分**：7 个评分维度（口味 1.5 / 份量 / 价格实惠 / 排队 / 环境 / 配送 / 包装 0.5），按点位类型动态适配适用维度；提交分项 1-5 整数，服务端加权计算 `overall_score`，适用性校验拒绝填错维度
- **普通平均聚合**：`review_summary` 记录评价数、平均分、分项求和与 1-5 星直方图，发布/处置即时重算
- **想吃收藏**：菜品 / 档口 / 点位一键「想吃」，个人清单集中管理
- **DFA 敏感词机审**：命中 1 级词替换后直接发布，2/3 级词转人工审核队列（通过 / 下架 / 驳回，处置必填理由并通知作者）
- **举报-申诉-通知闭环**：学生举报 → 管理端处理（可连带下架）→ 举报人与作者均收通知；被下架评价可申诉复审
- **档口公告与负责人回应**：负责人可发档口公告（上新/换菜/休摊/优惠）、公开回应差评
- **AI 助手「福宝」**：评价即知识库——仅注入平台真实点位与高分评价摘录，系统提示严禁虚构；用户可在「我的 → AI 设置」自配 OpenAI 兼容模型，未配置时自动降级为规则推荐
- **点位众包提交**：学生提交新点位 / 新档口 / 新菜品（payload 结构化），管理端审核通过后写入主表，驳回附理由并通知
- **管理后台**：内容维护 / 审核队列 / 举报处理 / 用户治理 / 敏感词库 / 点位提交审核 / 数据看板（日评价量、举报日量、评分分布、审核吞吐）

## 技术栈

| 层 | 选型 |
|--|--|
| 前端 | Vue 3 + Element Plus + ECharts（按需引入）+ Leaflet（高德 wprd 高清栅格底图） |
| 后端 | Node.js（Express）单体分层 + JWT |
| 存储 | mysql2 + MySQL 8（手写 SQL 唯一真相源）+ Redis（限流/缓存）+ MinIO（图床） |
| 部署 | Docker Compose 五容器（mysql / redis / minio / backend / frontend） |

## 数据库（16 表）

| 表 | 说明 |
|--|--|
| user | 用户（角色/状态/AI 自配 JSON） |
| canteen | 点位（四类型 type、人均 avg_price、经纬度） |
| station | 档口（挂靠点位、负责人、休摊状态） |
| dish | 菜品（价格、口味/忌口标签） |
| review_dimension | 评分维度配置（键名/权重/适用点位类型） |
| review | 评价（dimension_scores JSON + 服务端计算的 overall_score，状态机 0 已发布/1 待人工/2 已下架/3 已驳回） |
| review_image | 评价图片（MinIO objectKey） |
| review_summary | 聚合（评价数/平均分 rating_avg/分项求和 dim_sums/1-5 星直方图） |
| favorite | 收藏（想吃，一人一对象一条） |
| report | 举报（open/resolved/rejected） |
| station_post | 档口公告 |
| banned_word | 敏感词库（DFA 机审词源，1/2/3 级） |
| notification | 站内通知（审核/举报/禁言等） |
| review_reply | 档口负责人对评价的公开回应 |
| point_submit | 点位众包提交（submit_type 0 点位/1 档口/2 菜品，payload JSON，audit_status 0 待审/1 通过/2 驳回） |
| ai_conversation | AI 问答留痕（复盘用） |

## API 概览（前缀 `/api`，统一 `{code, msg, data}` 响应）

- **认证**：`POST /auth/register`、`POST /auth/login`、`GET /auth/me`
- **浏览**：`GET /canteens`（type 筛选）、`GET /canteens/:id`、`GET /stations/:id`、`GET /dishes`（多维筛选/排序）、`GET /dishes/:id`、`GET /categories`
- **评价**：`GET /reviews?subjectType&subjectId`、`POST /reviews`（dimensionScores）、`PUT /reviews/:id`、`DELETE /reviews/:id`、`POST /reviews/:id/vote`、`POST /reviews/:id/appeal`、`POST /reviews/:id/reply`、`GET /me/reviews`
- **收藏**：`POST /favorites`、`GET /favorites`、`GET /me/favorites`
- **搜索与推荐**：`GET /search?q=`（点位/档口/菜品三分组）、`GET /recommendations`（top 高分口碑 / forYou 为你推荐）
- **维度**：`GET /dimensions`、`GET /dimensions?type=`（按点位类型过滤）
- **AI**：`POST /ai/ask`、`GET /ai/history`、`GET /me/ai-config`、`PUT /me/ai-config`
- **点位提交**：`POST /points-submit`
- **上传**：`POST /uploads`（单图 ≤3MB）
- **通知与举报**：`GET /notifications`、`POST /notifications/read`、`POST /reports`
- **档口负责人**：`GET /manager/stations/:id/summary`、`POST /manager/stations/:id/posts`
- **管理端**（role=1）：`GET /admin/audit/pending`、`POST /admin/audit/:reviewId`（pass/fold/ban）、`GET|POST /admin/point-submits`、`POST /admin/point-submits/:id/approve|reject`、`GET|POST /admin/canteens`、`PUT /admin/canteens/:id(/status|/position)`、`GET|POST /admin/stations`、`PUT /admin/stations/:id(/status|/manager)`、`GET|POST /admin/dishes`、`PUT /admin/dishes/:id/status`、`GET /admin/reports`、`POST /admin/reports/:id/handle`、`GET /admin/users`、`POST /admin/users/:id/status`、`GET|POST /admin/words`、`DELETE /admin/words/:id`、`GET|POST /admin/posts`、`DELETE /admin/posts/:id`、`GET /admin/dashboard`、`POST /admin/maintenance/recalc`

## 快速开始

```bash
cd 60-项目代码
docker compose up -d --build
```

等待 1-2 分钟（首次启动自动建表、载入种子数据），然后访问：

- 平台入口（前台与后台）：<http://localhost:8095>
- 本地 API 端口：<http://localhost:3000>（健康检查 `/api/health`）

### 演示账号

| 角色 | 账号 | 密码 | 说明 |
|--|--|--|--|
| 管理员 | `admin` | `admin123` | 内容维护 / 审核队列 / 举报 / 用户治理 / 点位提交审核 / 看板 |
| 学生 | `zhangwl` | `123456` | 点评 / 收藏 / 举报 / AI 助手 / 点位提交 |

## AI 配置说明

AI 助手「福宝」按以下优先级取用 OpenAI 兼容供应商：

1. **学生自配**（优先级更高）：登录后进入「我的 → AI 设置」，填写 Base URL / API Key / 模型名（如 DeepSeek 等 OpenAI 兼容服务）；API Key 仅掩码回显，可随时清空
2. **平台环境变量兜底**：在 `docker-compose.yml` / backend 环境中配置

   ```env
   AI_BASE_URL=https://api.deepseek.com   # OpenAI 兼容 Base URL
   AI_API_KEY=sk-xxxx                     # 密钥（请使用环境变量，勿写入版本库）
   AI_MODEL=deepseek-chat                 # 模型名
   ```

3. **未配置任何供应商**：AI 助手自动降级为规则推荐——基于平台真实评分数据（价格带/忌口/外卖意图解析）直接给出推荐卡，功能始终可用

## 福大统一身份认证（CAS）真实接入

SSO 为**双模式自动切换**（r51）：`FZU_CAS_BASE_URL` + `FZU_CAS_SERVICE` 两项环境变量齐备 → 真实 CAS 3.0 协议（302 跳校方登录页 → ticket 回调 → `serviceValidate` 验票）；任一缺失 → 演示桩（学号 + 口令模拟校验，答辩口径）。**两种模式共用同一套数据模型与接口协议，切换零改码。**

真实接入三步：

1. **申请接入**（制度前置，非技术问题）：福大统一身份认证平台（sso.fzu.edu.cn）**强制 service 回调白名单**——未注册的 service 直接进 service-error 页（已实测）。需向校网络安全与信息化办公室（网信办）提交应用接入申请，注册回调地址（须公网可达，课程演示通常以部署域名申请）。
2. **填入凭证**（下发后）：`docker-compose.yml` backend 环境或部署 env 中配置——

   ```env
   FZU_CAS_BASE_URL=https://sso.fzu.edu.cn/cas   # 校方发放的 CAS 根地址（登录页 ${base}/login，验票 ${base}/serviceValidate，以接入文档为准）
   FZU_CAS_SERVICE=https://你的域名/auth/fzu/callback   # 校方白名单注册的回调地址，须与登录时完全一致
   FZU_CAS_VALIDATE_PATH=/serviceValidate         # 可选：CAS 2.0 默认；CAS 3.0 为 /p3/serviceValidate
   ```

   重启 backend 即切真实模式（`GET /api/auth/fzu/cas/mode` 返回 `real` + loginUrl）。
3. **链路验证**：`node tests/walkthrough-r52-fzu-cas.test.mjs` ——自带本地模拟 CAS 服务器（/cas/login 发票 + /cas/serviceValidate 一次性验票），完整走通「302 跳板 → 校方登录 → ticket 回调 → XML 身份解析 → JWT 签发 → 票据一次性防重放」七项断言，无需等待校方凭证即可证明协议实现正确。

## 测试

需容器在跑（`docker compose up -d --build` 且健康）：

```bash
node tests/api-integration.test.mjs   # API 集成断言（IT 编号用例，node 直跑）
node tests/e2e-verify.test.mjs        # E2E 验收 + 三视口回归（E2E 编号用例）
```

## 目录结构

```
60-项目代码
├── docker-compose.yml        # 五容器编排，对外端口 8095
├── backend
│   ├── sql/init.sql          # 16 张表 DDL + 种子
│   ├── Dockerfile
│   └── src
│       ├── config.js         # 环境变量 + 数值常量（AI 配置/限流/缓存）
│       ├── db                # mysql2 池 / Redis（降级包装）/ MinIO
│       ├── middleware        # JWT 鉴权 / 限流 / 错误码
│       ├── services          # 内容/点评/维度/机审/聚合/AI/用户数据/档口/后台 九大服务
│       └── seed              # 拟真种子：校内食堂 + 永嘉天地 + 学生街 + 周边商户
├── frontend
│   ├── Dockerfile + nginx.conf   # 多阶段构建，/api 与 /img 反代
│   └── src
│       ├── views             # 前台页面 + /admin 后台四页（看板/审核/内容/治理）
│       ├── components        # 自研组件（品牌 logo/封面上传/评价卡…）
│       └── api               # axios 解包拦截器 + 按域 API（含 admin 专用）
└── tests
    ├── api-integration.test.mjs   # API 集成断言（IT 编号用例，node 直跑）
    └── e2e-verify.test.mjs        # E2E 验收（E2E 编号用例 + 三视口回归）
```
