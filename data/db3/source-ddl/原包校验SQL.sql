-- 校验SQL.sql ｜ ≥4 类校验，每条带预期
-- 数据库：dafu_shike ｜ MySQL 8.0
USE `dafu_shike`;

-- ===== 1. 建表数量（预期 = 底表实体数 74）=====
SELECT COUNT(*) AS '基础表数'
FROM information_schema.tables
WHERE table_schema = 'dafu_shike' AND table_type = 'BASE TABLE';
-- 预期：74

-- ===== 2. 外键数量（预期 = DDL 中 ALTER 数）=====
SELECT COUNT(*) AS '外键约束数'
FROM information_schema.table_constraints
WHERE constraint_schema = 'dafu_shike' AND constraint_type = 'FOREIGN KEY';
-- 预期：与 07_fk.sql 中 ALTER 行数一致

-- ===== 2b. 主键数量（预期 = 表数 74）=====
SELECT COUNT(*) AS '主键约束数'
FROM information_schema.table_constraints
WHERE constraint_schema = 'dafu_shike' AND constraint_type = 'PRIMARY KEY';
-- 预期：74

-- ===== 3a. 唯一键防重：点赞（预期 0 行）=====
SELECT user_id, biz_type, biz_id, COUNT(*) AS cnt
FROM review_like WHERE deleted_at IS NULL
GROUP BY user_id, biz_type, biz_id HAVING cnt > 1;

-- ===== 3b. 唯一键防重：收藏（预期 0 行）=====
SELECT user_id, biz_type, biz_id, COUNT(*) AS cnt
FROM favorite WHERE deleted_at IS NULL
GROUP BY user_id, biz_type, biz_id HAVING cnt > 1;

-- ===== 3c. 唯一键防重：关注（预期 0 行）=====
SELECT follower_id, followee_id, COUNT(*) AS cnt
FROM follow_relation WHERE deleted_at IS NULL
GROUP BY follower_id, followee_id HAVING cnt > 1;

-- ===== 3d. 唯一键防重：足迹（预期 0 行）=====
SELECT user_id, location_id, COUNT(*) AS cnt
FROM footprint
GROUP BY user_id, location_id HAVING cnt > 1;

-- ===== 3e. 唯一键防重：任务领取（预期 0 行）=====
SELECT user_id, task_id, claim_date, COUNT(*) AS cnt
FROM task_claim
GROUP BY user_id, task_id, claim_date HAVING cnt > 1;

-- ===== 3f. 唯一键防重：评价标签（预期 0 行）=====
SELECT review_id, tag_id, COUNT(*) AS cnt
FROM review_tag
GROUP BY review_id, tag_id HAVING cnt > 1;

-- ===== 3g. 唯一键防重：审核版本（预期 0 行）=====
SELECT biz_type, biz_id, version, COUNT(*) AS cnt
FROM audit_record
GROUP BY biz_type, biz_id, version HAVING cnt > 1;

-- ===== 4. 聚合对账：review_summary ↔ 明细（按对象类型分派＋双向；预期 0 行）=====
-- review_summary.biz_type：1=点位(review.location_id) 2=档口(review.station_id) 3=菜品(review.dish_id)
-- 有效评价 = status=0 且 deleted_at IS NULL；status=2 待人工审核不参与聚合
-- 双向：A) 有效明细存在但汇总缺失或数值不符  B) 汇总存在但有效明细缺失（引用失效）
SELECT 'A 缺失汇总或数值不符' AS 场景, a.biz_type, a.biz_id, a.dimension_id,
       a.a_avg AS actual_avg, a.a_cnt AS actual_count, s.avg_score AS summary_avg, s.review_count AS summary_count
FROM (
  SELECT 1 AS biz_type, r.location_id AS biz_id, rd.dimension_id,
         ROUND(AVG(rd.score),2) AS a_avg, COUNT(rd.id) AS a_cnt
  FROM review r JOIN rating_detail rd ON rd.review_id = r.id
  WHERE r.status = 0 AND r.deleted_at IS NULL AND r.location_id IS NOT NULL
  GROUP BY r.location_id, rd.dimension_id
  UNION ALL
  SELECT 2, r.station_id, rd.dimension_id, ROUND(AVG(rd.score),2), COUNT(rd.id)
  FROM review r JOIN rating_detail rd ON rd.review_id = r.id
  WHERE r.status = 0 AND r.deleted_at IS NULL AND r.station_id IS NOT NULL
  GROUP BY r.station_id, rd.dimension_id
  UNION ALL
  SELECT 3, r.dish_id, rd.dimension_id, ROUND(AVG(rd.score),2), COUNT(rd.id)
  FROM review r JOIN rating_detail rd ON rd.review_id = r.id
  WHERE r.status = 0 AND r.deleted_at IS NULL AND r.dish_id IS NOT NULL
  GROUP BY r.dish_id, rd.dimension_id
) a
LEFT JOIN review_summary s
  ON s.biz_type = a.biz_type AND s.biz_id = a.biz_id AND s.dimension_id = a.dimension_id
WHERE s.biz_type IS NULL OR s.avg_score != a.a_avg OR s.review_count != a.a_cnt
UNION ALL
SELECT 'B 汇总引用失效（无有效明细）' AS 场景, s.biz_type, s.biz_id, s.dimension_id,
       a.a_avg, a.a_cnt, s.avg_score, s.review_count
