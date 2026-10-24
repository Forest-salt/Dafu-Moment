-- =====================================================
-- 大福食刻 DDL · 04_checkin.sql（打卡与成长 · 14 表）
-- =====================================================
SET NAMES utf8mb4;

-- 1. 打卡
DROP TABLE IF EXISTS `check_in`;
CREATE TABLE `check_in` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '打卡标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '打卡用户',
  `location_id` BIGINT UNSIGNED NOT NULL COMMENT '关联点位（必填）',
  `check_in_date` DATE NOT NULL COMMENT '就餐日期（干饭日历 P12 按此聚合）',
  `visibility` TINYINT NOT NULL DEFAULT 1 COMMENT '1=仅记录 2=私有 3=公开',
  `note` VARCHAR(255) NULL COMMENT '可选随笔',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  KEY `idx_check_in_user_date` (`user_id`, `check_in_date`),
  KEY `idx_check_in_location_date` (`location_id`, `check_in_date`),
  UNIQUE KEY `uk_check_in_dup` (`user_id`, `location_id`, `check_in_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='打卡（check_in）；E 轮：photos 子表承载，photos 行已删';

-- 2. 打卡图片
DROP TABLE IF EXISTS `check_in_image`;
CREATE TABLE `check_in_image` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '图片行标识',
  `check_in_id` BIGINT UNSIGNED NOT NULL COMMENT '所属打卡',
  `object_key` VARCHAR(255) NOT NULL COMMENT 'MinIO 对象键（拍板0.4）',
  `sort` INT NULL COMMENT '展示顺序',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_check_in_image` (`check_in_id`, `object_key`),
  KEY `idx_check_in_image` (`check_in_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='打卡图片（check_in_image）';

-- 3. 打卡菜品
DROP TABLE IF EXISTS `check_in_dish`;
CREATE TABLE `check_in_dish` (
  `check_in_id` BIGINT UNSIGNED NOT NULL COMMENT '所属打卡',
  `dish_id` BIGINT UNSIGNED NOT NULL COMMENT '消费的菜品',
  `quantity` INT NULL DEFAULT 1 COMMENT '消费数量（B图4补）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`check_in_id`, `dish_id`),
  KEY `idx_cid_dish` (`dish_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='打卡菜品（check_in_dish）';

-- 4. 手账
DROP TABLE IF EXISTS `journal`;
CREATE TABLE `journal` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '手账标识',
  `check_in_id` BIGINT UNSIGNED NOT NULL COMMENT '关联打卡（0..1）',
  `note` TEXT NULL COMMENT '手账文字内容',
  `template` VARCHAR(64) NULL COMMENT '手账排版模板（取值待产品定，QC-20）',
  `is_private` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=私有（默认） 0=公开；转公开/转草稿须经用户主动操作',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_journal_check_in` (`check_in_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='手账（journal）；照片见 journal_image 子表';

-- 5. 手账图片
DROP TABLE IF EXISTS `journal_image`;
CREATE TABLE `journal_image` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '图片行标识',
  `journal_id` BIGINT UNSIGNED NOT NULL COMMENT '所属手账',
  `object_key` VARCHAR(255) NOT NULL COMMENT 'MinIO 对象键（拍板0.4）',
  `sort` INT NULL COMMENT '展示顺序',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_journal_image` (`journal_id`, `object_key`),
  KEY `idx_journal_image` (`journal_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='手账图片（journal_image）';

-- 6. 足迹
DROP TABLE IF EXISTS `footprint`;
CREATE TABLE `footprint` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '足迹标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '足迹归属用户',
  `location_id` BIGINT UNSIGNED NOT NULL COMMENT '到访点位',
  `first_visit_at` DATETIME NOT NULL COMMENT '首次到访时间（重复打卡不更新）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_footprint` (`user_id`, `location_id`),
  KEY `idx_footprint_location` (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='足迹（footprint）；E 轮：check_in.is_first_visit 已删';

-- 7. 成就
DROP TABLE IF EXISTS `achievement`;
CREATE TABLE `achievement` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '成就定义标识',
  `metric_type` TINYINT NOT NULL COMMENT '1=打卡次数 2=不同点位数 3=评价数量 4=获赞数',
  `target_value` INT NOT NULL COMMENT '解锁目标值（拟定：100/30/50/500）',
  `title` VARCHAR(64) NOT NULL COMMENT '成就标题',
  `description` VARCHAR(255) NULL COMMENT '成就说明文案',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_achievement_metric` (`metric_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='成就定义（achievement）；四项指标（口径#5）';

-- 8. 用户成就
DROP TABLE IF EXISTS `user_achievement`;
CREATE TABLE `user_achievement` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户成就行标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '进度归属用户',
  `achievement_id` BIGINT UNSIGNED NOT NULL COMMENT '对应成就定义',
  `progress` INT NOT NULL DEFAULT 0 COMMENT '当前进度值',
  `unlocked` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已解锁（每25%一档为展示层）',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近刷新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_achievement` (`user_id`, `achievement_id`),
  KEY `idx_ua_achievement` (`achievement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户成就（user_achievement）';

-- 9. 宠物
DROP TABLE IF EXISTS `pet`;
CREATE TABLE `pet` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '宠物标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '宠物归属用户（1:1）',
  `skin` VARCHAR(64) NULL COMMENT '宠物外观（表情/装扮切换）',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0=正常 1=饥饿（派生缓存，每日重算禁手工写）',
  `level` INT NULL COMMENT '宠物等级（P14 等级进度条）',
  `lit_days` INT NULL COMMENT '累计点亮天数（P14）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pet_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='宠物（pet）；satiety 已删（E轮），status 派生缓存';

-- 10. 喂食记录
DROP TABLE IF EXISTS `feed_record`;
CREATE TABLE `feed_record` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '喂食记录',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '喂食用户',
  `pet_id` BIGINT UNSIGNED NOT NULL COMMENT '被喂食宠物',
  `coin_cost` INT NOT NULL DEFAULT 10 COMMENT '本次消耗金币（拟定值10）',
  `fed_at` DATETIME NOT NULL COMMENT '喂食时间（每日3次限制判断）',
  `emotion_result` TINYINT NOT NULL DEFAULT 1 COMMENT '宠物表情反馈：1=满足（表情切换）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_feed_user_time` (`user_id`, `fed_at`),
  KEY `idx_feed_pet` (`pet_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='喂食记录（feed_record）';

-- 11. 金币流水
DROP TABLE IF EXISTS `coin_transaction`;
CREATE TABLE `coin_transaction` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '金币流水',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '流水归属用户',
  `change_type` TINYINT NOT NULL COMMENT '1=任务奖励 2=喂食消耗 3=系统调整',
  `amount` INT NOT NULL COMMENT '变动量（奖励为正、消耗为负）',
  `biz_type` TINYINT NULL COMMENT '来源对象类型（任务/打卡/评价等）',
  `biz_id` BIGINT UNSIGNED NULL COMMENT '来源对象ID（多态无外键）',
  `balance_after` INT NULL COMMENT '变动后余额（对账用）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '流水时间',
  PRIMARY KEY (`id`),
  KEY `idx_coin_user_time` (`user_id`, `created_at`),
  KEY `idx_coin_biz` (`biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='金币流水（coin_transaction）';

-- 12. 任务
DROP TABLE IF EXISTS `task`;
CREATE TABLE `task` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '任务标识',
  `task_type` TINYINT NOT NULL COMMENT '1=每日任务 2=成长任务',
  `name` VARCHAR(64) NOT NULL COMMENT '任务名（如 每日打卡）',
  `action_type` TINYINT NOT NULL COMMENT '1=打卡 2=写点评 3=喂食 4=收藏 5=互动 6=分享',
  `reward_coins` INT NOT NULL COMMENT '奖励金币（拟定值 10/20/5/5/5/10，合计55/日）',
  `enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否上架',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_task_type_action` (`task_type`, `action_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='任务（task）；金币拟定值，可 UPDATE';

-- 13. 任务领取记录
DROP TABLE IF EXISTS `task_claim`;
CREATE TABLE `task_claim` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '领取记录',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '领取用户',
  `task_id` BIGINT UNSIGNED NOT NULL COMMENT '所属任务',
  `claim_date` DATE NOT NULL COMMENT '任务日期（每日任务按日去重）',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0=未完成 1=待领取 2=已领取',
  `completed_at` DATETIME NULL COMMENT '达成条件时间',
  `claimed_at` DATETIME NULL COMMENT '领取奖励时间（金币不追回口径）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_task_claim` (`user_id`, `task_id`, `claim_date`),
  KEY `idx_task_claim_task_date` (`task_id`, `claim_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='任务领取记录（task_claim）；CON-21 每日限领';

-- 14. 用户贴纸
DROP TABLE IF EXISTS `sticker`;
CREATE TABLE `sticker` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '贴纸标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '贴纸归属用户',
  `object_key` VARCHAR(255) NOT NULL COMMENT 'MinIO 对象键',
  `category` TINYINT NULL COMMENT '贴纸分类（取值待产品定，QC-20）',
  `source_image_key` VARCHAR(255) NULL COMMENT '抠图来源图（MinIO object_key）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_sticker_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户贴纸（sticker）';
