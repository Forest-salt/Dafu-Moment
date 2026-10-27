# 旧代码到数据库3.0的差异清单

| 原有实现 | 3.0口径与本轮处理 | 状态 |
| --- | --- | --- |
| canteen直接当点位 | canteen食区→location点位→station档口→dish菜品 | 新接口按层级读取；旧页面待改 |
| username/password/email、用户行role | student_no或加密phone/phone_hash、password_hash、user_role/role | 新身份服务完成；旧登录页待接 |
| 编造身份直接当已认证 | 9位虚构学号可注册，verified_status仍0 | 测试覆盖，不冒充校园认证 |
| 旧模拟字典8位学号 | 派生字典改成9位202400001—202400030；source-ddl原8位样例不动 | 用户明确授权的样例差异 |
| score/dim_scores等JSON | rating_detail、review_dimension_meal_mode、review_summary逐维度 | 新评价服务完成 |
| 所有维度必评或按点位类型选维度 | meal_mode1堂食2打包3外送；口味/份量必评 | 新服务校验与汇总已覆盖 |
| 评价旧状态枚举 | 0发布1下架2待审；下架原因/管理员/时间必须齐全 | 新发布链支持0/2；后台下架操作待联调 |
| 随手保存localStorage打卡 | check_in唯一键＋check_in_image/check_in_dish事务 | 新接口已实现；旧页面待接 |
| 独立日期、标题、背景、layout手账 | check_in_id唯一关联、note、journal_image、is_private | 新接口拒绝旧字段，默认私有；旧画布页面待改 |
| 自创模板或宠物外观编码 | 原包QC-20未定，保持NULL；不自创枚举 | 保留待产品确认 |
| satiety、用户金币余额列 | 不新增这些列；feed_record、coin_transaction与派生状态 | 新宠物接口已实现；等级增长规则未自创 |
| 以今天未喂食判饥饿、喂食增加点亮天数 | 按SRS6.1.7连续3天没有有效打卡/点评判饥饿；按3.0范式材料的打卡日期去重计点亮 | 已纠正，喂食仅扣币与表情反馈 |
| 忌口/过敏JSON混合 | dietary_restriction(type=1/2)关联档案 | 已实现并验证 |
| 多态target_type旧0起枚举 | 按各表注释的1起biz_type取值 | 新收藏/点赞已转换；旧其他多态服务待改 |
| Redis临时图片归属且失败放行 | upload_asset持久归属、子表引用计数 | 新上传与引用逻辑已写；真实MinIO链尚待联调 |
| 启动自动ALTER补旧列、seed旧22表 | 独立3.0入口；旧入口检测3.0即拒绝 | 已加保护，不运行生产迁移 |
| 整站114接口/六容器均已完成的旧描述 | 仅以实际运行与验收覆盖为准 | 未宣称整站已切换 |

本清单为后续commit保留差异依据；没有倒填提交记录或把已有导入宣称为新开发。
