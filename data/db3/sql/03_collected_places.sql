-- 公开资料第一批：只写已获来源支持的名称/地址。非当前营业或配送认证。
-- 不导入评分、评价、价格、坐标或推测的外卖类别；来源见collection/places.csv。
USE dafu_shike;
SET NAMES utf8mb4;
START TRANSACTION;
-- fzu-001 https://hqc.fzu.edu.cn/info/1032/3114.htm
INSERT INTO location(name,address,scene_category_id) SELECT '玫瑰园食惠餐厅',NULL,c.id FROM scene_category c WHERE c.name='食堂' AND NOT EXISTS (SELECT 1 FROM location l WHERE l.name='玫瑰园食惠餐厅' AND l.address <=> NULL AND l.deleted_at IS NULL);
-- fzu-002 https://hqc.fzu.edu.cn/info/1032/3114.htm
INSERT INTO location(name,address,scene_category_id) SELECT '丁香园品膳餐厅',NULL,c.id FROM scene_category c WHERE c.name='食堂' AND NOT EXISTS (SELECT 1 FROM location l WHERE l.name='丁香园品膳餐厅' AND l.address <=> NULL AND l.deleted_at IS NULL);
-- fzu-003 https://hqc.fzu.edu.cn/info/1032/3114.htm
INSERT INTO location(name,address,scene_category_id) SELECT '桃李园餐厅',NULL,c.id FROM scene_category c WHERE c.name='食堂' AND NOT EXISTS (SELECT 1 FROM location l WHERE l.name='桃李园餐厅' AND l.address <=> NULL AND l.deleted_at IS NULL);
-- fzu-004 https://hqc.fzu.edu.cn/info/1032/3114.htm
INSERT INTO location(name,address,scene_category_id) SELECT '佳客来西餐厅',NULL,c.id FROM scene_category c WHERE c.name='食堂' AND NOT EXISTS (SELECT 1 FROM location l WHERE l.name='佳客来西餐厅' AND l.address <=> NULL AND l.deleted_at IS NULL);
-- fzu-005 https://hqc.fzu.edu.cn/info/1032/3114.htm
INSERT INTO location(name,address,scene_category_id) SELECT '海棠园京元餐厅',NULL,c.id FROM scene_category c WHERE c.name='食堂' AND NOT EXISTS (SELECT 1 FROM location l WHERE l.name='海棠园京元餐厅' AND l.address <=> NULL AND l.deleted_at IS NULL);
-- fzu-006 https://hqc.fzu.edu.cn/info/1032/3114.htm
INSERT INTO location(name,address,scene_category_id) SELECT '丹桂园朝阳餐厅',NULL,c.id FROM scene_category c WHERE c.name='食堂' AND NOT EXISTS (SELECT 1 FROM location l WHERE l.name='丹桂园朝阳餐厅' AND l.address <=> NULL AND l.deleted_at IS NULL);
-- fzu-007 https://hqc.fzu.edu.cn/info/1032/3114.htm
INSERT INTO location(name,address,scene_category_id) SELECT '茉莉园聚誉餐厅',NULL,c.id FROM scene_category c WHERE c.name='食堂' AND NOT EXISTS (SELECT 1 FROM location l WHERE l.name='茉莉园聚誉餐厅' AND l.address <=> NULL AND l.deleted_at IS NULL);
-- fzu-008 https://hqc.fzu.edu.cn/info/1032/3114.htm
INSERT INTO location(name,address,scene_category_id) SELECT '百合园立品餐厅',NULL,c.id FROM scene_category c WHERE c.name='食堂' AND NOT EXISTS (SELECT 1 FROM location l WHERE l.name='百合园立品餐厅' AND l.address <=> NULL AND l.deleted_at IS NULL);
-- fzu-009 https://hqc.fzu.edu.cn/info/1032/3114.htm
INSERT INTO location(name,address,scene_category_id) SELECT '紫竹园到口餐厅',NULL,c.id FROM scene_category c WHERE c.name='食堂' AND NOT EXISTS (SELECT 1 FROM location l WHERE l.name='紫竹园到口餐厅' AND l.address <=> NULL AND l.deleted_at IS NULL);
-- fzu-010 https://hqc.fzu.edu.cn/info/1032/3114.htm
INSERT INTO location(name,address,scene_category_id) SELECT '紫荆园捷祥餐厅',NULL,c.id FROM scene_category c WHERE c.name='食堂' AND NOT EXISTS (SELECT 1 FROM location l WHERE l.name='紫荆园捷祥餐厅' AND l.address <=> NULL AND l.deleted_at IS NULL);
-- fzu-011 https://hqc.fzu.edu.cn/info/1032/3114.htm
INSERT INTO location(name,address,scene_category_id) SELECT '牡丹园清谷餐厅',NULL,c.id FROM scene_category c WHERE c.name='食堂' AND NOT EXISTS (SELECT 1 FROM location l WHERE l.name='牡丹园清谷餐厅' AND l.address <=> NULL AND l.deleted_at IS NULL);
-- fzu-012 https://hqc.fzu.edu.cn/info/1032/3114.htm
INSERT INTO location(name,address,scene_category_id) SELECT '芙蓉园兴安餐厅',NULL,c.id FROM scene_category c WHERE c.name='食堂' AND NOT EXISTS (SELECT 1 FROM location l WHERE l.name='芙蓉园兴安餐厅' AND l.address <=> NULL AND l.deleted_at IS NULL);
-- mcd-013 https://www.mcdonalds.com.cn/page/giftcard-available-stores
INSERT INTO location(name,address,scene_category_id) SELECT '福州麦当劳国宾大道DT餐厅','福建省福州市闽侯县上街镇国宾大道233号博仕家园B区的2-2#的101-104商业、129-132复式商业的商铺',c.id FROM scene_category c WHERE c.name='其他' AND NOT EXISTS (SELECT 1 FROM location l WHERE l.name='福州麦当劳国宾大道DT餐厅' AND l.address <=> '福建省福州市闽侯县上街镇国宾大道233号博仕家园B区的2-2#的101-104商业、129-132复式商业的商铺' AND l.deleted_at IS NULL);
-- mcd-014 https://www.mcdonalds.com.cn/page/giftcard-available-stores
INSERT INTO location(name,address,scene_category_id) SELECT '福州麦当劳上街镇国宾大道餐厅','福建省福州市闽侯县上街镇国宾大道268号永辉城市生活广场16#楼',c.id FROM scene_category c WHERE c.name='其他' AND NOT EXISTS (SELECT 1 FROM location l WHERE l.name='福州麦当劳上街镇国宾大道餐厅' AND l.address <=> '福建省福州市闽侯县上街镇国宾大道268号永辉城市生活广场16#楼' AND l.deleted_at IS NULL);
-- mcd-015 https://www.mcdonalds.com.cn/page/giftcard-available-stores
INSERT INTO location(name,address,scene_category_id) SELECT '福州麦当劳闽侯上街国宾大道(梅园酒店)餐厅','福建省福州市闽侯县上街镇国宾大道350号梅园上街广场1-1#楼一层1号商铺',c.id FROM scene_category c WHERE c.name='其他' AND NOT EXISTS (SELECT 1 FROM location l WHERE l.name='福州麦当劳闽侯上街国宾大道(梅园酒店)餐厅' AND l.address <=> '福建省福州市闽侯县上街镇国宾大道350号梅园上街广场1-1#楼一层1号商铺' AND l.deleted_at IS NULL);
COMMIT;
