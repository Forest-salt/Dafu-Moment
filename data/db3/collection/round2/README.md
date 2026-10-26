# 当前公开商家来源

来源：https://github.com/155TuT/FFM-FzuFoodMap/tree/9d9680b6a4050fff132eb551c79f7818c8e9e928 ，按MIT许可保留作者署名和FFM-LICENSE.md。

53条公开餐厅/门店资料与原先15条名录合并，8组食堂简称归一后共60条。deduplication.json记录映射，normalized-places.csv记录资料与来源；源GeoJSON及README保留用于复核。

reference_average_spend是人均消费，不是dish.price；source_says_takeaway只是来源“可外卖”标签，不代表指定宿舍可配送或专业审核完成。当前仍缺可明确对应门店和规格的商品单价，待实际手机菜单/分享页，不用旧价格补齐。

2021美食和旧地图/品牌网页尝试已移到本次作业99_历史归档；不纳入本轮菜单。地图工作暂缓，默认采集器不导出地图SQL。已有53条原始位置参考值仅随源文件留档。

生成工具：tools/collect_round2.py；验证结果：reports/verification.json。没有提交或操作实际业务库。
