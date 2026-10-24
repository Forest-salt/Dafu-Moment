-- 校验样例_五场景.sql ｜ 用最小样例数据演示第 4 类 / 5c-1 / 5c-2 的判定行为
-- 事务内造数，结束 ROLLBACK，不留任何数据。前置：99_seed 已提供 review_dimension 1~5 及适配行、必填标记（口味/份量必填）。
-- 场景：① 合法多方式维度（不应报） ② 非法就餐方式（5c-1 报 1 行）
--       ③ 无适配行维度（5c-1 报 1 行——原 NOT IN 写法会漏掉的类型）
--       ④ 有效评价无明细（5c-2 报 2 行：缺必填的口味/份量）
--       ⑤ 缺失汇总＋数值不符（4 类双向：⑤b 3 行缺失、⑤a 1 行数值不符）
USE dafu_shike;
START TRANSACTION;

INSERT INTO `user` (id, nickname) VALUES (990001, '样例用户');
INSERT INTO `location` (id, name) VALUES (990001, '样例点位');
INSERT INTO `station` (id, location_id, name) VALUES (990001, 990001, '样例档口');
INSERT INTO `dish` (id, station_id, name, price) VALUES (990001, 990001, '样例菜品', 10.00);
INSERT INTO `review_dimension` (id, code, name, is_required, sort) VALUES (99, 'S1', '样例维度（无适配行）', 0, 99);

INSERT INTO `review` (id, user_id, location_id, station_id, meal_mode, status) VALUES
 (990001, 990001, 990001, 990001, 1, 0),  -- ② 堂食；将配非法方式明细（包装 dim3 仅支持 2/3）
 (990002, 990001, 990001, 990001, 1, 0),  -- ③ 堂食；将配无适配行维度 99
 (990003, 990001, 990001, 990001, 1, 0);  -- ④ 不配任何明细（缺必填维度）
INSERT INTO `review` (id, user_id, location_id, station_id, meal_mode, status) VALUES
 (990004, 990001, 990001, 990001, 1, 0);  -- ① 堂食；配口味(1)/份量(2)，两者均支持 1/2/3 → 合法
INSERT INTO `rating_detail` (review_id, dimension_id, score) VALUES
 (990004, 1, 4.50), (990004, 2, 3.50),
 (990001, 3, 4.00),                 -- ② 非法
 (990002, 99, 5.00);                -- ③ 无适配行

-- ⑤ 汇总样例：一条数值不符（dim1：汇总 9.99/99，实际聚合为 4.50/1）
INSERT INTO `review_summary` (biz_type, biz_id, dimension_id, avg_score, review_count)
VALUES (1, 990001, 1, 9.99, 99);

-- 场景①（预期 0 行：合法多方式维度不报）
SELECT '①合法多方式维度' AS 场景, rd.review_id, rd.dimension_id, r.meal_mode
FROM rating_detail rd
JOIN review r ON r.id = rd.review_id AND r.status = 0
WHERE rd.review_id = 990004
  AND NOT EXISTS (SELECT 1 FROM review_dimension_meal_mode m
                  WHERE m.dimension_id = rd.dimension_id AND m.meal_mode = r.meal_mode);

-- 场景②（预期 1 行：990001 × 维度3 × 方式1）
SELECT '②非法就餐方式' AS 场景, rd.review_id, rd.dimension_id, r.meal_mode
FROM rating_detail rd
JOIN review r ON r.id = rd.review_id AND r.status = 0
WHERE rd.review_id = 990001
  AND NOT EXISTS (SELECT 1 FROM review_dimension_meal_mode m
                  WHERE m.dimension_id = rd.dimension_id AND m.meal_mode = r.meal_mode);

-- 场景③（预期 1 行：990002 × 维度99 × 方式1）
SELECT '③无适配行维度' AS 场景, rd.review_id, rd.dimension_id, r.meal_mode
FROM rating_detail rd
JOIN review r ON r.id = rd.review_id AND r.status = 0
WHERE rd.review_id = 990002
  AND NOT EXISTS (SELECT 1 FROM review_dimension_meal_mode m
                  WHERE m.dimension_id = rd.dimension_id AND m.meal_mode = r.meal_mode);

-- 场景④（预期 2 行：990003 缺必填维度 1 与 2）
SELECT '④无明细缺必填维度' AS 场景, r.id AS review_id, d.id AS dimension_id
FROM review r
CROSS JOIN review_dimension d
LEFT JOIN rating_detail rd ON rd.review_id = r.id AND rd.dimension_id = d.id
WHERE d.is_required = 1 AND r.status = 0 AND r.id = 990003 AND rd.id IS NULL;

-- 场景⑤a（预期 1 行：汇总 9.99/99 vs 实际 4.50/1 → 数值不符）
SELECT '⑤a数值不符' AS 场景, a.biz_type, a.biz_id, a.dimension_id,
       a.a_avg AS actual_avg, a.a_cnt AS actual_count, s.avg_score AS summary_avg, s.review_count AS summary_count
FROM review_summary s
JOIN (
  SELECT 1 AS biz_type, r.location_id AS biz_id, rd.dimension_id,
         ROUND(AVG(rd.score),2) AS a_avg, COUNT(rd.id) AS a_cnt
  FROM review r JOIN rating_detail rd ON rd.review_id = r.id
  WHERE r.status = 0 AND r.location_id = 990001
  GROUP BY r.location_id, rd.dimension_id
) a ON a.biz_type = s.biz_type AND a.biz_id = s.biz_id AND a.dimension_id = s.dimension_id
WHERE s.avg_score != a.a_avg OR s.review_count != a.a_cnt;

-- 场景⑤b（预期 3 行：dim2/dim3/dim99 的实际聚合均无汇总行 → 缺失汇总）
SELECT '⑤b缺失汇总' AS 场景, a.biz_type, a.biz_id, a.dimension_id,
       a.a_avg AS actual_avg, a.a_cnt AS actual_count
FROM (
  SELECT 1 AS biz_type, r.location_id AS biz_id, rd.dimension_id,
         ROUND(AVG(rd.score),2) AS a_avg, COUNT(rd.id) AS a_cnt
  FROM review r JOIN rating_detail rd ON rd.review_id = r.id
  WHERE r.status = 0 AND r.location_id = 990001
  GROUP BY r.location_id, rd.dimension_id
) a
LEFT JOIN review_summary s ON s.biz_type = a.biz_type AND s.biz_id = a.biz_id AND s.dimension_id = a.dimension_id
WHERE s.biz_type IS NULL;

ROLLBACK;
SELECT '样例执行完毕（已 ROLLBACK，未留数据）' AS 结束标记;
