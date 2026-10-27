-- =====================================================
-- 大福食刻 DDL · 05_community.sql（社区与内容治理 · 10 表）
-- =====================================================
SET NAMES utf8mb4;

-- 1. 帖子
DROP TABLE IF EXISTS `post`;
CREATE TABLE `post` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '帖子标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '作者',
  `content` TEXT NOT NULL COMMENT '帖子正文',
  `images` JSON NULL COMMENT '图片（JSON 数组，元素为 MinIO object_key）',
  `post_type` TINYINT NOT NULL DEFAULT 1 COMMENT '1=动态 2=长帖（二期） 3=手账转帖',
  `journal_id` BIGINT UNSIGNED NULL COMMENT '来源手账（手账转帖回链）',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0=正常展示 1=下架（先发后审）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发布时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  KEY `idx_post_user_time` (`user_id`, `created_at`),
  KEY `idx_post_status_time` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='帖子（post）；长帖二期预留';

-- 2. 帖子关联
DROP TABLE IF EXISTS `post_link`;
CREATE TABLE `post_link` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '关联标识',
  `post_id` BIGINT UNSIGNED NOT NULL COMMENT '所属帖子',
  `biz_type` TINYINT NOT NULL DEFAULT 1 COMMENT '1=点位 2=菜品',
  `biz_id` BIGINT UNSIGNED NOT NULL COMMENT '关联对象ID（多态无外键）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_post_link` (`post_id`, `biz_type`, `biz_id`),
  KEY `idx_post_link_biz` (`biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='帖子关联（post_link）；多态，CON-23 级联软删';

-- 3. 评论
DROP TABLE IF EXISTS `review_reply`;
CREATE TABLE `review_reply` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '评论标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '评论作者',
  `content` TEXT NOT NULL COMMENT '评论文字',
  `parent_type` TINYINT NOT NULL DEFAULT 1 COMMENT '1=帖子 2=评价（多态父对象）',
  `parent_id` BIGINT UNSIGNED NOT NULL COMMENT '多态父对象ID',
  `reply_to_comment_id` BIGINT UNSIGNED NULL COMMENT '楼中楼：指向被回复评论',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0=正常展示 1=下架',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '评论时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  KEY `idx_reply_parent` (`parent_type`, `parent_id`),
  KEY `idx_reply_user_time` (`user_id`, `created_at`),
  KEY `idx_reply_reply_to` (`reply_to_comment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='评论（review_reply）；多态父对象 + 楼中楼自引用';

-- 4. 通知
DROP TABLE IF EXISTS `notification`;
CREATE TABLE `notification` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '通知标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '接收用户',
  `type` TINYINT NOT NULL COMMENT '1=评价获赞 2=帖子互动 3=审核结果 4=举报处理结果 5=系统消息',
  `biz_type` TINYINT NULL COMMENT '跳转目标类型（多态无外键）',
  `biz_id` BIGINT UNSIGNED NULL COMMENT '跳转目标ID',
  `is_read` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=未读 1=已读',
  `content` VARCHAR(255) NOT NULL COMMENT '通知文案（含跳转摘要）',
  `merge_key` VARCHAR(64) NULL COMMENT '同类合并展示键＝type＋biz_type（不含日期，跨天仍合并）；空=不合并；如需按天合并，由实现方加日期后缀并在此注明',
  `merge_count` INT NOT NULL DEFAULT 1 COMMENT '合并组内未读数；用户读过整组后归零（非条数累计）',
  `last_at` DATETIME NULL COMMENT '合并组内最近一条时间（列表排序用；created_at 为组内首条）',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '通知产生时间（合并组内为首条时间）',
  PRIMARY KEY (`id`),
  KEY `idx_notification_user_read` (`user_id`, `is_read`, `type`, `created_at`),
  KEY `idx_notification_biz` (`biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='通知（notification）';

-- 5. 审核记录
DROP TABLE IF EXISTS `audit_record`;
CREATE TABLE `audit_record` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '审核记录标识',
  `biz_type` TINYINT NOT NULL COMMENT '1=点位 2=档口 3=菜品 4=纠错 5=帖子 6=评论 7=评价',
  `biz_id` BIGINT UNSIGNED NOT NULL COMMENT '审核目标ID（多态无外键）',
  `submitter_id` BIGINT UNSIGNED NOT NULL COMMENT '内容提交者',
  `auditor_id` BIGINT UNSIGNED NULL COMMENT '审核管理员（待审核时为空）',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0=待审核 1=通过 2=驳回',
  `reason` VARCHAR(255) NULL COMMENT '驳回/处置原因',
  `version` INT NOT NULL DEFAULT 1 COMMENT '第几次提交（重提+1）',
  `resubmit_from_id` BIGINT UNSIGNED NULL COMMENT '重提来源（被驳回记录）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_audit_version` (`biz_type`, `biz_id`, `version`),
  KEY `idx_audit_biz` (`biz_type`, `biz_id`),
  KEY `idx_audit_status_time` (`status`, `created_at`),
  KEY `idx_audit_submitter` (`submitter_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='审核记录（audit_record）；E 审核：version + 重提链';

-- 6. 草稿
DROP TABLE IF EXISTS `draft`;
CREATE TABLE `draft` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '草稿标识',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '草稿归属用户',
  `draft_type` TINYINT NOT NULL COMMENT '1=点评 2=动态 3=长帖 4=手账转帖',
  `payload` JSON NOT NULL COMMENT '草稿整体快照（图片为 object_key 数组）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近保存时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  KEY `idx_draft_user_type` (`user_id`, `draft_type`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='草稿（draft）';

-- 7. 关注关系
DROP TABLE IF EXISTS `follow_relation`;
CREATE TABLE `follow_relation` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '关注标识',
  `follower_id` BIGINT UNSIGNED NOT NULL COMMENT '关注人（发起方）',
  `followee_id` BIGINT UNSIGNED NOT NULL COMMENT '被关注人',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '关注时间',
  `deleted_at` DATETIME NULL COMMENT '软删除时间：NULL=有效（取消关注=写入 deleted_at）',
  `valid_flag` BIGINT GENERATED ALWAYS AS (IF(`deleted_at` IS NULL, 1, NULL)) STORED COMMENT '有效行标志',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_follow` (`follower_id`, `followee_id`, `valid_flag`),
  KEY `idx_follow_followee` (`followee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='关注关系（follow_relation）；互关=双向两行';

-- 8. 操作日志
DROP TABLE IF EXISTS `operation_log`;
CREATE TABLE `operation_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志标识',
  `operator_id` BIGINT UNSIGNED NOT NULL COMMENT '操作管理员',
  `action_type` TINYINT NULL COMMENT '操作类型（审核/驳回/封禁/数据维护等，取值待产品定）',
  `biz_type` TINYINT NULL COMMENT '操作对象类型（多态）',
  `biz_id` BIGINT UNSIGNED NULL COMMENT '操作对象ID',
  `result` TINYINT NULL COMMENT '操作结果（取值待产品定）',
  `content` VARCHAR(255) NULL COMMENT '操作摘要',
  `reason` VARCHAR(255) NULL COMMENT '操作原因',
  `operated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作发生时间（区别于 created_at 落库时间）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  PRIMARY KEY (`id`),
  KEY `idx_oplog_operator_time` (`operator_id`, `created_at`),
  KEY `idx_oplog_biz` (`biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='操作日志（operation_log）';

-- 9. 敏感词库
DROP TABLE IF EXISTS `banned_word`;
CREATE TABLE `banned_word` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '词库行标识',
  `word` VARCHAR(64) NOT NULL COMMENT '敏感词',
  `category` TINYINT NOT NULL COMMENT '1=广告 2=辱骂 3=隐私 4=其他',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '0=停用 1=启用',
  `severity` TINYINT NOT NULL DEFAULT 1 COMMENT '1=低级（替换占位符后照常发布） 2=高级（转人工待审）',
  `action` TINYINT NOT NULL DEFAULT 2 COMMENT '处置方式 1=替换 2=拦截(422)；高级词转人工待审→review.status=2（G-02）',
  `created_by` BIGINT UNSIGNED NULL COMMENT '词库维护管理员',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登记时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_banned_word` (`word`),
  KEY `idx_banned_status` (`status`),
  CONSTRAINT `ck_bw_severity` CHECK (`severity` IN (1,2)),
  CONSTRAINT `ck_bw_action` CHECK (`action` IN (1,2))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='敏感词库（banned_word）';

-- 10. 上传资产
DROP TABLE IF EXISTS `upload_asset`;
CREATE TABLE `upload_asset` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '资产标识',
  `object_key` VARCHAR(255) NOT NULL COMMENT 'MinIO 对象键',
  `hash_dhash` VARCHAR(64) NOT NULL COMMENT 'dHash 感知哈希',
  `size` INT NOT NULL COMMENT '文件字节数（≤5MB）',
  `mime` VARCHAR(64) NOT NULL COMMENT '文件 MIME 类型',
  `uploader_id` BIGINT UNSIGNED NULL COMMENT '上传用户（可空）',
  `ref_count` INT NOT NULL DEFAULT 0 COMMENT '被引用次数（0可垃圾回收）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_upload_dhash` (`hash_dhash`),
  KEY `idx_upload_uploader` (`uploader_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='上传资产（upload_asset）；dHash 判重＋引用计数垃圾回收';

-- 12. 众包录入申请（point_submit）——承载 CON-01「可提交新增菜品申请，进入审核队列」
DROP TABLE IF EXISTS `point_submit`;
CREATE TABLE `point_submit` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '提交标识',
  `submitter_id` BIGINT UNSIGNED NOT NULL COMMENT '提交人（FK→user）',
  `submit_type` TINYINT NOT NULL COMMENT '0=点位 1=档口 2=菜品',
  `target_id` BIGINT UNSIGNED NULL COMMENT '挂靠对象：提交档口时为点位 ID，提交菜品时为档口 ID',
  `payload` JSON NOT NULL COMMENT '提交内容（结构同对应主表字段）',
  `audit_status` TINYINT NOT NULL DEFAULT 0 COMMENT '0=待审 1=通过 2=驳回',
  `auditor_id` BIGINT UNSIGNED NULL COMMENT '审核管理员（FK→user）',
  `audit_comment` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '审核意见',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
  PRIMARY KEY (`id`),
  KEY `idx_ps_status_time` (`audit_status`, `created_at`),
  CONSTRAINT `ck_ps_type` CHECK (`submit_type` IN (0,1,2)),
  CONSTRAINT `ck_ps_audit` CHECK (`audit_status` IN (0,1,2))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='众包录入申请（point_submit）；通过后写主表';
