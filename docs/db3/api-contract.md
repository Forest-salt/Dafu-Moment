# 3.0接口契约（前缀/api）

统一响应`{code:0,msg:'ok',data:...}`；失败使用HTTP状态与五位业务码。写接口默认Bearer JWT鉴权；本页未列的旧接口没有自动兼容，不能继续传旧字段。

| 方法与路径 | 输入/要点 |
| --- | --- |
| GET /health | MySQL连接检查，schema=3.0 |
| GET /auth/captcha | captchaId、imageBase64；依赖Redis |
| POST /auth/register、/auth/login | studentNo九位或phone十一位，二者选一；password、captchaId、captchaCode；注册可传nickname；密码至少8字符且UTF-8≤72字节 |
| GET /auth/me | id、student_no、nickname、avatar、verified_status、roles等；不返回手机密文、摘要、口令 |
| GET /locations?q=、/locations/:id | 点位、场地分类、已知坐标与营业资料；缺失值保持NULL |
| GET /stations/:id、/dishes/:id | 按真实层级；公共菜品仅status=1 |
| GET /dimensions?mealMode=1 | 1堂食2打包3外送 |
| GET /reviews | 可筛locationId/stationId/dishId/userId；只公开status=0 |
| POST /reviews、PUT /reviews/:id | stationId必填，dishId可选，locationId可选但须一致；mealMode、content、imageKeys、scores如`{"taste":4,"portion":3}` |
| DELETE /reviews/:id | 本人软删，重算汇总 |
| POST/DELETE /reviews/:id/like | 幂等点赞/取消；更新作者成就进度 |
| GET /checkins、/checkins/calendar?month=2026-10、/checkins/stats | 本人列表、日历、计数与当前连续天数 |
| POST /checkins | locationId或stationId；checkInDate(YYYY-MM-DD)、visibility(1仅记录/2私有/3公开)、note≤255字、dishIds、imageKeys≤9 |
| DELETE /checkins/:id | 本人软删，联动手账/图片；保留历史足迹；原唯一键仍保留，重复日期不另建 |
| GET /footprint | 本人历史首次到访记录 |
| GET/POST /journal、GET/PUT/DELETE /journal/:id | 新建checkInId必填；note、imageKeys、isPrivate布尔值；默认私有；template留空 |
| GET/PUT /me/dietary-profile | budgetMin、budgetMax、isVegetarian布尔、tastePreference、restrictions如`[{"type":2,"word":"虾"}]` |
| GET /achievements | 4项定义与本人进度 |
| GET/POST /pet、POST /pet/feed | 初态/领养/喂食，10金币、每日3次；不接受手工satiety/status |
| GET /tasks、POST /tasks/:id/claim | 每日任务按当天真实业务记录校验，重复领取409；删源数据不追回已领金币 |
| GET/POST/DELETE /favorites | 写入bizType、bizId、可选groupId；DELETE同一JSON格式 |
| GET /notifications、PUT /notifications/:id/read | 本人通知与已读 |
| POST /media/upload | multipart字段file；返回已登记objectKey；需配置MinIO与桶 |
| POST /data/locations | name、address、sceneCategoryId、canteenId可空；须数据维护角色 |
| POST /data/stations | name、locationId、businessHours可空；须数据维护角色 |
| POST /data/dishes | name、stationId、price、priceUnit可空；新建status=0待审；须数据维护角色 |

使用`backend/.env.db3.example`配置；个人身份不传明文手机号到其他资料接口。模拟学号仅测试，不自动获得campus_auth认证或管理员权限。
