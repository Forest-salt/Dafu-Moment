-- 当前22表的辅助数据检查；全为SELECT，不自动修复。不是尚待团队确认的W-07正式六条验收。
-- 每行返回检查名称和异常数量。只输出数量，不输出用户内容、口令、密钥或联系方式。
SELECT 'column_comments_missing' AS check_name, COUNT(*) AS violations
FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND COLUMN_COMMENT='';

SELECT 'orphan_direct_references' AS check_name, SUM(n) AS violations FROM (
  SELECT COUNT(*) n FROM station s LEFT JOIN canteen c ON c.id=s.canteen_id WHERE c.id IS NULL
  UNION ALL SELECT COUNT(*) FROM dish d LEFT JOIN station s ON s.id=d.station_id WHERE s.id IS NULL
  UNION ALL SELECT COUNT(*) FROM review r LEFT JOIN `user` u ON u.id=r.user_id WHERE u.id IS NULL
  UNION ALL SELECT COUNT(*) FROM review_image i LEFT JOIN review r ON r.id=i.review_id WHERE r.id IS NULL
  UNION ALL SELECT COUNT(*) FROM review_like l LEFT JOIN review r ON r.id=l.review_id LEFT JOIN `user` u ON u.id=l.user_id WHERE r.id IS NULL OR u.id IS NULL
  UNION ALL SELECT COUNT(*) FROM favorite f LEFT JOIN `user` u ON u.id=f.user_id WHERE u.id IS NULL
  UNION ALL SELECT COUNT(*) FROM journal j LEFT JOIN `user` u ON u.id=j.user_id WHERE u.id IS NULL
  UNION ALL SELECT COUNT(*) FROM sticker s LEFT JOIN `user` u ON u.id=s.user_id WHERE u.id IS NULL
  UNION ALL SELECT COUNT(*) FROM notification n LEFT JOIN `user` u ON u.id=n.user_id WHERE u.id IS NULL
) q;

SELECT 'polymorphic_targets_invalid' AS check_name, COUNT(*) AS violations FROM (
  SELECT subject_type, subject_id FROM review
  UNION ALL SELECT subject_type, subject_id FROM favorite
  UNION ALL SELECT subject_type, subject_id FROM review_summary
) q
LEFT JOIN dish d ON q.subject_type=0 AND q.subject_id=d.id
LEFT JOIN station s ON q.subject_type=1 AND q.subject_id=s.id
LEFT JOIN canteen c ON q.subject_type=2 AND q.subject_id=c.id
WHERE q.subject_type NOT IN (0,1,2) OR (d.id IS NULL AND s.id IS NULL AND c.id IS NULL);

SELECT 'documented_enum_values_invalid' AS check_name, SUM(n) AS violations FROM (
  SELECT COUNT(*) n FROM `user` WHERE role NOT IN (0,1) OR status NOT IN (0,1,2) OR fzu_verified NOT IN (0,1)
  UNION ALL SELECT COUNT(*) FROM canteen WHERE type NOT IN (0,1,2,3) OR enabled NOT IN (0,1)
  UNION ALL SELECT COUNT(*) FROM station WHERE status NOT IN (0,1,2)
  UNION ALL SELECT COUNT(*) FROM dish WHERE status NOT IN (0,1) OR is_recommended NOT IN (0,1)
  UNION ALL SELECT COUNT(*) FROM review WHERE status NOT IN (0,1,2,3) OR is_anonymous NOT IN (0,1)
  UNION ALL SELECT COUNT(*) FROM report WHERE reason NOT BETWEEN 1 AND 5 OR status NOT IN ('open','resolved','rejected')
) q;

SELECT 'scores_or_counters_invalid' AS check_name, SUM(n) AS violations FROM (
  SELECT COUNT(*) n FROM review WHERE overall_score<1 OR overall_score>5 OR up_count<0 OR down_count<0 OR like_count<0
  UNION ALL SELECT COUNT(*) FROM dish WHERE price<0
  UNION ALL SELECT COUNT(*) FROM review_summary WHERE review_count<0 OR sum_score<0 OR rating_avg<0 OR rating_avg>5 OR hist_1<0 OR hist_2<0 OR hist_3<0 OR hist_4<0 OR hist_5<0
) q;

-- Check aggregate row coverage in both directions; empty summary rows are valid after deletion.
SELECT 'review_aggregate_mismatch' AS check_name, SUM(n) AS violations FROM (
 SELECT COUNT(*) n FROM review_summary s LEFT JOIN (
   SELECT subject_type, subject_id, COUNT(*) cnt, SUM(overall_score) score_sum,
     ROUND(AVG(overall_score),2) avg_score,
     SUM(ROUND(overall_score)=1) h1, SUM(ROUND(overall_score)=2) h2,
     SUM(ROUND(overall_score)=3) h3, SUM(ROUND(overall_score)=4) h4, SUM(ROUND(overall_score)=5) h5
   FROM review WHERE status=0 GROUP BY subject_type, subject_id
 ) a ON a.subject_type=s.subject_type AND a.subject_id=s.subject_id
 WHERE s.review_count<>COALESCE(a.cnt,0) OR s.sum_score<>COALESCE(a.score_sum,0)
   OR s.rating_avg<>COALESCE(a.avg_score,0) OR s.hist_1<>COALESCE(a.h1,0)
   OR s.hist_2<>COALESCE(a.h2,0) OR s.hist_3<>COALESCE(a.h3,0)
   OR s.hist_4<>COALESCE(a.h4,0) OR s.hist_5<>COALESCE(a.h5,0)
 UNION ALL SELECT COUNT(*) FROM (
   SELECT DISTINCT subject_type,subject_id FROM review WHERE status=0
 ) a LEFT JOIN review_summary s ON s.subject_type=a.subject_type AND s.subject_id=a.subject_id WHERE s.subject_id IS NULL
 UNION ALL SELECT COUNT(*) FROM review r LEFT JOIN (
   SELECT review_id,COUNT(*) cnt FROM review_like GROUP BY review_id
 ) l ON l.review_id=r.id WHERE r.like_count<>COALESCE(l.cnt,0)
) q;
