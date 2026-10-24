-- =====================================================================
-- seed_demo.sql ｜ 演示数据（让校验 SQL 第一次跑在真实数据上）
-- 用途：P1-1「空库假通过」的修复。仅在本地验证环境执行，不进生产。
-- 设计原则：① 满足所有 NOT NULL 与外键 ② 汇总与明细口径一致（对账应为 0 行）
-- =====================================================================
USE dafu_shike;

-- 0) 清理（按外键依赖顺序：子表 → 父表）
DELETE FROM ai_model          WHERE id BETWEEN 900001 AND 900009 OR user_id BETWEEN 900001 AND 900009;
DELETE FROM ai_platform_model WHERE id BETWEEN 900001 AND 900009;
DELETE FROM station_post      WHERE id BETWEEN 900001 AND 900009;
DELETE FROM point_submit      WHERE id BETWEEN 900001 AND 900009;
DELETE FROM rating_detail     WHERE review_id BETWEEN 900001 AND 900009;
DELETE FROM review_summary    WHERE biz_id BETWEEN 900001 AND 900009;
DELETE FROM `review`          WHERE id BETWEEN 900001 AND 900009;
DELETE FROM check_in          WHERE id BETWEEN 900001 AND 900009;
DELETE FROM footprint         WHERE id BETWEEN 900001 AND 900009;
DELETE FROM dish              WHERE id BETWEEN 900001 AND 900009;
DELETE FROM station           WHERE id BETWEEN 900001 AND 900009;
DELETE FROM location          WHERE id BETWEEN 900001 AND 900009;
DELETE FROM `user`            WHERE id BETWEEN 900001 AND 900009;

-- 1) 用户 / 点位 / 档口 / 菜品
INSERT INTO `user` (id, nickname, status) VALUES (900001, '演示用户', 0);
INSERT INTO location (id, name) VALUES (900001, '演示点位');
INSERT INTO station (id, location_id, name) VALUES (900001, 900001, '演示档口');
INSERT INTO dish (id, station_id, name, price) VALUES (900001, 900001, '演示菜品', 12.50);

-- 2) 两条评价（都挂在档口 900001）
INSERT INTO `review` (id, user_id, location_id, station_id, content, status, meal_mode)
  VALUES (900001, 900001, 900001, 900001, '好吃', 0, 1);
INSERT INTO `review` (id, user_id, location_id, station_id, content, status, meal_mode)
  VALUES (900002, 900001, 900001, 900001, '一般', 0, 1);

-- 3) 评分明细：dim1(口味) 4.5/3.5，dim2(份量) 4.0/4.0
INSERT INTO rating_detail (review_id, dimension_id, score) VALUES (900001, 1, 4.5);
INSERT INTO rating_detail (review_id, dimension_id, score) VALUES (900001, 2, 4.0);
INSERT INTO rating_detail (review_id, dimension_id, score) VALUES (900002, 1, 3.5);
INSERT INTO rating_detail (review_id, dimension_id, score) VALUES (900002, 2, 4.0);

-- 4) 汇总（对象=档口 biz_type=2, biz_id=900001）—— 与明细口径一致
--    dim1: (4.5+3.5)/2 = 4.00, count=2
--    dim2: (4.0+4.0)/2 = 4.00, count=2
INSERT INTO review_summary (biz_type, biz_id, dimension_id, avg_score, review_count)
  VALUES (2, 900001, 1, 4.00, 2);
INSERT INTO review_summary (biz_type, biz_id, dimension_id, avg_score, review_count)
  VALUES (2, 900001, 2, 4.00, 2);

-- 4b) 汇总（对象=点位 biz_type=1, biz_id=900001）—— 评价同时挂点位与档口，两边都要有汇总
INSERT INTO review_summary (biz_type, biz_id, dimension_id, avg_score, review_count)
  VALUES (1, 900001, 1, 4.00, 2);
INSERT INTO review_summary (biz_type, biz_id, dimension_id, avg_score, review_count)
  VALUES (1, 900001, 2, 4.00, 2);

-- 5) 打卡 + 足迹（同一用户同一点位只一条足迹）
INSERT INTO check_in (id, user_id, location_id, check_in_date) VALUES (900001, 900001, 900001, '2026-10-20');
INSERT INTO footprint (id, user_id, location_id, first_visit_at) VALUES (900001, 900001, 900001, NOW());


-- 6) 4 张新表各一条（让校验 SQL 覆盖新表）
DELETE FROM ai_model WHERE user_id BETWEEN 900001 AND 900009;
DELETE FROM ai_platform_model WHERE id BETWEEN 900001 AND 900009;
DELETE FROM station_post WHERE id BETWEEN 900001 AND 900009;
DELETE FROM point_submit WHERE id BETWEEN 900001 AND 900009;

INSERT INTO ai_platform_model (id, name, protocol, base_url, model_id, api_key_cipher, enabled, sort_order)
  VALUES (900001, '演示平台模型', 'openai', 'https://api.example.com', 'demo-model',
          'aXY=:dGFn:Y2lwaGVy', 1, 1);
INSERT INTO ai_model (id, user_id, platform_id, provider_key, protocol, base_url, model_id,
                      display_name, api_key_cipher, is_selected)
  VALUES (900001, 900001, 900001, 'platform', 'openai', 'https://api.example.com', 'demo-model',
          '演示模型', 'aXY=:dGFn:Y2lwaGVy', 1);
INSERT INTO station_post (id, station_id, author_id, type, content, starts_at)
  VALUES (900001, 900001, 900001, 'new_dish', '本周上新', NOW());
INSERT INTO point_submit (id, submitter_id, submit_type, target_id, payload, audit_status)
  VALUES (900001, 900001, 2, 900001, '{}', 0);

-- 汇总输出，便于肉眼确认
SELECT 'user' t, COUNT(*) n FROM `user` WHERE id BETWEEN 900001 AND 900009
UNION ALL SELECT 'review', COUNT(*) FROM `review` WHERE id BETWEEN 900001 AND 900009
UNION ALL SELECT 'rating_detail', COUNT(*) FROM rating_detail WHERE review_id BETWEEN 900001 AND 900009
UNION ALL SELECT 'review_summary', COUNT(*) FROM review_summary WHERE biz_id BETWEEN 900001 AND 900009
UNION ALL SELECT 'check_in', COUNT(*) FROM check_in WHERE id BETWEEN 900001 AND 900009
UNION ALL SELECT 'footprint', COUNT(*) FROM footprint WHERE id BETWEEN 900001 AND 900009
UNION ALL SELECT 'point_submit', COUNT(*) FROM point_submit WHERE id BETWEEN 900001 AND 900009
UNION ALL SELECT 'station_post', COUNT(*) FROM station_post WHERE id BETWEEN 900001 AND 900009
UNION ALL SELECT 'ai_model', COUNT(*) FROM ai_model WHERE id BETWEEN 900001 AND 900009
UNION ALL SELECT 'ai_platform_model', COUNT(*) FROM ai_platform_model WHERE id BETWEEN 900001 AND 900009;
