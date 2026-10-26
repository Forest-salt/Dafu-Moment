-- =====================================================
-- 大福食刻 DDL · 06_ai.sql（推荐与 AI 助手 · 11 表）
-- =====================================================
SET NAMES utf8mb4;

-- 1. 推荐结果
DROP TABLE IF EXISTS `recommendation`;
CREATE TABLE `recommendation` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '推荐结果标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '推荐归属用户',
  `scene` TINYINT NOT NULL DEFAULT 1 COMMENT '1=首页推荐 2=智能饮食推荐',
  `source_type` TINYINT NOT NULL DEFAULT 1 COMMENT '1=规则 2=热门 3=AI（AI 不可用降级为规则/热门）',
  `rule_id` BIGINT UNSIGNED NULL COMMENT '命中规则（规则生成时填）',
  `reason` VARCHAR(255) NOT NULL COMMENT '说明推荐依据',
  `question` VARCHAR(255) NULL COMMENT '智能饮食推荐的用户提问（B图6）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '推荐时间',
  PRIMARY KEY (`id`),
  KEY `idx_rec_user_time` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='推荐结果（recommendation）';

-- 2. 推荐规则
DROP TABLE IF EXISTS `recommendation_rule`;
CREATE TABLE `recommendation_rule` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '规则标识',
  `name` VARCHAR(64) NOT NULL COMMENT '规则名',
  `condition_expr` JSON NOT NULL COMMENT '命中条件（结构化 JSON：字段/算子/值，如 忌口∩标签）',
  `action` VARCHAR(32) NULL COMMENT '硬动作：剔除/降级（安全类；可空=纯打分，B 2.0 三段式）',
  `weight` DECIMAL(5,2) NULL COMMENT '软排序权重（偏好类，可负）',
  `enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `priority` INT NOT NULL DEFAULT 0 COMMENT '执行优先级',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_rec_rule_enabled` (`enabled`, `priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='推荐规则（recommendation_rule）；条件+动作+权重三段式（B 2.0）';

-- 3. 推荐项
DROP TABLE IF EXISTS `recommendation_item`;
CREATE TABLE `recommendation_item` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '推荐项标识',
  `recommendation_id` BIGINT UNSIGNED NOT NULL COMMENT '所属推荐结果',
  `biz_type` TINYINT NOT NULL DEFAULT 1 COMMENT '1=点位 2=菜品',
  `biz_id` BIGINT UNSIGNED NOT NULL COMMENT '推荐对象ID',
  `score` DECIMAL(5,2) NULL COMMENT '推荐得分',
  PRIMARY KEY (`id`),
  KEY `idx_rec_item_rec` (`recommendation_id`),
  KEY `idx_rec_item_biz` (`biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='推荐项（recommendation_item）';

-- 4. 口味画像
DROP TABLE IF EXISTS `taste_profile`;
CREATE TABLE `taste_profile` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '画像标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '画像所属用户（0..1，数据不足不强行生成）',
  `spice_level` TINYINT NULL COMMENT '辣度接受度（1–5 档）',
  `taste_style` VARCHAR(64) NULL COMMENT '口味风格（自由文本，QC-20 枚举化待定）',
  `spend_tendency` VARCHAR(64) NULL COMMENT '消费水平倾向（QC-20）',
  `common_scene` VARCHAR(64) NULL COMMENT '常去就餐场所（需求原文作常见场景；QC-20）',
  `queue_tolerance` VARCHAR(64) NULL COMMENT '排队接受度档位（QC-20）',
  `mbti_code` VARCHAR(4) NULL COMMENT '饭MBTI 16型编码（可空）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_taste_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='口味画像（taste_profile）；授权后生成，撤回授权停用';

-- 5. 饮食计划
DROP TABLE IF EXISTS `diet_plan`;
CREATE TABLE `diet_plan` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '计划标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '计划归属用户',
  `period` TINYINT NOT NULL COMMENT '1=单日 3=三日 7=七日',
  `generation_method` TINYINT NOT NULL DEFAULT 1 COMMENT '1=规则 2=模板 3=AI',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '生效/已过期/已废弃（取值待产品定，QC-20）',
  `estimated_budget` DECIMAL(10,2) NOT NULL COMMENT '计划总预算',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  KEY `idx_diet_user_time` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='饮食计划（diet_plan）';

-- 6. 饮食计划项
DROP TABLE IF EXISTS `diet_plan_item`;
CREATE TABLE `diet_plan_item` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '计划项标识',
  `plan_id` BIGINT UNSIGNED NOT NULL COMMENT '所属计划',
  `dish_id` BIGINT UNSIGNED NOT NULL COMMENT '安排的菜品（可跳详情）',
  `dining_date` DATE NOT NULL COMMENT '当日排期日期',
  `meal_type` TINYINT NOT NULL DEFAULT 1 COMMENT '1=早 2=午 3=晚',
  `estimated_price` DECIMAL(10,2) NULL COMMENT '该餐估算价格',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  KEY `idx_dpi_plan_date` (`plan_id`, `dining_date`),
  KEY `idx_dpi_dish` (`dish_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='饮食计划项（diet_plan_item）';

-- 7. 偏好分析
DROP TABLE IF EXISTS `preference_analysis`;
CREATE TABLE `preference_analysis` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分析记录标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '分析归属用户',
  `source_type` TINYINT NULL COMMENT '分析来源（取值待产品定）',
  `result` JSON NULL COMMENT '分析结果（JSON）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '分析时间',
  PRIMARY KEY (`id`),
  KEY `idx_pref_user_time` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='偏好分析（preference_analysis）';

-- 8. 浏览行为记录
DROP TABLE IF EXISTS `browse_event`;
CREATE TABLE `browse_event` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '行为事件标识',
  `user_id` BIGINT UNSIGNED NULL COMMENT '行为用户（可空=游客）',
  `event_type` TINYINT NOT NULL COMMENT '行为类型（浏览点位/浏览菜品/搜索等，取值待产品定）',
  `biz_type` TINYINT NULL COMMENT '行为对象类型',
  `biz_id` BIGINT UNSIGNED NULL COMMENT '行为对象标识',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '行为时间（撤回授权后不再用于画像/推荐）',
  PRIMARY KEY (`id`),
  KEY `idx_browse_user_time` (`user_id`, `created_at`),
  KEY `idx_browse_biz` (`biz_type`, `biz_id`),
  KEY `idx_browse_type_time` (`event_type`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='浏览行为记录（browse_event）；日志型追加写，受隐私授权约束';

-- 9. AI 供应商
DROP TABLE IF EXISTS `ai_provider`;
CREATE TABLE `ai_provider` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '供应商行标识',
  `name` VARCHAR(64) NOT NULL COMMENT '供应商名',
  `base_url` VARCHAR(255) NOT NULL COMMENT '接口地址（OpenAI 兼容协议）',
  `api_key_ref` VARCHAR(255) NOT NULL COMMENT '密钥的引用/密文（禁止明文入库）',
  `model` VARCHAR(64) NOT NULL COMMENT '模型名',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=启用 0=停用（停用即时从前台隐藏）',
  `priority` INT NOT NULL DEFAULT 0 COMMENT '优先级（降级顺序）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登记时间',
  PRIMARY KEY (`id`),
  KEY `idx_ai_provider_active` (`is_active`, `priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='AI 供应商注册表（ai_provider）；启动自愈播种';

-- 10. AI 会话
DROP TABLE IF EXISTS `ai_conversation`;
CREATE TABLE `ai_conversation` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '会话标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '会话归属用户',
  `provider_id` BIGINT UNSIGNED NULL COMMENT '会话使用的供应商（可空=规则降级会话）',
  `title` VARCHAR(128) NULL COMMENT '会话标题',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '会话创建时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间（删除会话级联软删消息）',
  PRIMARY KEY (`id`),
  KEY `idx_ai_conv_user_time` (`user_id`, `created_at`),
  KEY `idx_ai_conv_provider` (`provider_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='AI 会话（ai_conversation）';

-- 11. AI 会话消息
DROP TABLE IF EXISTS `ai_chat_message`;
CREATE TABLE `ai_chat_message` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '消息标识',
  `session_id` BIGINT UNSIGNED NOT NULL COMMENT '所属会话',
  `role` TINYINT NOT NULL DEFAULT 1 COMMENT '1=user 2=assistant 3=system',
  `content` TEXT NOT NULL COMMENT '消息内容',
  `tokens` INT NULL COMMENT '消息 token 数',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '消息时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  KEY `idx_ai_msg_session` (`session_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='AI 会话消息（ai_chat_message）';

-- 平台托管模型目录（ai_platform_model）
DROP TABLE IF EXISTS `ai_platform_model`;
CREATE TABLE `ai_platform_model` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '目录标识',
  `name` VARCHAR(64) NOT NULL COMMENT '展示名称',
  `protocol` VARCHAR(16) NOT NULL DEFAULT 'openai' COMMENT 'openai 兼容 / anthropic 原生',
  `base_url` VARCHAR(200) NOT NULL COMMENT '接口地址',
  `model_id` VARCHAR(64) NOT NULL COMMENT '模型 ID（官方模型名）',
  `api_key_cipher` TEXT NOT NULL COMMENT 'API 密钥密文（AES-256-GCM, iv+tag+ciphertext base64）；主密钥不入库',
  `enabled` TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用（停用后用户端隐藏）',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序（小在前）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='平台托管模型目录';

-- 用户自配模型（ai_model）——BYOK
DROP TABLE IF EXISTS `ai_model`;
CREATE TABLE `ai_model` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '配置标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '归属用户（FK→user）',
  `platform_id` BIGINT UNSIGNED NULL COMMENT '平台托管模型引用（FK→ai_platform_model，非空=引用行）',
  `provider_key` VARCHAR(32) NOT NULL COMMENT '供应商标识（引用行固定 platform）',
  `protocol` VARCHAR(16) NOT NULL DEFAULT 'openai' COMMENT '接口类型快照',
  `base_url` VARCHAR(200) NOT NULL DEFAULT '' COMMENT '接口地址',
  `model_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '模型 ID',
  `display_name` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '展示名称（空=显示模型 ID）',
  `api_key_cipher` TEXT NOT NULL COMMENT 'API 密钥密文（引用行存平台密钥副本）；主密钥不入库',
  `is_selected` TINYINT NOT NULL DEFAULT 0 COMMENT '使用中（单用户仅一条为 1）',
  `selected_flag` TINYINT GENERATED ALWAYS AS (IF(`is_selected` = 1, 1, NULL)) STORED COMMENT '生成列：用于唯一键兜住单条选中',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_selected` (`user_id`, `selected_flag`),
  KEY `idx_ai_model_user` (`user_id`),
  KEY `idx_ai_model_platform` (`platform_id`),
  CONSTRAINT `ck_ai_model_selected` CHECK (`is_selected` IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户自配模型（BYOK）；密钥加密入库，主密钥外置';
