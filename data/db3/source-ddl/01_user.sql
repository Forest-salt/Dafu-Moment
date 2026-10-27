-- =====================================================
-- 大福食刻 DDL · 01_user.sql（用户与身份 · 16 表）
-- MySQL 8.0 兼容 | InnoDB | utf8mb4 | 统一软删除 | 无级联删除
-- =====================================================
SET NAMES utf8mb4;

-- 1. 用户
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户唯一标识',
  `nickname` VARCHAR(64) NULL COMMENT '昵称',
  `avatar` VARCHAR(255) NULL COMMENT '头像（MinIO object_key，拍板0.4）',
  `verified_status` TINYINT NOT NULL DEFAULT 0 COMMENT '0=未认证 1=已认证（2=驳回 预留）',
  `student_no` VARCHAR(32) NULL COMMENT '学号（绑定后回填冗余；唯一凭据以campus_auth为准）',
  `phone` VARCHAR(255) NULL COMMENT '手机号（加密存储，禁止明文入库）',
  `phone_hash` CHAR(64) NULL COMMENT '手机号 SHA-256 加盐摘要（仅用于查找/查重与找回账号，不用于展示）',
  `password_hash` VARCHAR(255) NULL COMMENT 'bcrypt散列（数据库不存可逆口令）；SSO用户可空',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0=正常 1=禁言 2=封禁 3=注销',
  `mute_until` DATETIME NULL COMMENT '禁言到期时间（status=1时有效）',
  `banned_at` DATETIME NULL COMMENT '封禁时间（status=2时有效）',
  `ban_reason` VARCHAR(255) NULL COMMENT '封禁原因',
  `last_login_at` DATETIME NULL COMMENT '最近登录时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间：NULL=有效',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_phone_hash` (`phone_hash`),
  UNIQUE KEY `uk_user_student_no` (`student_no`),
  CONSTRAINT `ck_user_status` CHECK (`status` IN (0,1,2,3))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户（user）';

-- 2. 校园身份认证
DROP TABLE IF EXISTS `campus_auth`;
CREATE TABLE `campus_auth` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '认证记录唯一标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '所属用户（0..1）',
  `student_no` VARCHAR(32) NOT NULL COMMENT '学号（唯一凭据，uk）',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0=未认证 1=已认证',
  `verified_at` DATETIME NULL COMMENT '认证通过时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_campus_auth_user` (`user_id`),
  UNIQUE KEY `uk_campus_auth_student_no` (`student_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='校园身份认证（campus_auth）；真实姓名不在本表：经 student_no JOIN mock_identity_dataset 取 real_name';

-- 3. 模拟身份认证数据集
DROP TABLE IF EXISTS `mock_identity_dataset`;
CREATE TABLE `mock_identity_dataset` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录标识',
  `student_no` VARCHAR(32) NOT NULL COMMENT '学号',
  `real_name` VARCHAR(64) NOT NULL COMMENT '姓名（仅演示）',
  `class_name` VARCHAR(64) NOT NULL COMMENT '班级',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mock_student_no` (`student_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='模拟身份认证数据集（mock_identity_dataset）';

-- 4. 饮食档案
DROP TABLE IF EXISTS `dietary_profile`;
CREATE TABLE `dietary_profile` (
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

-- 5. 隐私设置
DROP TABLE IF EXISTS `privacy_setting`;
CREATE TABLE `privacy_setting` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '设置标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '所属用户',
  `behavior_analysis_allowed` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '0=关 1=开（行为分析授权，撤回后画像/推荐停用）',
  `notification_enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '0=关 1=开（通知开关）',
  `matching_allowed` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=关 1=开（饭搭子匹配，首版默认关闭）',
  `diet_authorized` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '0=关 1=开（饮食档案授权，B图1开关）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_privacy_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='隐私设置（privacy_setting）';

-- 6. 角色
DROP TABLE IF EXISTS `role`;
CREATE TABLE `role` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '角色标识',
  `role_code` VARCHAR(64) NOT NULL COMMENT '角色编码',
  `role_name` VARCHAR(64) NOT NULL COMMENT '角色显示名',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_code` (`role_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='角色（role）；RBAC 以 B 方案为准';

-- 7. 权限
DROP TABLE IF EXISTS `permission`;
CREATE TABLE `permission` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '权限标识',
  `perm_code` VARCHAR(128) NOT NULL COMMENT '权限编码（模块:子模块:操作）',
  `perm_name` VARCHAR(64) NOT NULL COMMENT '权限显示名',
  `parent_id` BIGINT UNSIGNED NULL COMMENT '父权限节点（树状）',
  `grantable` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否可再授权',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_permission_code` (`perm_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='权限（permission）；RBAC 以 B 方案为准';

-- 8. 组
DROP TABLE IF EXISTS `user_group`;
CREATE TABLE `user_group` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '组标识',
  `group_name` VARCHAR(64) NOT NULL COMMENT '组名',
  `parent_id` BIGINT UNSIGNED NULL COMMENT '上级组',
  `data_scope` TINYINT NOT NULL DEFAULT 1 COMMENT '1=仅本人(SELF) 2=组范围(GROUP) 3=全量(ALL)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_group_name` (`group_name`),
  CONSTRAINT `ck_ug_scope` CHECK (`data_scope` IN (1,2,3))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='组（user_group）；RBAC 以 B 方案为准';

-- 9. 用户角色
DROP TABLE IF EXISTS `user_role`;
CREATE TABLE `user_role` (
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户',
  `role_id` BIGINT UNSIGNED NOT NULL COMMENT '角色',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授予时间',
  PRIMARY KEY (`user_id`, `role_id`),
  KEY `idx_user_role_role` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户角色（user_role）';

-- 10. 组成员
DROP TABLE IF EXISTS `user_group_member`;
CREATE TABLE `user_group_member` (
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户',
  `group_id` BIGINT UNSIGNED NOT NULL COMMENT '组',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  PRIMARY KEY (`user_id`, `group_id`),
  KEY `idx_ugm_group` (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='组成员（user_group_member）';

-- 11. 用户直接权限
DROP TABLE IF EXISTS `user_permission`;
CREATE TABLE `user_permission` (
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户',
  `permission_id` BIGINT UNSIGNED NOT NULL COMMENT '直接授予的权限（个别特例）',
  `scope` TINYINT NOT NULL DEFAULT 1 COMMENT '数据范围 1=仅本人 2=组范围 3=全量（可授权是授权关系属性）',
  `granted_by` BIGINT UNSIGNED NULL COMMENT '授予人；转授时必填，系统自动授予为空',
  `granted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授予时间',
  `grantable` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否可再转授（0=否；仅超级管理员授予时置 1，G-05）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授予时间',
  PRIMARY KEY (`user_id`, `permission_id`),
  CONSTRAINT `ck_up_scope` CHECK (`scope` IN (1,2,3))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户直接权限（user_permission）';

-- 12. 角色权限
DROP TABLE IF EXISTS `role_permission`;
CREATE TABLE `role_permission` (
  `role_id` BIGINT UNSIGNED NOT NULL COMMENT '角色',
  `permission_id` BIGINT UNSIGNED NOT NULL COMMENT '权限',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授予时间',
  PRIMARY KEY (`role_id`, `permission_id`),
  KEY `idx_rp_perm` (`permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='角色权限（role_permission）';

-- 13. 组权限
DROP TABLE IF EXISTS `group_permission`;
CREATE TABLE `group_permission` (
  `group_id` BIGINT UNSIGNED NOT NULL COMMENT '组',
  `permission_id` BIGINT UNSIGNED NOT NULL COMMENT '权限',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授予时间',
  PRIMARY KEY (`group_id`, `permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='组权限（group_permission）';

-- 14. 组角色
DROP TABLE IF EXISTS `group_role`;
CREATE TABLE `group_role` (
  `group_id` BIGINT UNSIGNED NOT NULL COMMENT '组',
  `role_id` BIGINT UNSIGNED NOT NULL COMMENT '角色',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授予时间',
  PRIMARY KEY (`group_id`, `role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='组角色（group_role）';

-- 14b. 组数据范围覆盖点位（G-05：GROUP 范围解析到具体点位集合；档口负责人写操作另行叠加 station_manager 校验，不再与绑定表取交集）
DROP TABLE IF EXISTS `user_group_location`;
CREATE TABLE `user_group_location` (
  `group_id` BIGINT UNSIGNED NOT NULL COMMENT '组',
  `location_id` BIGINT UNSIGNED NOT NULL COMMENT '被覆盖的点位',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登记时间',
  PRIMARY KEY (`group_id`, `location_id`),
  KEY `idx_ugl_location` (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='组数据范围覆盖点位（user_group_location）';

-- 15. 搜索历史
DROP TABLE IF EXISTS `search_history`;
CREATE TABLE `search_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '历史标识',
  `user_id` BIGINT UNSIGNED NULL COMMENT '搜索用户（可空=游客不留）',
  `keyword` VARCHAR(64) NOT NULL COMMENT '搜索词',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '搜索时间',
  PRIMARY KEY (`id`),
  KEY `idx_search_user_time` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='搜索历史（search_history）';

-- 16. 饮食限制（忌口/过敏原子表）
DROP TABLE IF EXISTS `dietary_restriction`;
CREATE TABLE `dietary_restriction` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '限制行标识',
  `dietary_profile_id` BIGINT UNSIGNED NOT NULL COMMENT '所属饮食档案',
  `type` TINYINT NOT NULL DEFAULT 1 COMMENT '1=忌口 2=过敏原（分开标记 4.6(3)）',
  `word` VARCHAR(64) NOT NULL COMMENT '食材/词（如 香菜、虾）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dietary_restriction` (`dietary_profile_id`, `type`, `word`),
  KEY `idx_dr_match` (`type`, `word`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='饮食限制（dietary_restriction）；过敏原为安全红线';
