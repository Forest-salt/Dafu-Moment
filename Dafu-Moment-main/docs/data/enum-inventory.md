# 当前代码已有枚举与新枚举待定项

以下仅摘录代码既有定义，不代表已与78表设计统一。

| 表.字段 | 当前注释 |
| --- | --- |
| user.avatar | TINYINT NOT NULL DEFAULT 0 COMMENT '预设头像编号' |
| user.fzu_verified | TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0 未认证 / 1 已绑定福大统一身份认证' |
| user.role | TINYINT NOT NULL DEFAULT 0 COMMENT '0 学生 / 1 管理员' |
| user.status | TINYINT NOT NULL DEFAULT 0 COMMENT '0 正常 / 1 禁言 / 2 封禁' |
| canteen.type | TINYINT NOT NULL DEFAULT 0 COMMENT '0 校内食堂 / 1 永嘉天地 / 2 学生街 / 3 周边其他' |
| canteen.enabled | TINYINT NOT NULL DEFAULT 1 COMMENT '上下架开关：1 在架 / 0 下架' |
| station.status | TINYINT NOT NULL DEFAULT 0 COMMENT '0 营业 / 1 休摊 / 2 下架' |
| dish.is_recommended | TINYINT(1) NOT NULL DEFAULT 0 COMMENT '推荐菜标记（管理员标记/聚合修正）' |
| dish.status | TINYINT NOT NULL DEFAULT 0 COMMENT '0 在售 / 1 下架' |
| review.subject_type | TINYINT NOT NULL COMMENT '0 菜品 / 1 档口 / 2 点位' |
| review.is_anonymous | TINYINT NOT NULL DEFAULT 0 COMMENT '匿名同学' |
| review.status | TINYINT NOT NULL DEFAULT 0 COMMENT '0 已发布 / 1 待人工 / 2 已下架 / 3 已驳回' |
| review_image.status | TINYINT NOT NULL DEFAULT 0 COMMENT '0 正常 / 1 违规（连带评价下架）' |
| review_summary.subject_type | TINYINT NOT NULL |
| favorite.subject_type | TINYINT NOT NULL |
| favorite.list_type | TINYINT NOT NULL DEFAULT 0 COMMENT '0 想吃（唯一收藏语义，保留列位兼容）' |
| report.subject_type | TINYINT NOT NULL |
| report.reason | TINYINT NOT NULL COMMENT '1 垃圾广告 / 2 人身攻击 / 3 虚假信息 / 4 抄袭搬运 / 5 其他' |
| banned_word.level | TINYINT NOT NULL COMMENT '1 替换 / 2 进人工 / 3 进人工（严重）' |
| point_submit.submit_type | TINYINT NOT NULL COMMENT '0 点位 / 1 档口 / 2 菜品' |
| point_submit.audit_status | TINYINT NOT NULL DEFAULT 0 COMMENT '0 待审 / 1 通过 / 2 驳回' |
| ai_provider.enabled | TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用' |
| ai_model.is_selected | TINYINT(1) NOT NULL DEFAULT 0 COMMENT '使用中（单用户仅一条为 1）' |
| ai_platform_model.enabled | TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用（停用后用户端即刻隐藏/失效回落）' |
| sticker.source | TINYINT NOT NULL DEFAULT 0 COMMENT '0 用户上传抠图 / 1 收藏自动抠图' |
| journal.bg | TINYINT NOT NULL DEFAULT 0 COMMENT '纸面背景样式 0 米纸网格 / 1 点阵 / 2 牛皮纸 / 3 自定义图片' |

W-03要求的“打卡来源、成就类型、宠物阶段”三类枚举：当前五表未落地，不凭旧日志补造取值，待A/B/C对接后增加。
visibility的0/1与1/2/3冲突也未裁决；本补丁不更改任何枚举或默认值。
