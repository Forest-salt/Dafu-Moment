# D数据岗交付：可独立完成部分

2026-10-24。基于 GitHub `6c3ee277`；华为云 master `08765988` 的四份关键数据相关文件与该基线相同。工作分支 `codex/d-data-ready`，仅本地修改和提交，没有推送、合并或连接线上数据库。

## 已交付

| 对应任务 | 实物 | 完成边界 |
| --- | --- | --- |
| W-01 | `22-table-design-diff.md`、`22-table-column-diff.csv` | 22表191列逐项列出同名/类型差异与PDF页码；默认值、可空和业务映射仍待原DDL或人工评审 |
| W-03 | `backend/sql/init.sql`、`comment-changes.json`、`enum-inventory.md` | 现有22表缺失78列注释全部补齐；保留原有113列注释。五表及三类新枚举待对接 |
| W-04 | `backend/sql/migration/001_existing_column_comments.sql`、对应rollback、`backend/tools/apply_data_comments.py` | 完成现有列注释的可重复迁移；不是五表升级迁移 |
| W-05 | `existing-indexes.csv`、`relations-pending.md` | 现有索引盘点和候选关系清单；不擅自新增外键或修改数据类型 |
| W-07准备 | `backend/sql/inspection/existing_data_checks.sql`、`backend/tools/data_audit.py` | 当前22表辅助检查、结构与行数快照；不等于正式六条验收或行数据备份 |
| 范围核对 | `78-table-coverage.csv`、`handoff-pending.md` | 78表逐表标记现有22表、缺失首版5表、其余51表；不是78表已建成 |

本次只改变列注释；不修改表名、字段名、类型、默认值、可空、索引或业务数据，不改变后端启动逻辑和服务接口。注释按现代码语义填写，不把与设计有差异的字段描述成“完全对齐”。

## 迁移与回退

必须先在测试副本检查，再安排实际库窗口。MySQL的`ALTER TABLE`是DDL，会隐式提交，也可能等待元数据锁；“只补注释”仍不等于在线操作零影响。

迁移工具会先检查191列的结构指纹。表/列缺失、类型、默认值、可空、额外属性或排序规则与基线不符时，**在执行任何ALTER之前拒绝**。原有非空注释不覆盖。独立SQL每列也有元数据匹配保护；优先用工具，避免把“跳过变更列”误认为迁移全部完成。

示例（自行填入已批准的测试实例参数；不是线上执行指令）：

```powershell
python backend/tools/apply_data_comments.py --mysql "C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe" --host 127.0.0.1 --port <测试端口> --database <测试库>
python backend/tools/apply_data_comments.py --mysql "C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe" --host 127.0.0.1 --port <测试端口> --database <测试库> --rollback
```

认证沿用MySQL客户端正常配置或当前进程的`MYSQL_PWD`，不在命令参数、仓库或日志里填口令。不要把实际口令写进上述示例文件。

回退脚本仅移除本补丁加入且文字仍完全匹配的注释；不会删除数据、表或索引。若团队随后修改了列结构，工具同样拒绝，需先评审新的结构。不得靠关闭结构保护强行执行。

`init.sql`用于新库；已有库需要单独迁移，因为旧启动逻辑只在`user`表不存在时执行init。五表迁移尚未加入，不通过本补丁的001来暗中补业务结构。

## 检查与快照

`existing_data_checks.sql`包含6组辅助检查：缺注释、已选直接关联孤儿、多态目标、代码已定义枚举、评分/非负计数、评价汇总及点赞数一致性。它们是当前22表的检查工具，覆盖范围见SQL；没有冒充W-07尚待团队确认的正式“六条”。只输出异常数量，不修复、不输出用户内容或凭据。

```powershell
python backend/tools/data_audit.py --mysql "C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe" --port <测试端口> --database <测试库> --source-commit <实际对应SHA或明确的工作树标识> --output <新的JSON文件>
```

快照只包含结构、各表行数和对应代码标识，拒绝覆盖已有文件；不是一致性行数据备份，不能用于恢复业务数据。真正的数据备份与恢复演练须另行做，不能凭这个文件声明已完成冻结/恢复。

## 验证

见 `verification.md`。使用 MySQL 8.0.46、新建临时数据目录和仅本机监听的临时进程；未启动已安装的MySQL80服务，未读取原数据目录。验证脚本结束会关闭自己创建的实例并清理其临时数据目录。

```powershell
python backend/tools/verify_data_patch.py --mysql-bin "C:/Program Files/MySQL/MySQL Server 8.0/bin" --baseline-init <6c3ee277原版init.sql> --work-dir <新的验证输出目录>
```

这条命令会创建并销毁它自己的临时测试库，不能把原数据库路径作为参数。输出目录必须不存在。生产部署、前端构建、接口/E2E运行不在本补丁的验证范围；未修改那些模块。

## 提交、合并和数据恢复的区别

本地提交只保存在本机，老师还看不到。以后可把此独立分支推到指定远端供评审，**推分支不等于合并master**。此副本的origin目前指向本机核查仓库，发布前需要明确目标仓库；华为云工程有`code/`前缀，不能把GitHub根目录布局不加转换地覆盖华为云文档仓库。

Git的回退提交可以撤销已合并的代码变更，但不会自动恢复数据库改表/灌数据，也不会删除已经推送的历史。数据操作要有自己的备份和回退方案。按真实工作拆分提交，保留实际作者与时间；复用旧代码写明来源，不把旧功能说成当天新实现。
