-- =====================================================================
-- 大福食刻 · MySQL 初始化脚本（22 表，依据 03-详细设计 §二 v2.0）
-- 引擎 InnoDB / utf8mb4；时间一律 DATETIME（服务器时间）
-- v2.0 口径：点位四类型（canteen.type）+ 维度配置驱动分项评分 + AI 会话留痕
--           删除排队热度 / 榜单快照旧表；收藏仅保留「想吃」语义
-- v2.1 口径：user.last_login_at / canteen.created_by+tags / dish.is_recommended /
--           review.like_count + review_like 点赞表（03 §2 表设计补齐）
-- 注意：中文数据行一律由 seed.js 参数化插入（initdb 通道按 latin1 解析会损坏中文）
-- =====================================================================

CREATE DATABASE IF NOT EXISTS dafu DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE dafu;

-- 1. 用户表
CREATE TABLE IF NOT EXISTS `user` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `username` VARCHAR(32) NOT NULL UNIQUE COMMENT '登录名',
    `password` VARCHAR(72) NOT NULL COMMENT 'bcryptjs',
    `nickname` VARCHAR(32) NOT NULL COMMENT '展示名',
    `email` VARCHAR(128) NULL COMMENT '邮箱（个人资料选填）',
    `avatar` TINYINT NOT NULL DEFAULT 0 COMMENT '预设头像编号',
    `avatar_object_key` VARCHAR(255) NULL COMMENT '自定义头像 MinIO objectKey',
    `fzu_uid` VARCHAR(16) NULL UNIQUE COMMENT '福大统一身份认证学号/工号（绑定后唯一，SSO 登录凭据）',
    `fzu_name` VARCHAR(32) NULL COMMENT 'CAS 返回的真实姓名（福大认证头衔展示）',
    `fzu_verified` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0 未认证 / 1 已绑定福大统一身份认证',
    `ai_config` JSON NULL COMMENT 'AI 自定义配置 {baseUrl,apiKey,model}（OpenAI 兼容）',
    `role` TINYINT NOT NULL DEFAULT 0 COMMENT '0 学生 / 1 管理员',
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0 正常 / 1 禁言 / 2 封禁',
    `muted_until` DATETIME NULL COMMENT '禁言到期时间',
    `last_login_at` DATETIME NULL COMMENT '最近登录时间（登录成功写入）',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间（审计/看板趋势基准）'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 2. 点位表（校内食堂 + 永嘉天地 + 学生街 + 周边统一建模，type 区分）
CREATE TABLE IF NOT EXISTS `canteen` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `name` VARCHAR(64) NOT NULL UNIQUE COMMENT '如「旗山校区·京元餐厅」',
    `type` TINYINT NOT NULL DEFAULT 0 COMMENT '0 校内食堂 / 1 永嘉天地 / 2 学生街 / 3 周边其他',
    `campus` VARCHAR(32) NOT NULL DEFAULT '旗山校区',
    `location` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '楼栋/方位描述',
    `avg_price` DECIMAL(6, 1) NULL COMMENT '人均消费（元）',
    `lat` DECIMAL(10, 6) NULL COMMENT '地图纬度（GCJ-02 火星坐标，后台拖拽校准）',
    `lng` DECIMAL(10, 6) NULL COMMENT '地图经度（GCJ-02 火星坐标，后台拖拽校准）',
    `cover_object_key` VARCHAR(255) NULL COMMENT 'MinIO objectKey',
    `tags` JSON NULL COMMENT '标签数组，如 ["清真","平价"]，忌口筛选与推荐用',
    `created_by` BIGINT UNSIGNED NULL COMMENT '录入人（后台创建记管理员 / 提交审核通过记提交人）',
    `enabled` TINYINT NOT NULL DEFAULT 1 COMMENT '上下架开关：1 在架 / 0 下架'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 3. 档口表（食堂档口 / 商铺默认档口）
