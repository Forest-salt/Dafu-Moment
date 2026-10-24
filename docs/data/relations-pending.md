# 现有关系与外键/索引核对

当前init物理外键为0；现有索引定义见existing-indexes.csv。已在隔离MySQL中验证本次注释迁移和回退不改变任何现有索引。没有新增或删除索引。

| 代码关系 | 已知情况 | 本次处置 |
| --- | --- | --- |
| station.canteen_id → canteen.id | INT → INT；idx_canteen已有 | 候选外键；删除策略与孤儿检查待确认 |
| dish.station_id → station.id | INT → INT；idx_station已有 | 同上 |
| review.user_id → user.id | BIGINT → BIGINT；idx_user已有 | 同上 |
| review_image.review_id → review.id | BIGINT → BIGINT；idx_review已有 | 同上 |
| review_like.review_id/user_id → review/user | 类型相符；uk_user_review和idx_review已有 | 同上 |
| review_reply.review_id/user_id → review/user | 类型相符；review_id已有唯一约束 | user_id索引与删除策略待确认 |
| journal.user_id/sticker.user_id/notification.user_id → user.id | 类型相符；各自有用户索引 | 候选外键；先确认账户删除业务 |
| station.manager_user_id → user.id | 可空BIGINT | 先确认负责人解绑策略 |
| station_post.station_id/author_id → station/user | 类型相符 | 先确认公告与作者删除策略 |
| point_submit.submitter_id/auditor_id → user.id | 类型相符；审核人可空 | 先确认历史审核记录保留策略 |
| canteen.created_by → user.id | BIGINT UNSIGNED → BIGINT，符号位不一致 | 不直接添加外键，不擅自改类型 |
| report.subject_id → review.id（现注释口径） | INT → BIGINT，且subject_type接口映射仍须确认 | 不添加外键、不缩放数据 |
| ai_model.platform_id → ai_platform_model.id | 类型相符，可空 | 先确认平台模型停用/删除与引用保留策略 |
| ai_model/ai_conversation.user_id → user.id | 类型相符 | 先确认用户删除与历史会话处理 |
| review/favorite/review_summary.subject_type+subject_id | 多态关联dish/station/canteen | 只读检查目标存在性；不建单一目标外键 |
| notification.ref_type+ref_id / point_submit.target_id | 多态或按提交类型分流 | 不凭字段名推断单一目标表 |

上述是当前代码能识别的候选关系，不是106外键的最终分配表，也不是所谓“14条已批准暂缓外键”的清单。完整设计范围、分期归属和删除规则由团队确认后再实施。
