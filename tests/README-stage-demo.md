# 六阶段删减演示（D2—D7）

## 目的

每天只演示当天已经交付的页面。做法不是改业务代码，而是演示前把**当天还没交付的路由注释掉**，截图只截当天保留的页面。这样截图和冲刺日志的“今日关闭”对得上，也不会把后面的功能提前露出来。

## 每天保留的路由

| 阶段 | 保留路由 | 当天截图 |
| -- | -- | -- |
| D2 | `/`、`/login`、`/checkin` | 首页、打卡页 |
| D3 | D2 + `/footprint`、`/achievements`、`/journal/:id`、`/journal/edit`、`/journal/edit/:id` | 打卡、足迹、成就 |
| D4 | D3 + `/pet`、`/pet-community` | 宠物、宠物社区 |
| D5 | D4 + `/ai/profile`、`/ai/plan` | 饮食档案、饮食计划 |
| D6 | D5 + `/me`、`/settings`、`/tasks`、`/report`、`/cobuild` | 我的、设置、任务、报表、共建 |
| D7 | 全部（含 `/admin/*`） | 管理看板 |

完整清单见 `tests/stage-routes.json`。

## 复制粘贴：临时注释路由

以 D4 为例。先备份路由文件，再把不在保留清单里的单行路由注释掉：

```powershell
Copy-Item frontend/src/router/index.js frontend/src/router/index.js.bak
$keep = @('/', '/login', '/checkin', '/footprint', '/achievements', '/journal/:id', '/journal/edit', '/journal/edit/:id', '/pet', '/pet-community')
$lines = Get-Content frontend/src/router/index.js
$out = foreach ($line in $lines) {
    if ($line -match "path:\s*'([^']+)'") {
        $p = $Matches[1]
        if ($keep -contains $p -or $p -like '/admin*') { $line } else { "// $line" }
    } else {
        $line
    }
}
$out | Set-Content frontend/src/router/index.js
npm --prefix frontend run build
Copy-Item frontend/src/router/index.js.bak frontend/src/router/index.js
Remove-Item frontend/src/router/index.js.bak
```

要点：

1. **只注释单行路由**；`/admin` 那个多行父对象不要动，D2—D6 不截图管理端即可。
2. `npm run build` 通过后，把 `dist` 交给前端容器，或者本地 `npm run preview` 起静态站。
3. 截图跑 `node tests/stage-screenshots.mjs`；它只打开当天保留的页面，不打开后面的页面。
4. 恢复路由文件后再提交，**删减是演示层动作，不进主分支**。

## 截图脚本

`tests/stage-screenshots.mjs` 已按 D2—D7 配好页面清单，登录用 `zhangwl/123456`，管理端用 `admin/admin123`。截图输出到：

```
作业06-站立式会议与α冲刺/60-图册/每日成果/<D2—D7>/
```

## 为什么不用“删页面文件”的办法

删 `.vue` 文件会连带删掉 `router` 里的动态 import，构建时才报错；注释路由更稳，恢复也只用一条 `Copy-Item`。如果答辩要求现场演示，直接跑 `stage-screenshots.mjs` 即可，不需要真的删文件。
