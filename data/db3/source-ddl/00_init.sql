-- 00_init.sql ｜ 初始化入口
-- ⚠️ 警告：01_user～06_ai 各建表文件均含 DROP TABLE IF EXISTS——重跑 01~06 会清空全部业务数据！
-- ⚠️ 仅两种场景允许执行 01~06：① 首次建库；② 明知清空的全量重建（fresh 语义）。日常禁止重跑，详见 建库说明.md。
-- 大福食刻（MySQL 8.0 兼容；InnoDB / utf8mb4 / utf8mb4_general_ci）
-- 执行顺序：本文件 → 01_user → 02_catering → 03_review → 04_checkin → 05_community → 06_ai → 07_fk → 99_seed

CREATE DATABASE IF NOT EXISTS `dafu_shike` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `dafu_shike`;
SET NAMES utf8mb4;
