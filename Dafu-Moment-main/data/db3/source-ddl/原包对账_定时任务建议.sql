-- 对账_定时任务建议.sql ｜ 应用层维护数据的一致性对账（建议每日一次：MySQL EVENT 或外部 cron）
-- 背景：review_summary 与 upload_asset.ref_count 由应用层事件维护，非数据库约束；
--       漏调用时数据静默偏移。本文件是"怎么发现它偏了"的统一入口。
-- 失效症状：① 榜单/详情均分与逐条评价手算不一致（review_summary 偏）
--           ② 资产 ref_count 永不归零、MinIO 存储持续上涨（ref_count 偏）
-- USE dafu_shike;

-- 1) review_summary ↔ rating_detail（与 校验SQL.sql 第 4 类一致；预期 0 行）
SELECT rs.biz_type, rs.biz_id, rs.dimension_id,
       rs.avg_score AS summary_avg, rs.review_count AS summary_count,
       ROUND(AVG(rd.score),2) AS actual_avg, COUNT(rd.id) AS actual_count
FROM review_summary rs
LEFT JOIN review r ON r.id = rs.biz_id AND rs.biz_type = 1 AND r.status = 0 AND r.deleted_at IS NULL
LEFT JOIN rating_detail rd ON rd.review_id = r.id AND rd.dimension_id = rs.dimension_id
GROUP BY rs.biz_type, rs.biz_id, rs.dimension_id
HAVING summary_avg != actual_avg OR summary_count != actual_count;

-- 2) upload_asset.ref_count ↔ 已知结构化引用源（预期 0 行）
--    覆盖：评价/打卡/手账图片、贴纸、菜品图、用户头像；
--    post.images 为 JSON 数组，SQL 无法统计——该部分由应用层在发帖/删帖事务对账。
SELECT u.id, u.object_key, u.ref_count AS stored_cnt, COALESCE(t.actual, 0) AS actual_cnt
FROM upload_asset u
LEFT JOIN (
  SELECT object_key, COUNT(*) AS actual FROM (
    SELECT object_key FROM review_image WHERE deleted_at IS NULL
    UNION ALL SELECT object_key FROM check_in_image
    UNION ALL SELECT object_key FROM journal_image
    UNION ALL SELECT object_key FROM sticker
    UNION ALL SELECT image AS object_key FROM dish WHERE image IS NOT NULL
    UNION ALL SELECT avatar AS object_key FROM `user` WHERE avatar IS NOT NULL
  ) x GROUP BY object_key
) t ON t.object_key = u.object_key
WHERE u.ref_count <> COALESCE(t.actual, 0);