CREATE TABLE IF NOT EXISTS `station` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `canteen_id` INT NOT NULL,
    `name` VARCHAR(64) NOT NULL COMMENT '如「三楼麻辣香锅」',
    `category` VARCHAR(32) NOT NULL DEFAULT '' COMMENT '品类（筛选用）',
    `cover_object_key` VARCHAR(255) NULL COMMENT '封面图 MinIO objectKey',
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0 营业 / 1 休摊 / 2 下架',
    `manager_user_id` BIGINT NULL COMMENT '档口负责人',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_canteen` (`canteen_id`, `status`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 4. 菜品表（评价第一公民）
CREATE TABLE IF NOT EXISTS `dish` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `station_id` INT NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `price` DECIMAL(6, 1) NOT NULL DEFAULT 0 COMMENT '元',
    `taste_tags` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '口味：偏辣,少油…',
    `taboo_tags` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '忌口：清真,素食,无香菜,无葱蒜',
    `is_recommended` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '推荐菜标记（管理员标记/聚合修正）',
    `cover_object_key` VARCHAR(255) NULL,
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0 在售 / 1 下架',
    `first_seen_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上新时间（新品排序口径）',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_station` (`station_id`, `status`),
    KEY `idx_price` (`status`, `price`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 5. 评分维度配置表（分项评分由配置驱动，前端按点位类型动态渲染）
CREATE TABLE IF NOT EXISTS `review_dimension` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `dimension_key` VARCHAR(32) NOT NULL UNIQUE COMMENT '维度键，写入 review.dimension_scores',
    `dimension_name` VARCHAR(32) NOT NULL COMMENT '展示名，如「口味」',
    `applicable_types` JSON NOT NULL COMMENT '适用的点位类型数组，如 [0,1,2,3]',
    `weight` DECIMAL(3, 2) NOT NULL DEFAULT 1.00 COMMENT '聚合总分权重',
    `sort` INT NOT NULL DEFAULT 0 COMMENT '表单展示顺序'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 6. 评价表（多态评价，核心表；分项得分 JSON + 权重加权总分）
CREATE TABLE IF NOT EXISTS `review` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `subject_type` TINYINT NOT NULL COMMENT '0 菜品 / 1 档口 / 2 点位',
    `subject_id` INT NOT NULL,
    `overall_score` DECIMAL(2, 1) NOT NULL COMMENT '总分 = Σ(分项×权重)/Σ权重，1.0-5.0',
    `dimension_scores` JSON NOT NULL COMMENT '分项得分，如 {"taste":5,"portion":4}，键须过维度适用性校验',
    `content` VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '文字',
    `is_anonymous` TINYINT NOT NULL DEFAULT 0 COMMENT '匿名同学',
    `tags` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '推荐,踩雷,量大…',
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0 已发布 / 1 待人工 / 2 已下架 / 3 已驳回',
    `status_reason` VARCHAR(200) NOT NULL DEFAULT '' COMMENT '处置理由（通知用户用）',
    `up_count` INT NOT NULL DEFAULT 0 COMMENT '有用投票（冗余计数）',
    `down_count` INT NOT NULL DEFAULT 0 COMMENT '没用投票（冗余计数）',
    `like_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '点赞数（review_like 冗余计数）',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_one_review` (`user_id`, `subject_type`, `subject_id`) COMMENT '一人一对象一条（防刷硬约束）',
    KEY `idx_list` (`subject_type`, `subject_id`, `status`, `created_at`),
    KEY `idx_user` (`user_id`, `created_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 7. 评价图片表
CREATE TABLE IF NOT EXISTS `review_image` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `review_id` BIGINT NOT NULL,
    `object_key` VARCHAR(255) NOT NULL COMMENT 'MinIO 路径',
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0 正常 / 1 违规（连带评价下架）',
    KEY `idx_review` (`review_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 8. 聚合表（读路径主力，多态；对已发布评价做普通平均，无加权无衰减）
CREATE TABLE IF NOT EXISTS `review_summary` (
    `subject_type` TINYINT NOT NULL,
    `subject_id` INT NOT NULL,
    `review_count` INT NOT NULL DEFAULT 0 COMMENT '已发布数',
    `sum_score` DECIMAL(10, 2) NOT NULL DEFAULT 0 COMMENT 'Σ overall_score',
    `rating_avg` DECIMAL(3, 2) NOT NULL DEFAULT 0 COMMENT '普通平均分',
    `dim_sums` JSON NULL COMMENT '分项求和 {"taste":48,…}，均分 = dim_sums/review_count',
    `hist_1` INT NOT NULL DEFAULT 0,
    `hist_2` INT NOT NULL DEFAULT 0,
    `hist_3` INT NOT NULL DEFAULT 0,
    `hist_4` INT NOT NULL DEFAULT 0,
    `hist_5` INT NOT NULL DEFAULT 0,
    `recalc_at` DATETIME NULL COMMENT '最近重算时间（观测漂移）',
    PRIMARY KEY (`subject_type`, `subject_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 9. 收藏表（仅「想吃」一种语义，一对象一条）
CREATE TABLE IF NOT EXISTS `favorite` (
    `user_id` BIGINT NOT NULL,
    `subject_type` TINYINT NOT NULL,
    `subject_id` INT NOT NULL,
    `list_type` TINYINT NOT NULL DEFAULT 0 COMMENT '0 想吃（唯一收藏语义，保留列位兼容）',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`, `subject_type`, `subject_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 9.1 点赞表（v2.1 补齐：一人一赞，review.like_count 冗余计数的数据源）
CREATE TABLE IF NOT EXISTS `review_like` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL COMMENT '点赞人',
    `review_id` BIGINT NOT NULL COMMENT '被赞评价',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_user_review` (`user_id`, `review_id`) COMMENT '一人一赞硬约束',
    KEY `idx_review` (`review_id`) COMMENT '按评价聚合点赞人与计数'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 10. 举报表
CREATE TABLE IF NOT EXISTS `report` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `reporter_id` BIGINT NOT NULL,
    `subject_type` TINYINT NOT NULL,
    `subject_id` INT NOT NULL COMMENT '此处为 review.id',
    `reason` TINYINT NOT NULL COMMENT '1 垃圾广告 / 2 人身攻击 / 3 虚假信息 / 4 抄袭搬运 / 5 其他',
    `detail` VARCHAR(300) NOT NULL DEFAULT '',
    `status` VARCHAR(16) NOT NULL DEFAULT 'open' COMMENT 'open/resolved/rejected',
    `handled_by` BIGINT NULL,
    `handled_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_status` (`status`, `created_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 11. 档口动态公告表
CREATE TABLE IF NOT EXISTS `station_post` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `station_id` INT NOT NULL,
    `author_id` BIGINT NOT NULL,
    `type` VARCHAR(16) NOT NULL COMMENT 'new_dish/menu_change/away/promo',
    `content` VARCHAR(200) NOT NULL,
    `starts_at` DATETIME NULL,
    `ends_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_station` (`station_id`, `created_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 12. 敏感词表（DFA 词库源；1 替换后发布 / 2、3 转人工审核）
CREATE TABLE IF NOT EXISTS `banned_word` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `word` VARCHAR(64) NOT NULL UNIQUE,
    `level` TINYINT NOT NULL COMMENT '1 替换 / 2 进人工 / 3 进人工（严重）'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 13. 通知表（处置/申诉/举报结果）
CREATE TABLE IF NOT EXISTS `notification` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `type` VARCHAR(32) NOT NULL COMMENT 'audit/mute/ban/report/reply/appeal',
    `title` VARCHAR(100) NOT NULL,
    `content` VARCHAR(500) NOT NULL DEFAULT '',
    `ref_type` VARCHAR(32) NULL,
    `ref_id` BIGINT NULL,
    `read_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_user` (`user_id`, `created_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 14. 档口负责人回应表（1:1）
CREATE TABLE IF NOT EXISTS `review_reply` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `review_id` BIGINT NOT NULL UNIQUE,
    `user_id` BIGINT NOT NULL,
    `content` VARCHAR(500) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 15. 点位提交审核表（用户提交新点位/档口/菜品，管理员审核后写入主表）
CREATE TABLE IF NOT EXISTS `point_submit` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `submitter_id` BIGINT NOT NULL COMMENT '提交人',
    `submit_type` TINYINT NOT NULL COMMENT '0 点位 / 1 档口 / 2 菜品',
    `target_id` INT NULL COMMENT '挂靠对象（提交档口时为点位 ID，提交菜品时为档口 ID）',
    `payload` JSON NOT NULL COMMENT '提交内容（结构同对应主表字段）',
    `audit_status` TINYINT NOT NULL DEFAULT 0 COMMENT '0 待审 / 1 通过 / 2 驳回',
    `auditor_id` BIGINT NULL COMMENT '审核管理员',
    `audit_comment` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '审核意见',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_status` (`audit_status`, `created_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 16. AI 会话表（AI 助手问答留痕，仅复盘用不参与核心链路）
CREATE TABLE IF NOT EXISTS `ai_conversation` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `question` VARCHAR(500) NOT NULL COMMENT '自然语言提问',
    `parsed_conditions` JSON NULL COMMENT '解析出的条件（口味/价格/忌口）',
    `recommend_ids` JSON NULL COMMENT '命中平台对象 [{subjectType,subjectId,name}]',
    `answer` TEXT NULL COMMENT '模型返回的建议文本',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_user` (`user_id`, `created_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- AI 供应商注册表（r45：后台可维护；默认 7 项由后端启动幂等种子写入，此处只建表）
CREATE TABLE IF NOT EXISTS `ai_provider` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `provider_key` VARCHAR(32) NOT NULL COMMENT '供应商标识（存 user.ai_config.provider）',
    `name` VARCHAR(64) NOT NULL COMMENT '显示名',
    `protocol` VARCHAR(16) NOT NULL DEFAULT 'openai' COMMENT '协议：openai 兼容 / anthropic 原生',
    `base_url` VARCHAR(200) NOT NULL DEFAULT '' COMMENT '官方默认接口地址（空=自定义端点）',
    `console_url` VARCHAR(300) NOT NULL DEFAULT '' COMMENT '控制台/接口文档链接',
    `model_doc_url` VARCHAR(300) NOT NULL DEFAULT '' COMMENT '模型接入文档链接',
    `enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序（小在前）',
    UNIQUE KEY `uk_provider_key` (`provider_key`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT 'AI 供应商注册表（后台可维护）';

-- 18. 用户 AI 模型配置列表（r46 起，Trae CN 式多配置；默认行无需种子，用户自行添加）
-- api_key_cipher 为 AES-256-GCM 密文（utils/secret-box），库内无明文密钥
-- platform_id 非空 = 选用平台托管模型的个人引用行（名称/模型 ID 存快照，真实密钥留在 ai_platform_model）
CREATE TABLE IF NOT EXISTS `ai_model` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL COMMENT '归属用户',
    `platform_id` BIGINT NULL COMMENT '平台托管模型引用（ai_platform_model.id，非空=引用行）',
    `provider_key` VARCHAR(32) NOT NULL COMMENT '供应商标识（ai_provider.provider_key，引用行固定 platform）',
    `protocol` VARCHAR(16) NOT NULL DEFAULT 'openai' COMMENT '接口类型快照：openai 兼容 / anthropic 原生',
    `base_url` VARCHAR(200) NOT NULL DEFAULT '' COMMENT '接口地址',
    `model_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '模型 ID（官方模型名）',
    `display_name` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '模型展示名称（空=显示模型 ID）',
    `api_key_cipher` TEXT NOT NULL COMMENT 'API 密钥密文（AES-256-GCM，iv+tag+ciphertext base64）',
    `is_selected` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '使用中（单用户仅一条为 1）',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_user` (`user_id`),
    KEY `idx_platform` (`platform_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT '用户 AI 模型配置列表（密钥加密存储）';

-- 19. 平台托管 AI 模型（r52 起：后台配置含密钥，前台用户免配置直接选用；密钥永不下发前端）
CREATE TABLE IF NOT EXISTS `ai_platform_model` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `name` VARCHAR(64) NOT NULL COMMENT '展示名称',
    `protocol` VARCHAR(16) NOT NULL DEFAULT 'openai' COMMENT '协议：openai 兼容 / anthropic 原生',
    `base_url` VARCHAR(200) NOT NULL COMMENT '接口地址',
    `model_id` VARCHAR(64) NOT NULL COMMENT '模型 ID（官方模型名）',
    `api_key_cipher` TEXT NOT NULL COMMENT 'API 密钥密文（AES-256-GCM，iv+tag+ciphertext base64）',
    `enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用（停用后用户端即刻隐藏/失效回落）',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序（小在前）',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT '平台托管 AI 模型（后台配置，用户直接选用）';

-- 20. 个人贴图库（r52 手账贴纸）：商家菜品图自动抠图 / 用户上传抠图，MinIO 存透明 PNG
CREATE TABLE IF NOT EXISTS `sticker` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT NOT NULL,
    `name` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '贴纸名（默认菜品/文件名）',
    `object_key` VARCHAR(255) NOT NULL COMMENT 'MinIO 对象键（透明 PNG）',
    `source` TINYINT NOT NULL DEFAULT 0 COMMENT '0 用户上传抠图 / 1 收藏自动抠图',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_user` (`user_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT '个人贴图库（手账贴纸素材）';

-- 21. 美食手账（r52 手账编辑器）：bg 背景样式 + layout 块 JSON（贴纸/文字块，含位置缩放旋转）
CREATE TABLE IF NOT EXISTS `journal` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT NOT NULL,
    `title` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '手账标题',
    `date` DATE NOT NULL COMMENT '手账对应日期',
    `text` TEXT NULL COMMENT '正文随笔',
    `bg` TINYINT NOT NULL DEFAULT 0 COMMENT '纸面背景样式 0 米纸网格 / 1 点阵 / 2 牛皮纸 / 3 自定义图片',
    `bg_src` VARCHAR(255) NULL COMMENT 'bg=3 自定义背景图 /img/ 路径',
    `layout` JSON NOT NULL COMMENT '画布块数组 [{kind,sticker,x,y,w,rot,text,color,size}]（画布 750x1000）',
    `cover` VARCHAR(255) NULL COMMENT '封面贴纸对象键（列表缩略）',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_user_date` (`user_id`, `date`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT '美食手账（贴纸排版画布）';

-- =========================================================
-- 敏感词种子改为 seed.js 参数化插入（initdb 通道按 latin1 解析 SQL 文本会损坏中文）
