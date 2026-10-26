-- 07_fk.sql ｜ 全部外键约束（两遍式第 2 遍；多态不建外键；无级联删除）
-- 补齐（2026-10-18 审核 F2）：单亲引用补物理外键 19 条；清 historical 野外键 fk_dr_user（表无 user_id 列，归属经 dietary_profile 传递），对齐底表承诺；多态 biz_id 依 CON-23 不建外键

-- 01_user 域
ALTER TABLE `campus_auth` ADD CONSTRAINT `fk_ca_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `dietary_profile` ADD CONSTRAINT `fk_dp_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `dietary_restriction` ADD CONSTRAINT `fk_dr_profile` FOREIGN KEY (`dietary_profile_id`) REFERENCES `dietary_profile`(`id`);
ALTER TABLE `privacy_setting` ADD CONSTRAINT `fk_ps_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `user_role` ADD CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `user_role` ADD CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`);
ALTER TABLE `user_group_member` ADD CONSTRAINT `fk_ugm_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `user_group_member` ADD CONSTRAINT `fk_ugm_group` FOREIGN KEY (`group_id`) REFERENCES `user_group`(`id`);
ALTER TABLE `user_permission` ADD CONSTRAINT `fk_up_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `user_permission` ADD CONSTRAINT `fk_up_perm` FOREIGN KEY (`permission_id`) REFERENCES `permission`(`id`);
ALTER TABLE `role_permission` ADD CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`);
ALTER TABLE `role_permission` ADD CONSTRAINT `fk_rp_perm` FOREIGN KEY (`permission_id`) REFERENCES `permission`(`id`);
ALTER TABLE `group_permission` ADD CONSTRAINT `fk_gp_group` FOREIGN KEY (`group_id`) REFERENCES `user_group`(`id`);
ALTER TABLE `group_permission` ADD CONSTRAINT `fk_gp_perm` FOREIGN KEY (`permission_id`) REFERENCES `permission`(`id`);
ALTER TABLE `group_role` ADD CONSTRAINT `fk_gr_group` FOREIGN KEY (`group_id`) REFERENCES `user_group`(`id`);
ALTER TABLE `group_role` ADD CONSTRAINT `fk_gr_role` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`);
ALTER TABLE `user_permission` ADD CONSTRAINT `fk_up_granted_by` FOREIGN KEY (`granted_by`) REFERENCES `user`(`id`);
ALTER TABLE `user_group_location` ADD CONSTRAINT `fk_ugl_group` FOREIGN KEY (`group_id`) REFERENCES `user_group`(`id`);
ALTER TABLE `user_group_location` ADD CONSTRAINT `fk_ugl_location` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`);
ALTER TABLE `search_history` ADD CONSTRAINT `fk_sh_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `permission` ADD CONSTRAINT `fk_perm_parent` FOREIGN KEY (`parent_id`) REFERENCES `permission`(`id`);
ALTER TABLE `user_group` ADD CONSTRAINT `fk_ug_parent` FOREIGN KEY (`parent_id`) REFERENCES `user_group`(`id`);

