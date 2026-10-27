-- =====================================================
-- 大福食刻 DDL · 02_catering.sql（餐饮基础数据 · 9 表）
-- =====================================================
SET NAMES utf8mb4;

-- 1. 场地分类
DROP TABLE IF EXISTS `scene_category`;
CREATE TABLE `scene_category` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分类标识',
  `name` VARCHAR(64) NOT NULL COMMENT '分类名（食堂/永嘉天地/学生街/其他/外卖）',
  `category_type` TINYINT NULL COMMENT '分类用途标记（取值待产品定，QC-20）',
  `sort` INT NULL COMMENT '列表展示顺序',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_scene_category_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='场地分类（scene_category）';

-- 2. 食区
DROP TABLE IF EXISTS `canteen`;
CREATE TABLE `canteen` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '食区标识',
  `name` VARCHAR(64) NOT NULL COMMENT '食区名称（一食堂/二食堂/永嘉天地等）',
  `type` TINYINT NULL COMMENT '食区类型（取值待产品定，QC-20）',
  `campus` TINYINT NULL COMMENT '校区（取值待产品定，QC-20）',
  `lng` DECIMAL(10,7) NULL COMMENT '食区中心经度（GCJ-02 坐标系入库）',
  `lat` DECIMAL(10,7) NULL COMMENT '食区中心纬度（GCJ-02 坐标系入库）',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '0=停用 1=正常',
  `sort` INT NULL COMMENT '展示顺序',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  KEY `idx_canteen_campus_status` (`campus`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='食区（canteen）；层级：食区→点位→档口→菜品';

-- 3. 点位
DROP TABLE IF EXISTS `location`;
CREATE TABLE `location` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '点位标识',
  `name` VARCHAR(128) NOT NULL COMMENT '点位名称',
  `address` VARCHAR(255) NULL COMMENT '详细地址文本',
  `scene_category_id` BIGINT UNSIGNED NULL COMMENT '所属场地分类',
  `canteen_id` BIGINT UNSIGNED NULL COMMENT '所属食区（可空=校外点位）',
  `map_location_id` BIGINT UNSIGNED NULL COMMENT '地图坐标（GCJ-02，经 map_location 关联）',
  `business_info_id` BIGINT UNSIGNED NULL COMMENT '营业信息（1:1，B图2）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  KEY `idx_location_canteen` (`canteen_id`),
  KEY `idx_location_scene` (`scene_category_id`),
  KEY `idx_location_name` (`name`),
  UNIQUE KEY `uk_location_map` (`map_location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='点位（location）；营业状态唯一由 business_info 维护';

-- 4. 营业信息
DROP TABLE IF EXISTS `business_info`;
CREATE TABLE `business_info` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '信息标识',
  `location_id` BIGINT UNSIGNED NOT NULL COMMENT '所属点位（1:1）',
  `business_hours` VARCHAR(128) NULL COMMENT '营业时间文本',
  `business_status` TINYINT NOT NULL DEFAULT 1 COMMENT '0=停业/撤销 1=正常（点位营业状态唯一维护点，E 审核/B 2.0 去重）',
  `contact` VARCHAR(64) NULL COMMENT '对外联系方式',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_business_info_location` (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='营业信息（business_info）';

-- 5. 地图位置
DROP TABLE IF EXISTS `map_location`;
CREATE TABLE `map_location` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '坐标点唯一标识',
  `latitude` DECIMAL(10,7) NOT NULL COMMENT '纬度（GCJ-02 坐标系入库）',
  `longitude` DECIMAL(10,7) NOT NULL COMMENT '经度（GCJ-02 坐标系入库）',
  `description` VARCHAR(128) NULL COMMENT '位置描述文案',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='地图位置（map_location）';

-- 6. 档口
DROP TABLE IF EXISTS `station`;
CREATE TABLE `station` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '档口标识',
  `name` VARCHAR(128) NOT NULL COMMENT '档口名称',
  `location_id` BIGINT UNSIGNED NOT NULL COMMENT '所属点位',
  `map_location_id` BIGINT UNSIGNED NULL COMMENT '导览坐标（GCJ-02，可空，二期导览图 P08）',
  `business_hours` VARCHAR(128) NULL COMMENT '营业时间文本',
  `owner_id` BIGINT UNSIGNED NULL COMMENT '档口负责人（店家）。本期仅预留：无商家角色、无商家端；为空表示未指定。启用后用于「店主回复评价」的归属校验与信息维护授权。',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '0=停业/撤销 1=正常（撤销保留历史评价与打卡，前台标注）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  KEY `idx_station_location` (`location_id`),
  KEY `idx_station_owner` (`owner_id`),
  KEY `idx_station_name` (`name`),
  KEY `idx_station_status` (`status`),
  UNIQUE KEY `uk_station_map` (`map_location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='档口（station）；A /stations 对应';

-- 7. 菜品
DROP TABLE IF EXISTS `dish`;
CREATE TABLE `dish` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '菜品唯一标识',
  `station_id` BIGINT UNSIGNED NOT NULL COMMENT '所属档口',
  `name` VARCHAR(128) NOT NULL COMMENT '菜品名称',
  `price` DECIMAL(10,2) NOT NULL COMMENT '单价',
  `price_unit` VARCHAR(16) NULL COMMENT '计价单位（/份、/两、/杯等）',
  `image` VARCHAR(255) NULL COMMENT '菜品图（MinIO object_key）',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0=待审核 1=正常 2=停用（审核前不入公共搜索）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  KEY `idx_dish_station` (`station_id`, `status`),
  KEY `idx_dish_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='菜品（dish）；E 审核：station_id 承载档口粒度（原 stall 已删）';

-- 8. 标签
DROP TABLE IF EXISTS `tag`;
CREATE TABLE `tag` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '标签唯一标识',
  `name` VARCHAR(64) NOT NULL COMMENT '标签名（如 免辣）',
  `type` TINYINT NOT NULL DEFAULT 1 COMMENT '1=忌口 2=食材 3=场景适配',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tag_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='标签（tag）';

-- 9. 菜品标签
DROP TABLE IF EXISTS `dish_tag`;
CREATE TABLE `dish_tag` (
  `dish_id` BIGINT UNSIGNED NOT NULL COMMENT '菜品',
  `tag_id` BIGINT UNSIGNED NOT NULL COMMENT '标签',
  PRIMARY KEY (`dish_id`, `tag_id`),
  KEY `idx_dish_tag_tag` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='菜品标签（dish_tag）';

-- 10. 档口负责人绑定（station_manager，E 审核）
DROP TABLE IF EXISTS `station_manager`;
CREATE TABLE `station_manager` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '绑定行标识',
  `station_id` BIGINT UNSIGNED NOT NULL COMMENT '档口',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '负责人（店家）',
  `is_primary` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否主负责人',
  `granted_by` BIGINT UNSIGNED NULL COMMENT '由谁绑定（管理员）',
  `granted_at` DATETIME NULL COMMENT '绑定时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_station_manager` (`station_id`, `user_id`),
  KEY `idx_sm_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='档口负责人绑定（station_manager）；E 审核：一人可多档口；/manager/* 鉴权=查绑定';

-- 11. 档口动态公告（station_post）——按实现仓库 7e73590 补建
DROP TABLE IF EXISTS `station_post`;
CREATE TABLE `station_post` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '公告标识',
  `station_id` BIGINT UNSIGNED NOT NULL COMMENT '所属档口（FK→station）',
  `author_id` BIGINT UNSIGNED NOT NULL COMMENT '发布人（FK→user）',
  `type` VARCHAR(16) NOT NULL COMMENT 'new_dish/menu_change/away/promo',
  `content` VARCHAR(200) NOT NULL COMMENT '公告正文',
  `starts_at` DATETIME NULL COMMENT '生效开始时间',
  `ends_at` DATETIME NULL COMMENT '生效结束时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_station_post` (`station_id`, `created_at`),
  CONSTRAINT `ck_sp_type` CHECK (`type` IN ('new_dish','menu_change','away','promo'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='档口动态公告（station_post）';
