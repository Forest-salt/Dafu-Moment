-- 001：只补现有22表缺失的列注释；不改类型/默认值/索引，不增删行。
-- 在已选中的独立测试库先验证；不含CREATE DATABASE或USE，不指定线上库。
-- 已有非空注释保留；不存在的表/列跳过。原始定义不一致时应先停止并人工核对。
-- 只在当前结构与本补丁基线一致时执行，见 docs/data/README.md。

-- user.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `user` MODIFY COLUMN `id` BIGINT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- canteen.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'canteen'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'int' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `canteen` MODIFY COLUMN `id` INT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- canteen.campus
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'canteen'
      AND COLUMN_NAME = 'campus' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'varchar(32)' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> '旗山校区' AND EXTRA <=> '' AND COLLATION_NAME <=> 'utf8mb4_0900_ai_ci' AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `canteen` MODIFY COLUMN `campus` VARCHAR(32) NOT NULL DEFAULT ''旗山校区'' COMMENT ''所属校区''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- station.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'station'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'int' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `station` MODIFY COLUMN `id` INT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- station.canteen_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'station'
      AND COLUMN_NAME = 'canteen_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'int' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `station` MODIFY COLUMN `canteen_id` INT NOT NULL COMMENT ''所属点位ID（canteen.id）''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- station.created_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'station'
      AND COLUMN_NAME = 'created_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> 'CURRENT_TIMESTAMP' AND EXTRA <=> 'DEFAULT_GENERATED' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `station` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''创建时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- dish.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dish'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'int' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `dish` MODIFY COLUMN `id` INT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- dish.station_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dish'
      AND COLUMN_NAME = 'station_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'int' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `dish` MODIFY COLUMN `station_id` INT NOT NULL COMMENT ''所属档口ID（station.id）''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- dish.name
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dish'
      AND COLUMN_NAME = 'name' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'varchar(64)' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> 'utf8mb4_0900_ai_ci' AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `dish` MODIFY COLUMN `name` VARCHAR(64) NOT NULL COMMENT ''名称''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- dish.cover_object_key
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dish'
      AND COLUMN_NAME = 'cover_object_key' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'varchar(255)' AND IS_NULLABLE <=> 'YES' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> 'utf8mb4_0900_ai_ci' AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `dish` MODIFY COLUMN `cover_object_key` VARCHAR(255) NULL COMMENT ''封面图MinIO对象键''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- dish.created_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dish'
      AND COLUMN_NAME = 'created_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> 'CURRENT_TIMESTAMP' AND EXTRA <=> 'DEFAULT_GENERATED' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `dish` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''创建时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- dish.updated_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dish'
      AND COLUMN_NAME = 'updated_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> 'CURRENT_TIMESTAMP' AND EXTRA <=> 'DEFAULT_GENERATED on update CURRENT_TIMESTAMP' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `dish` MODIFY COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT ''更新时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review_dimension.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review_dimension'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'int' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review_dimension` MODIFY COLUMN `id` INT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review` MODIFY COLUMN `id` BIGINT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review.user_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review'
      AND COLUMN_NAME = 'user_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review` MODIFY COLUMN `user_id` BIGINT NOT NULL COMMENT ''所属用户ID（user.id）''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review.subject_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review'
      AND COLUMN_NAME = 'subject_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'int' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review` MODIFY COLUMN `subject_id` INT NOT NULL COMMENT ''目标ID，由subject_type指定目标表''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review.created_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review'
      AND COLUMN_NAME = 'created_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> 'CURRENT_TIMESTAMP' AND EXTRA <=> 'DEFAULT_GENERATED' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''创建时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review.updated_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review'
      AND COLUMN_NAME = 'updated_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> 'CURRENT_TIMESTAMP' AND EXTRA <=> 'DEFAULT_GENERATED on update CURRENT_TIMESTAMP' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review` MODIFY COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT ''更新时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review_image.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review_image'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review_image` MODIFY COLUMN `id` BIGINT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review_image.review_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review_image'
      AND COLUMN_NAME = 'review_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review_image` MODIFY COLUMN `review_id` BIGINT NOT NULL COMMENT ''所属评价ID（review.id）''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review_summary.subject_type
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review_summary'
      AND COLUMN_NAME = 'subject_type' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'tinyint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review_summary` MODIFY COLUMN `subject_type` TINYINT NOT NULL COMMENT ''目标类型：0菜品、1档口、2点位''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review_summary.subject_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review_summary'
      AND COLUMN_NAME = 'subject_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'int' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review_summary` MODIFY COLUMN `subject_id` INT NOT NULL COMMENT ''目标ID，由subject_type指定目标表''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review_summary.hist_1
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review_summary'
      AND COLUMN_NAME = 'hist_1' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'int' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> '0' AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review_summary` MODIFY COLUMN `hist_1` INT NOT NULL DEFAULT 0 COMMENT ''四舍五入后归入1星桶的已发布评价数''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review_summary.hist_2
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review_summary'
      AND COLUMN_NAME = 'hist_2' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'int' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> '0' AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review_summary` MODIFY COLUMN `hist_2` INT NOT NULL DEFAULT 0 COMMENT ''四舍五入后归入2星桶的已发布评价数''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review_summary.hist_3
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review_summary'
      AND COLUMN_NAME = 'hist_3' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'int' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> '0' AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review_summary` MODIFY COLUMN `hist_3` INT NOT NULL DEFAULT 0 COMMENT ''四舍五入后归入3星桶的已发布评价数''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review_summary.hist_4
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review_summary'
      AND COLUMN_NAME = 'hist_4' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'int' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> '0' AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review_summary` MODIFY COLUMN `hist_4` INT NOT NULL DEFAULT 0 COMMENT ''四舍五入后归入4星桶的已发布评价数''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review_summary.hist_5
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review_summary'
      AND COLUMN_NAME = 'hist_5' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'int' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> '0' AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review_summary` MODIFY COLUMN `hist_5` INT NOT NULL DEFAULT 0 COMMENT ''四舍五入后归入5星桶的已发布评价数''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- favorite.user_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'favorite'
      AND COLUMN_NAME = 'user_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `favorite` MODIFY COLUMN `user_id` BIGINT NOT NULL COMMENT ''所属用户ID（user.id）''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- favorite.subject_type
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'favorite'
      AND COLUMN_NAME = 'subject_type' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'tinyint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `favorite` MODIFY COLUMN `subject_type` TINYINT NOT NULL COMMENT ''目标类型：0菜品、1档口、2点位''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- favorite.subject_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'favorite'
      AND COLUMN_NAME = 'subject_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'int' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `favorite` MODIFY COLUMN `subject_id` INT NOT NULL COMMENT ''目标ID，由subject_type指定目标表''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- favorite.created_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'favorite'
      AND COLUMN_NAME = 'created_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> 'CURRENT_TIMESTAMP' AND EXTRA <=> 'DEFAULT_GENERATED' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `favorite` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''创建时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review_like.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review_like'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review_like` MODIFY COLUMN `id` BIGINT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review_like.created_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review_like'
      AND COLUMN_NAME = 'created_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> 'CURRENT_TIMESTAMP' AND EXTRA <=> 'DEFAULT_GENERATED' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review_like` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''创建时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- report.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `report` MODIFY COLUMN `id` BIGINT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- report.reporter_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report'
      AND COLUMN_NAME = 'reporter_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `report` MODIFY COLUMN `reporter_id` BIGINT NOT NULL COMMENT ''举报人ID（user.id）''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- report.subject_type
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report'
      AND COLUMN_NAME = 'subject_type' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'tinyint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `report` MODIFY COLUMN `subject_type` TINYINT NOT NULL COMMENT ''举报目标类型（既有接口允许0、1、2；目标映射按业务接口）''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- report.detail
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report'
      AND COLUMN_NAME = 'detail' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'varchar(300)' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> '' AND EXTRA <=> '' AND COLLATION_NAME <=> 'utf8mb4_0900_ai_ci' AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `report` MODIFY COLUMN `detail` VARCHAR(300) NOT NULL DEFAULT '''' COMMENT ''举报补充说明''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- report.handled_by
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report'
      AND COLUMN_NAME = 'handled_by' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'YES' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `report` MODIFY COLUMN `handled_by` BIGINT NULL COMMENT ''处理管理员ID（user.id），未处理时为空''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- report.handled_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report'
      AND COLUMN_NAME = 'handled_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'YES' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `report` MODIFY COLUMN `handled_at` DATETIME NULL COMMENT ''处理时间，未处理时为空''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- report.created_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report'
      AND COLUMN_NAME = 'created_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> 'CURRENT_TIMESTAMP' AND EXTRA <=> 'DEFAULT_GENERATED' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `report` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''创建时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- station_post.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'station_post'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `station_post` MODIFY COLUMN `id` BIGINT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- station_post.station_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'station_post'
      AND COLUMN_NAME = 'station_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'int' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `station_post` MODIFY COLUMN `station_id` INT NOT NULL COMMENT ''所属档口ID（station.id）''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- station_post.author_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'station_post'
      AND COLUMN_NAME = 'author_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `station_post` MODIFY COLUMN `author_id` BIGINT NOT NULL COMMENT ''公告作者ID（user.id）''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- station_post.content
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'station_post'
      AND COLUMN_NAME = 'content' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'varchar(200)' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> 'utf8mb4_0900_ai_ci' AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `station_post` MODIFY COLUMN `content` VARCHAR(200) NOT NULL COMMENT ''正文内容''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- station_post.starts_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'station_post'
      AND COLUMN_NAME = 'starts_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'YES' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `station_post` MODIFY COLUMN `starts_at` DATETIME NULL COMMENT ''生效开始时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- station_post.ends_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'station_post'
      AND COLUMN_NAME = 'ends_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'YES' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `station_post` MODIFY COLUMN `ends_at` DATETIME NULL COMMENT ''生效结束时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- station_post.created_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'station_post'
      AND COLUMN_NAME = 'created_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> 'CURRENT_TIMESTAMP' AND EXTRA <=> 'DEFAULT_GENERATED' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `station_post` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''创建时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- banned_word.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'banned_word'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'int' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `banned_word` MODIFY COLUMN `id` INT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- banned_word.word
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'banned_word'
      AND COLUMN_NAME = 'word' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'varchar(64)' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> 'utf8mb4_0900_ai_ci' AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `banned_word` MODIFY COLUMN `word` VARCHAR(64) NOT NULL COMMENT ''敏感词文本''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- notification.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `notification` MODIFY COLUMN `id` BIGINT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- notification.user_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification'
      AND COLUMN_NAME = 'user_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `notification` MODIFY COLUMN `user_id` BIGINT NOT NULL COMMENT ''所属用户ID（user.id）''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- notification.title
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification'
      AND COLUMN_NAME = 'title' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'varchar(100)' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> 'utf8mb4_0900_ai_ci' AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `notification` MODIFY COLUMN `title` VARCHAR(100) NOT NULL COMMENT ''通知标题''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- notification.content
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification'
      AND COLUMN_NAME = 'content' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'varchar(500)' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> '' AND EXTRA <=> '' AND COLLATION_NAME <=> 'utf8mb4_0900_ai_ci' AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `notification` MODIFY COLUMN `content` VARCHAR(500) NOT NULL DEFAULT '''' COMMENT ''正文内容''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- notification.ref_type
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification'
      AND COLUMN_NAME = 'ref_type' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'varchar(32)' AND IS_NULLABLE <=> 'YES' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> 'utf8mb4_0900_ai_ci' AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `notification` MODIFY COLUMN `ref_type` VARCHAR(32) NULL COMMENT ''关联业务类型''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- notification.ref_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification'
      AND COLUMN_NAME = 'ref_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'YES' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `notification` MODIFY COLUMN `ref_id` BIGINT NULL COMMENT ''关联业务记录ID，由ref_type指定含义''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- notification.read_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification'
      AND COLUMN_NAME = 'read_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'YES' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `notification` MODIFY COLUMN `read_at` DATETIME NULL COMMENT ''已读时间，未读时为空''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- notification.created_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification'
      AND COLUMN_NAME = 'created_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> 'CURRENT_TIMESTAMP' AND EXTRA <=> 'DEFAULT_GENERATED' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `notification` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''创建时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review_reply.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review_reply'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review_reply` MODIFY COLUMN `id` BIGINT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review_reply.review_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review_reply'
      AND COLUMN_NAME = 'review_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review_reply` MODIFY COLUMN `review_id` BIGINT NOT NULL COMMENT ''所属评价ID（review.id）''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review_reply.user_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review_reply'
      AND COLUMN_NAME = 'user_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review_reply` MODIFY COLUMN `user_id` BIGINT NOT NULL COMMENT ''所属用户ID（user.id）''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review_reply.content
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review_reply'
      AND COLUMN_NAME = 'content' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'varchar(500)' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> 'utf8mb4_0900_ai_ci' AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review_reply` MODIFY COLUMN `content` VARCHAR(500) NOT NULL COMMENT ''正文内容''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- review_reply.created_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'review_reply'
      AND COLUMN_NAME = 'created_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> 'CURRENT_TIMESTAMP' AND EXTRA <=> 'DEFAULT_GENERATED' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `review_reply` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''创建时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- point_submit.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'point_submit'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `point_submit` MODIFY COLUMN `id` BIGINT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- point_submit.created_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'point_submit'
      AND COLUMN_NAME = 'created_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> 'CURRENT_TIMESTAMP' AND EXTRA <=> 'DEFAULT_GENERATED' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `point_submit` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''创建时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- ai_conversation.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_conversation'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `ai_conversation` MODIFY COLUMN `id` BIGINT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- ai_conversation.user_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_conversation'
      AND COLUMN_NAME = 'user_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `ai_conversation` MODIFY COLUMN `user_id` BIGINT NOT NULL COMMENT ''所属用户ID（user.id）''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- ai_conversation.created_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_conversation'
      AND COLUMN_NAME = 'created_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> 'CURRENT_TIMESTAMP' AND EXTRA <=> 'DEFAULT_GENERATED' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `ai_conversation` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''创建时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- ai_provider.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_provider'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'int' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `ai_provider` MODIFY COLUMN `id` INT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- ai_model.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_model'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `ai_model` MODIFY COLUMN `id` BIGINT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- ai_model.created_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_model'
      AND COLUMN_NAME = 'created_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> 'CURRENT_TIMESTAMP' AND EXTRA <=> 'DEFAULT_GENERATED' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `ai_model` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''创建时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- ai_platform_model.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_platform_model'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `ai_platform_model` MODIFY COLUMN `id` BIGINT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- ai_platform_model.created_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_platform_model'
      AND COLUMN_NAME = 'created_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> 'CURRENT_TIMESTAMP' AND EXTRA <=> 'DEFAULT_GENERATED' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `ai_platform_model` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''创建时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- sticker.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sticker'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `sticker` MODIFY COLUMN `id` BIGINT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- sticker.user_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sticker'
      AND COLUMN_NAME = 'user_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `sticker` MODIFY COLUMN `user_id` BIGINT NOT NULL COMMENT ''所属用户ID（user.id）''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- sticker.created_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sticker'
      AND COLUMN_NAME = 'created_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> 'CURRENT_TIMESTAMP' AND EXTRA <=> 'DEFAULT_GENERATED' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `sticker` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''创建时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- journal.id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'journal'
      AND COLUMN_NAME = 'id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> 'auto_increment' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `journal` MODIFY COLUMN `id` BIGINT AUTO_INCREMENT COMMENT ''主键标识''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- journal.user_id
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'journal'
      AND COLUMN_NAME = 'user_id' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'bigint' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> NULL AND EXTRA <=> '' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `journal` MODIFY COLUMN `user_id` BIGINT NOT NULL COMMENT ''所属用户ID（user.id）''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;

-- journal.created_at
SET @d_comment_sql = IF(EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'journal'
      AND COLUMN_NAME = 'created_at' AND COLUMN_COMMENT = '' AND COLUMN_TYPE <=> 'datetime' AND IS_NULLABLE <=> 'NO' AND COLUMN_DEFAULT <=> 'CURRENT_TIMESTAMP' AND EXTRA <=> 'DEFAULT_GENERATED' AND COLLATION_NAME <=> NULL AND GENERATION_EXPRESSION <=> ''
), 'ALTER TABLE `journal` MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''创建时间''', 'DO 0');
PREPARE d_comment_stmt FROM @d_comment_sql;
EXECUTE d_comment_stmt;
DEALLOCATE PREPARE d_comment_stmt;