FROM review_summary s
LEFT JOIN (
  SELECT 1 AS biz_type, r.location_id AS biz_id, rd.dimension_id,
         ROUND(AVG(rd.score),2) AS a_avg, COUNT(rd.id) AS a_cnt
  FROM review r JOIN rating_detail rd ON rd.review_id = r.id
  WHERE r.status = 0 AND r.deleted_at IS NULL AND r.location_id IS NOT NULL
  GROUP BY r.location_id, rd.dimension_id
  UNION ALL
  SELECT 2, r.station_id, rd.dimension_id, ROUND(AVG(rd.score),2), COUNT(rd.id)
  FROM review r JOIN rating_detail rd ON rd.review_id = r.id
  WHERE r.status = 0 AND r.deleted_at IS NULL AND r.station_id IS NOT NULL
  GROUP BY r.station_id, rd.dimension_id
  UNION ALL
  SELECT 3, r.dish_id, rd.dimension_id, ROUND(AVG(rd.score),2), COUNT(rd.id)
  FROM review r JOIN rating_detail rd ON rd.review_id = r.id
  WHERE r.status = 0 AND r.deleted_at IS NULL AND r.dish_id IS NOT NULL
  GROUP BY r.dish_id, rd.dimension_id
) a ON a.biz_type = s.biz_type AND a.biz_id = s.biz_id AND a.dimension_id = s.dimension_id
WHERE a.biz_type IS NULL OR s.avg_score != a.a_avg OR s.review_count != a.a_cnt;
-- 预期：0 行（双向均一致）

-- ===== 5a. 枚举越界抽检：review.meal_mode（预期 0 行）=====
SELECT COUNT(*) FROM review WHERE meal_mode NOT IN (1,2,3);

-- ===== 5b. 枚举越界抽检：user.status（预期 0 行）=====
SELECT COUNT(*) FROM `user` WHERE status NOT IN (0,1,2,3);

-- ===== 5c-1. 维度×就餐方式无合法配对（NOT EXISTS；预期 0 行）=====
-- 覆盖：①配置了适配但不含该就餐方式 ②该维度完全没有适配行（原 NOT IN 写法会漏）
SELECT rd.review_id, rd.dimension_id, r.meal_mode
FROM rating_detail rd
JOIN review r ON r.id = rd.review_id AND r.status = 0 AND r.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM review_dimension_meal_mode m
  WHERE m.dimension_id = rd.dimension_id AND m.meal_mode = r.meal_mode
);
-- 预期：0 行（每条明细的维度都适应该评价的就餐方式）

-- ===== 5c-2. 有效评价缺少必填维度明细（预期 0 行）=====
SELECT r.id AS review_id, d.id AS dimension_id
FROM review r
CROSS JOIN review_dimension d
LEFT JOIN rating_detail rd ON rd.review_id = r.id AND rd.dimension_id = d.id
WHERE d.is_required = 1 AND r.status = 0 AND r.deleted_at IS NULL AND rd.id IS NULL
LIMIT 10;
-- 预期：0 行（is_required=1 的维度必有明细）

-- ===== 6. 多态孤儿引用（目标已删/不存在，预期 0 行）=====
-- 说明：多态列无外键，目标被物理删除或写入脏 ID 时会出现孤儿
SELECT 'review_like' AS src, x.biz_type, COUNT(*) AS orphan_cnt
FROM review_like x
WHERE (x.biz_type = 1 AND NOT EXISTS (SELECT 1 FROM `review` t WHERE t.id = x.biz_id))
   OR (x.biz_type = 2 AND NOT EXISTS (SELECT 1 FROM post t WHERE t.id = x.biz_id))
   OR (x.biz_type = 3 AND NOT EXISTS (SELECT 1 FROM review_reply t WHERE t.id = x.biz_id))
GROUP BY x.biz_type
UNION ALL
SELECT 'favorite', x.biz_type, COUNT(*)
FROM favorite x
WHERE (x.biz_type = 1 AND NOT EXISTS (SELECT 1 FROM location t WHERE t.id = x.biz_id))
   OR (x.biz_type = 2 AND NOT EXISTS (SELECT 1 FROM station t WHERE t.id = x.biz_id))
   OR (x.biz_type = 3 AND NOT EXISTS (SELECT 1 FROM dish t WHERE t.id = x.biz_id))
   OR (x.biz_type = 4 AND NOT EXISTS (SELECT 1 FROM post t WHERE t.id = x.biz_id))
GROUP BY x.biz_type
UNION ALL
SELECT 'report', x.biz_type, COUNT(*)
FROM report x
WHERE (x.biz_type = 1 AND NOT EXISTS (SELECT 1 FROM location t WHERE t.id = x.biz_id))
   OR (x.biz_type = 2 AND NOT EXISTS (SELECT 1 FROM station t WHERE t.id = x.biz_id))
   OR (x.biz_type = 3 AND NOT EXISTS (SELECT 1 FROM dish t WHERE t.id = x.biz_id))
   OR (x.biz_type = 4 AND NOT EXISTS (SELECT 1 FROM post t WHERE t.id = x.biz_id))
   OR (x.biz_type = 5 AND NOT EXISTS (SELECT 1 FROM review_reply t WHERE t.id = x.biz_id))
   OR (x.biz_type = 6 AND NOT EXISTS (SELECT 1 FROM `review` t WHERE t.id = x.biz_id))
GROUP BY x.biz_type;
-- 预期：0 行（各类型均无孤儿）