-- 02_catering 域
ALTER TABLE `location` ADD CONSTRAINT `fk_loc_scene` FOREIGN KEY (`scene_category_id`) REFERENCES `scene_category`(`id`);
ALTER TABLE `location` ADD CONSTRAINT `fk_loc_canteen` FOREIGN KEY (`canteen_id`) REFERENCES `canteen`(`id`);
ALTER TABLE `location` ADD CONSTRAINT `fk_loc_map` FOREIGN KEY (`map_location_id`) REFERENCES `map_location`(`id`);
ALTER TABLE `location` ADD CONSTRAINT `fk_loc_biz` FOREIGN KEY (`business_info_id`) REFERENCES `business_info`(`id`);
ALTER TABLE `station` ADD CONSTRAINT `fk_station_location` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`);
ALTER TABLE `station` ADD CONSTRAINT `fk_station_map` FOREIGN KEY (`map_location_id`) REFERENCES `map_location`(`id`);
ALTER TABLE `station` ADD CONSTRAINT `fk_station_owner` FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`);
ALTER TABLE `dish` ADD CONSTRAINT `fk_dish_station` FOREIGN KEY (`station_id`) REFERENCES `station`(`id`);
ALTER TABLE `dish_tag` ADD CONSTRAINT `fk_dt_dish` FOREIGN KEY (`dish_id`) REFERENCES `dish`(`id`);
ALTER TABLE `dish_tag` ADD CONSTRAINT `fk_dt_tag` FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`);
ALTER TABLE `station_manager` ADD CONSTRAINT `fk_sm_station` FOREIGN KEY (`station_id`) REFERENCES `station`(`id`);
ALTER TABLE `station_manager` ADD CONSTRAINT `fk_sm_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `business_info` ADD CONSTRAINT `fk_bi_location` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`);

-- 03_review 域
ALTER TABLE `review` ADD CONSTRAINT `fk_review_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `review` ADD CONSTRAINT `fk_review_location` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`);
ALTER TABLE `review` ADD CONSTRAINT `fk_review_station` FOREIGN KEY (`station_id`) REFERENCES `station`(`id`);
ALTER TABLE `review` ADD CONSTRAINT `fk_review_dish` FOREIGN KEY (`dish_id`) REFERENCES `dish`(`id`);
ALTER TABLE `rating_detail` ADD CONSTRAINT `fk_rd_review` FOREIGN KEY (`review_id`) REFERENCES `review`(`id`);
ALTER TABLE `rating_detail` ADD CONSTRAINT `fk_rd_dim` FOREIGN KEY (`dimension_id`) REFERENCES `review_dimension`(`id`);
ALTER TABLE `review_image` ADD CONSTRAINT `fk_ri_review` FOREIGN KEY (`review_id`) REFERENCES `review`(`id`);
ALTER TABLE `review_tag` ADD CONSTRAINT `fk_rt_review` FOREIGN KEY (`review_id`) REFERENCES `review`(`id`);
ALTER TABLE `review_tag` ADD CONSTRAINT `fk_rt_tag` FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`);
ALTER TABLE `review_like` ADD CONSTRAINT `fk_rlike_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `favorite` ADD CONSTRAINT `fk_fav_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `favorite` ADD CONSTRAINT `fk_fav_group` FOREIGN KEY (`group_id`) REFERENCES `favorite_group`(`id`);
ALTER TABLE `report` ADD CONSTRAINT `fk_report_user` FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`);
ALTER TABLE `review_summary` ADD CONSTRAINT `fk_rs_dim` FOREIGN KEY (`dimension_id`) REFERENCES `review_dimension`(`id`);
ALTER TABLE `review_appeal` ADD CONSTRAINT `fk_ra_review` FOREIGN KEY (`review_id`) REFERENCES `review`(`id`);
ALTER TABLE `review_appeal` ADD CONSTRAINT `fk_ra_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `review` ADD CONSTRAINT `fk_review_offline` FOREIGN KEY (`offline_by`) REFERENCES `user`(`id`);
ALTER TABLE `favorite_group` ADD CONSTRAINT `fk_fg_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `report` ADD CONSTRAINT `fk_report_handler` FOREIGN KEY (`handled_by`) REFERENCES `user`(`id`);
ALTER TABLE `review_appeal` ADD CONSTRAINT `fk_ra_handler` FOREIGN KEY (`handled_by`) REFERENCES `user`(`id`);
ALTER TABLE `review_dimension_meal_mode` ADD CONSTRAINT `fk_rdm_dim` FOREIGN KEY (`dimension_id`) REFERENCES `review_dimension`(`id`);

-- 04_checkin 域
ALTER TABLE `check_in` ADD CONSTRAINT `fk_ci_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `check_in` ADD CONSTRAINT `fk_ci_location` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`);
ALTER TABLE `check_in_image` ADD CONSTRAINT `fk_cii_check_in` FOREIGN KEY (`check_in_id`) REFERENCES `check_in`(`id`);
ALTER TABLE `check_in_dish` ADD CONSTRAINT `fk_cid_check_in` FOREIGN KEY (`check_in_id`) REFERENCES `check_in`(`id`);
ALTER TABLE `check_in_dish` ADD CONSTRAINT `fk_cid_dish` FOREIGN KEY (`dish_id`) REFERENCES `dish`(`id`);
ALTER TABLE `journal` ADD CONSTRAINT `fk_journal_check_in` FOREIGN KEY (`check_in_id`) REFERENCES `check_in`(`id`);
ALTER TABLE `journal_image` ADD CONSTRAINT `fk_ji_journal` FOREIGN KEY (`journal_id`) REFERENCES `journal`(`id`);
ALTER TABLE `footprint` ADD CONSTRAINT `fk_fp_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `footprint` ADD CONSTRAINT `fk_fp_location` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`);
ALTER TABLE `pet` ADD CONSTRAINT `fk_pet_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `feed_record` ADD CONSTRAINT `fk_fr_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `feed_record` ADD CONSTRAINT `fk_fr_pet` FOREIGN KEY (`pet_id`) REFERENCES `pet`(`id`);
ALTER TABLE `coin_transaction` ADD CONSTRAINT `fk_ct_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `task_claim` ADD CONSTRAINT `fk_tc_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `task_claim` ADD CONSTRAINT `fk_tc_task` FOREIGN KEY (`task_id`) REFERENCES `task`(`id`);
ALTER TABLE `sticker` ADD CONSTRAINT `fk_sticker_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `user_achievement` ADD CONSTRAINT `fk_ua_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `user_achievement` ADD CONSTRAINT `fk_ua_achievement` FOREIGN KEY (`achievement_id`) REFERENCES `achievement`(`id`);

-- 05_community 域
ALTER TABLE `post` ADD CONSTRAINT `fk_post_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `post_link` ADD CONSTRAINT `fk_pl_post` FOREIGN KEY (`post_id`) REFERENCES `post`(`id`);
ALTER TABLE `review_reply` ADD CONSTRAINT `fk_rr_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `notification` ADD CONSTRAINT `fk_noti_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `draft` ADD CONSTRAINT `fk_draft_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `follow_relation` ADD CONSTRAINT `fk_fr_follower` FOREIGN KEY (`follower_id`) REFERENCES `user`(`id`);
ALTER TABLE `follow_relation` ADD CONSTRAINT `fk_fr_followee` FOREIGN KEY (`followee_id`) REFERENCES `user`(`id`);
ALTER TABLE `operation_log` ADD CONSTRAINT `fk_ol_operator` FOREIGN KEY (`operator_id`) REFERENCES `user`(`id`);
ALTER TABLE `post` ADD CONSTRAINT `fk_post_journal` FOREIGN KEY (`journal_id`) REFERENCES `journal`(`id`);
ALTER TABLE `audit_record` ADD CONSTRAINT `fk_ar_submitter` FOREIGN KEY (`submitter_id`) REFERENCES `user`(`id`);
ALTER TABLE `audit_record` ADD CONSTRAINT `fk_ar_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `user`(`id`);
ALTER TABLE `audit_record` ADD CONSTRAINT `fk_ar_resubmit` FOREIGN KEY (`resubmit_from_id`) REFERENCES `audit_record`(`id`);
ALTER TABLE `banned_word` ADD CONSTRAINT `fk_bw_creator` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`);
ALTER TABLE `upload_asset` ADD CONSTRAINT `fk_upload_user` FOREIGN KEY (`uploader_id`) REFERENCES `user`(`id`);

-- 06_ai 域
ALTER TABLE `recommendation` ADD CONSTRAINT `fk_rec_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `recommendation_item` ADD CONSTRAINT `fk_ri_rec` FOREIGN KEY (`recommendation_id`) REFERENCES `recommendation`(`id`);
ALTER TABLE `taste_profile` ADD CONSTRAINT `fk_tp_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `diet_plan` ADD CONSTRAINT `fk_dplan_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `diet_plan_item` ADD CONSTRAINT `fk_dpi_plan` FOREIGN KEY (`plan_id`) REFERENCES `diet_plan`(`id`);
ALTER TABLE `diet_plan_item` ADD CONSTRAINT `fk_dpi_dish` FOREIGN KEY (`dish_id`) REFERENCES `dish`(`id`);
ALTER TABLE `preference_analysis` ADD CONSTRAINT `fk_pa_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `ai_conversation` ADD CONSTRAINT `fk_aic_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `ai_chat_message` ADD CONSTRAINT `fk_acm_session` FOREIGN KEY (`session_id`) REFERENCES `ai_conversation`(`id`);
ALTER TABLE `browse_event` ADD CONSTRAINT `fk_be_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`);
ALTER TABLE `recommendation` ADD CONSTRAINT `fk_rec_rule` FOREIGN KEY (`rule_id`) REFERENCES `recommendation_rule`(`id`);
ALTER TABLE `ai_conversation` ADD CONSTRAINT `fk_aic_provider` FOREIGN KEY (`provider_id`) REFERENCES `ai_provider`(`id`);


-- ===== 补建 4 张表的外键（2026-10-20 按实现仓库 7e73590 对齐）=====
ALTER TABLE `point_submit` ADD CONSTRAINT `fk_ps_submitter` FOREIGN KEY (`submitter_id`) REFERENCES `user` (`id`);
ALTER TABLE `point_submit` ADD CONSTRAINT `fk_ps_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `user` (`id`);
ALTER TABLE `station_post` ADD CONSTRAINT `fk_sp_station` FOREIGN KEY (`station_id`) REFERENCES `station` (`id`);
ALTER TABLE `station_post` ADD CONSTRAINT `fk_sp_author` FOREIGN KEY (`author_id`) REFERENCES `user` (`id`);
ALTER TABLE `ai_model` ADD CONSTRAINT `fk_aim_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`);
ALTER TABLE `ai_model` ADD CONSTRAINT `fk_aim_platform` FOREIGN KEY (`platform_id`) REFERENCES `ai_platform_model` (`id`);
