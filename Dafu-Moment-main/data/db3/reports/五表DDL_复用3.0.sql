-- 直接复用3.0的五表DDL，供设计核对；依赖3.0 user/location及相关从表，不能直接塞进22表工程。

CREATE TABLE IF NOT EXISTS `dietary_profile` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '档案标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '所属用户',
  `budget_min` DECIMAL(10,2) NULL COMMENT '预算下限',
  `budget_max` DECIMAL(10,2) NULL COMMENT '预算上限',
  `is_vegetarian` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '素食偏好：0=否 1=是',
  `taste_preference` VARCHAR(64) NULL COMMENT '口味偏好（自由文本）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dietary_profile_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='饮食档案（dietary_profile）；忌口/过敏原见 dietary_restriction 子表';

CREATE TABLE IF NOT EXISTS `check_in` (
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

CREATE TABLE IF NOT EXISTS `achievement` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '成就定义标识',
  `metric_type` TINYINT NOT NULL COMMENT '1=打卡次数 2=不同点位数 3=评价数量 4=获赞数',
  `target_value` INT NOT NULL COMMENT '解锁目标值（拟定：100/30/50/500）',
  `title` VARCHAR(64) NOT NULL COMMENT '成就标题',
  `description` VARCHAR(255) NULL COMMENT '成就说明文案',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_achievement_metric` (`metric_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='成就定义（achievement）；四项指标（口径#5）';

CREATE TABLE IF NOT EXISTS `user_achievement` (
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

CREATE TABLE IF NOT EXISTS `pet` (
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
