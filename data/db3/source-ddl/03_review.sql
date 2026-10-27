-- =====================================================
-- 大福食刻 DDL · 03_review.sql（点评与互动 · 12 表）
-- MySQL 8.0 兼容 | InnoDB | utf8mb4 | 统一软删除 | 无级联删除
-- =====================================================
SET NAMES utf8mb4;

-- 1. 评价
DROP TABLE IF EXISTS `review`;
CREATE TABLE `review` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '评价标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '评价用户',
  `location_id` BIGINT UNSIGNED NOT NULL COMMENT '关联点位（必填）',
  `station_id` BIGINT UNSIGNED NOT NULL COMMENT '被评价档口（必填；菜品可选，若指定须属于该档口）',
  `dish_id` BIGINT UNSIGNED NULL COMMENT '关联菜品（可选）',
  `content` TEXT NULL COMMENT '评价文字（可空：文字与图片不可同时为空，应用层校验；G-10）',
  `meal_mode` TINYINT NOT NULL DEFAULT 1 COMMENT '1=堂食 2=打包 3=外送',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0=已发布 1=违规下架（offline_* 必填，触发汇总重算） 2=待人工审核（高级词转人工：前台不可见、不参与聚合，复核后转 0 或 1；G-02）',
  `offline_reason` VARCHAR(255) NULL COMMENT '下架原因（status=1 必填）',
  `offline_by` BIGINT UNSIGNED NULL COMMENT '下架处置管理员',
  `offline_at` DATETIME NULL COMMENT '下架处置时间（触发 review_summary 重算 CON-26）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  KEY `idx_review_location_status_time` (`location_id`, `status`, `created_at`),
  KEY `idx_review_station_status` (`station_id`, `status`),
  KEY `idx_review_dish_status` (`dish_id`, `status`),
  KEY `idx_review_user_time` (`user_id`, `created_at`),
  KEY `idx_review_status_time` (`status`, `created_at`),
  CONSTRAINT `ck_review_status` CHECK (`status` IN (0,1,2)),
  CONSTRAINT `ck_review_meal_mode` CHECK (`meal_mode` IN (1,2,3)),
  CONSTRAINT `ck_review_offline` CHECK (`status` <> 1 OR (`offline_reason` IS NOT NULL AND `offline_by` IS NOT NULL AND `offline_at` IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='评价（review）；聚合只算 status=0 且 deleted_at IS NULL';

-- 2. 评分明细
DROP TABLE IF EXISTS `rating_detail`;
CREATE TABLE `rating_detail` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '评分明细行标识',
  `review_id` BIGINT UNSIGNED NOT NULL COMMENT '所属评价',
  `dimension_id` BIGINT UNSIGNED NOT NULL COMMENT '评分维度（FK→review_dimension）',
  `score` DECIMAL(2,1) NOT NULL COMMENT '维度得分 1.0–5.0（全维度统一 5 分制，维度字典无 max_score 列；G-10）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rating_detail` (`review_id`, `dimension_id`),
  KEY `idx_rating_dim` (`dimension_id`),
  CONSTRAINT `ck_rating_score` CHECK (`score` >= 1.0 AND `score` <= 5.0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='评分明细（rating_detail）；维度由 meal_mode 决定（CON-15）';

-- 3. 评价图片
DROP TABLE IF EXISTS `review_image`;
CREATE TABLE `review_image` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '图片行标识',
  `review_id` BIGINT UNSIGNED NOT NULL COMMENT '所属评价',
  `object_key` VARCHAR(255) NOT NULL COMMENT 'MinIO 对象键（拍板0.4）',
  `sort` INT NULL COMMENT '展示顺序',
  PRIMARY KEY (`id`),
  KEY `idx_review_image_review` (`review_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='评价图片（review_image）';

-- 4. 评价标签
DROP TABLE IF EXISTS `review_tag`;
CREATE TABLE `review_tag` (
  `review_id` BIGINT UNSIGNED NOT NULL COMMENT '评价',
  `tag_id` BIGINT UNSIGNED NOT NULL COMMENT '标签',
  PRIMARY KEY (`review_id`, `tag_id`),
  KEY `idx_review_tag_tag` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='评价标签（review_tag）';

-- 5. 点赞
DROP TABLE IF EXISTS `review_like`;
CREATE TABLE `review_like` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '点赞记录',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '点赞用户',
  `biz_type` TINYINT NOT NULL DEFAULT 1 COMMENT '1=评价 2=帖子 3=评论',
  `biz_id` BIGINT UNSIGNED NOT NULL COMMENT '点赞目标ID（多态无外键）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '点赞时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间：NULL=有效',
  `valid_flag` BIGINT GENERATED ALWAYS AS (IF(`deleted_at` IS NULL, 1, NULL)) STORED COMMENT '有效行标志',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_review_like` (`user_id`, `biz_type`, `biz_id`, `valid_flag`),
  KEY `idx_review_like_biz` (`biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='点赞（review_like）；多态，CON-23 级联软删';

-- 6. 收藏
DROP TABLE IF EXISTS `favorite`;
CREATE TABLE `favorite` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '收藏记录',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '收藏用户',
  `biz_type` TINYINT NOT NULL DEFAULT 1 COMMENT '1=点位 2=档口 3=菜品 4=帖子',
  `biz_id` BIGINT UNSIGNED NOT NULL COMMENT '收藏目标ID（多态无外键）',
  `group_id` BIGINT UNSIGNED NULL COMMENT '所属分组（想吃/常吃/自定义）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间：NULL=有效',
  `valid_flag` BIGINT GENERATED ALWAYS AS (IF(`deleted_at` IS NULL, 1, NULL)) STORED COMMENT '有效行标志',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_favorite` (`user_id`, `biz_type`, `biz_id`, `valid_flag`),
  KEY `idx_favorite_biz` (`biz_type`, `biz_id`),
  KEY `idx_favorite_group` (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='收藏（favorite）；多态，CON-23 级联软删';

-- 7. 收藏分组
DROP TABLE IF EXISTS `favorite_group`;
CREATE TABLE `favorite_group` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分组标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '分组归属用户',
  `group_name` VARCHAR(64) NOT NULL COMMENT '分组名（想吃/常吃/自定义）',
  `is_default` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否默认分组',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_favorite_group` (`user_id`, `group_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='收藏分组（favorite_group）';

-- 8. 举报
DROP TABLE IF EXISTS `report`;
CREATE TABLE `report` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '举报记录',
  `reporter_id` BIGINT UNSIGNED NOT NULL COMMENT '举报用户',
  `biz_type` TINYINT NOT NULL COMMENT '目标类型 1=点位 2=档口 3=菜品 4=帖子 5=评论 6=评价；纠错不设独立目标类型（由 reason 与实际对象表达，避免指向不存在的 correction 表）',
  `biz_id` BIGINT UNSIGNED NOT NULL COMMENT '举报目标ID（多态无外键）',
  `reason` TINYINT NOT NULL COMMENT '1=广告骚扰 2=辱骂攻击 3=虚假信息 4=隐私泄露 5=其他',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0=待处理 1=已处理 2=已驳回',
  `handled_by` BIGINT UNSIGNED NULL COMMENT '处理管理员（待处理时为空）',
  `handled_at` DATETIME NULL COMMENT '处理完成时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '举报时间',
  PRIMARY KEY (`id`),
  KEY `idx_report_biz` (`biz_type`, `biz_id`),
  KEY `idx_report_status_time` (`status`, `created_at`),
  CONSTRAINT `ck_report_biz_type` CHECK (`biz_type` BETWEEN 1 AND 6),
  CONSTRAINT `ck_report_status` CHECK (`status` IN (0,1,2))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='举报（report）；多态，CON-23 级联软删';

-- 9. 评分维度字典
DROP TABLE IF EXISTS `review_dimension`;
CREATE TABLE `review_dimension` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '维度标识',
  `code` VARCHAR(32) NOT NULL COMMENT '维度编码（taste/portion/package/queue/delivery）',
  `name` VARCHAR(32) NOT NULL COMMENT '维度名（口味/份量/包装/排队体验/配送速度）',
  `is_required` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=非必评 1=必评（口味/份量=1）',
  `sort` INT NULL COMMENT '打分组件展示顺序',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_review_dimension_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='评分维度字典（review_dimension）；GET /dimensions 数据源';

-- 10. 维度适用就餐方式
DROP TABLE IF EXISTS `review_dimension_meal_mode`;
CREATE TABLE `review_dimension_meal_mode` (
  `dimension_id` BIGINT UNSIGNED NOT NULL COMMENT '评分维度',
  `meal_mode` TINYINT NOT NULL COMMENT '1=堂食 2=打包 3=外送',
  PRIMARY KEY (`dimension_id`, `meal_mode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='维度适用就餐方式（review_dimension_meal_mode）';

-- 11. 评价汇总（物化）
DROP TABLE IF EXISTS `review_summary`;
CREATE TABLE `review_summary` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '汇总行标识',
  `biz_type` TINYINT NOT NULL COMMENT '1=点位 2=档口 3=菜品',
  `biz_id` BIGINT UNSIGNED NOT NULL COMMENT '对象ID（多态无外键）',
  `dimension_id` BIGINT UNSIGNED NOT NULL COMMENT '统计维度（FK→review_dimension）',
  `avg_score` DECIMAL(3,2) NOT NULL COMMENT '该维度均分',
  `review_count` INT NOT NULL DEFAULT 0 COMMENT '参与统计的评价数（原count，改名避免保留字）',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近刷新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_review_summary` (`biz_type`, `biz_id`, `dimension_id`),
  KEY `idx_review_summary_dim` (`dimension_id`),
  KEY `idx_review_summary_biz` (`biz_type`, `biz_id`),
  CONSTRAINT `ck_summary_avg` CHECK (`avg_score` >= 1.0 AND `avg_score` <= 5.0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='评价汇总（review_summary）；只统计 status=0 AND deleted_at IS NULL；发布/删除/下架/申诉通过 四处触发重算（CON-26）';

-- 12. 评价申诉
DROP TABLE IF EXISTS `review_appeal`;
CREATE TABLE `review_appeal` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '申诉标识',
  `review_id` BIGINT UNSIGNED NOT NULL COMMENT '被申诉的评价',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '申诉人（评价作者）',
  `reason` VARCHAR(255) NOT NULL COMMENT '申诉理由',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0=待处理 1=通过 2=驳回',
  `handled_by` BIGINT UNSIGNED NULL COMMENT '处理管理员',
  `handled_at` DATETIME NULL COMMENT '处理时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '申诉时间',
  PRIMARY KEY (`id`),
  KEY `idx_appeal_review` (`review_id`),
  KEY `idx_appeal_status` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='评价申诉（review_appeal）';
