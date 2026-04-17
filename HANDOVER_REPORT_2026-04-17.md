# DTD Atlas 平台接手报告

更新时间：2026-04-17

## 1. 平台总览

当前平台主项目根目录：

- `/Users/jhhe/Documents/Playground/dtd_platform`

这是正式版平台目录，包含：

- FastAPI 后端
- React + Vite 前端源码
- 已构建的生产静态文件
- 部署配置
- 预上线检查文档

## 2. 关键目录与文件位置

### 2.1 后端

- 后端入口：`/Users/jhhe/Documents/Playground/dtd_platform/app.py`
- 依赖文件：`/Users/jhhe/Documents/Playground/dtd_platform/requirements.txt`

说明：

- `app.py` 是唯一主后端入口。
- FastAPI 在这里定义 API、静态资源挂载、SQLite 访问、分析逻辑和页面回退路由。

### 2.2 前端源码

- 前端根目录：`/Users/jhhe/Documents/Playground/dtd_platform/frontend`
- Vite 配置：`/Users/jhhe/Documents/Playground/dtd_platform/frontend/vite.config.js`
- 前端入口：`/Users/jhhe/Documents/Playground/dtd_platform/frontend/src/main.jsx`
- 应用主组件：`/Users/jhhe/Documents/Playground/dtd_platform/frontend/src/App.jsx`
- API 封装：`/Users/jhhe/Documents/Playground/dtd_platform/frontend/src/api.js`
- 全局样式：`/Users/jhhe/Documents/Playground/dtd_platform/frontend/src/styles.css`

核心页面组件：

- 首页：`/Users/jhhe/Documents/Playground/dtd_platform/frontend/src/components/HomePage.jsx`
- 分析页：`/Users/jhhe/Documents/Playground/dtd_platform/frontend/src/components/AnalysisPage.jsx`
- 数据库页：`/Users/jhhe/Documents/Playground/dtd_platform/frontend/src/components/DatabasePage.jsx`
- 网络图组件：`/Users/jhhe/Documents/Playground/dtd_platform/frontend/src/components/GraphCanvas.jsx`
- 顶部导航：`/Users/jhhe/Documents/Playground/dtd_platform/frontend/src/components/Header.jsx`
- 帮助页：`/Users/jhhe/Documents/Playground/dtd_platform/frontend/src/components/HelpPage.jsx`

### 2.3 生产静态文件

- 生产静态目录：`/Users/jhhe/Documents/Playground/dtd_platform/static`
- 页面入口：`/Users/jhhe/Documents/Playground/dtd_platform/static/index.html`
- 静态资源目录：`/Users/jhhe/Documents/Playground/dtd_platform/static/assets`

当前最新构建产物（本地最近一次 build 对应）：

- `index-BnfoJrxR.css`
- `index-CWGfiFRV.js`
- `HomePage-CZkeNr1d.js`
- `AnalysisPage-CIMHPZA3.js`
- `DatabasePage-B4ywiQw1.js`
- `HelpPage-DIpfdUEr.js`
- `react-vendor-C3Mcq2Xm.js`
- `graph-vendor-CyRj5-Bi.js`

说明：

- FastAPI 直接托管 `static/` 目录。
- 服务器上线时，真正生效的是 `static/`，不是 `frontend/src/`。

### 2.4 部署配置

- 部署说明：`/Users/jhhe/Documents/Playground/dtd_platform/DEPLOYMENT_GUIDE.md`
- systemd 模板：`/Users/jhhe/Documents/Playground/dtd_platform/deploy/systemd/dtd-atlas.service`
- nginx 模板：`/Users/jhhe/Documents/Playground/dtd_platform/deploy/nginx/dtd-atlas.conf`

### 2.5 检查与说明文档

- 项目说明：`/Users/jhhe/Documents/Playground/dtd_platform/README.md`
- 上线前检查单：`/Users/jhhe/Documents/Playground/dtd_platform/PRELAUNCH_QA_CHECKLIST.md`

## 3. 数据库与数据文件位置

### 3.1 当前正式版数据库

- 正式库：`/Users/jhhe/Documents/Playground/dtd_vote2_formal_build/dtd_network_vote2_formal.sqlite`

后端当前默认读取的也是这个路径，见：

- `/Users/jhhe/Documents/Playground/dtd_platform/app.py`

其中默认值为：

- `DEFAULT_DB_PATH = "/Users/jhhe/Documents/Playground/dtd_vote2_formal_build/dtd_network_vote2_formal.sqlite"`

### 3.2 正式版导出文件

目录：

- `/Users/jhhe/Documents/Playground/dtd_vote2_formal_build`

关键文件：

- `network_nodes_final.csv`
- `network_edges_final.csv`
- `disease_aliases_final.csv`
- `missing_released_drug_ids.csv`
- `dtd_network_vote2_formal.sqlite`

### 3.3 代理/过渡版本数据库

目录：

- `/Users/jhhe/Documents/Playground/dtd_vote2_proxy_build`

关键文件：

- `dtd_network_vote2_proxy.sqlite`
- `network_nodes_final.csv`
- `network_edges_final.csv`
- `disease_aliases_final.csv`

说明：

- 当前正式平台应优先使用 `dtd_vote2_formal_build`。
- `proxy_build` 更适合作为过渡或对照，不建议误当正式版上线。

## 4. 数据构建与注释补充脚本

这些脚本位于：

- `/Users/jhhe/Documents/Playground`

关键脚本包括：

- `build_dtd_database.py`
- `build_dtd_annotations.py`
- `build_dtd_network_tables.py`
- `upgrade_dtd_modalities.py`
- `enrich_dtd_annotations_online.py`

用途概览：

- `build_dtd_database.py`
  - 建库或更新数据库主表
- `build_dtd_annotations.py`
  - 生成或补充注释信息
- `build_dtd_network_tables.py`
  - 构建平台实际读取的网络节点/边表
- `upgrade_dtd_modalities.py`
  - 扩展多模态字段
- `enrich_dtd_annotations_online.py`
  - 在线抓取并补充药物/靶点等注释

## 5. 论文与图表相关目录

目录：

- `/Users/jhhe/Documents/Playground/dtd_manuscript`

主要内容：

- 论文草稿：`manuscript_draft.md`
- 图表规划：`figure_and_table_plan.md`
- 图数据：`figure_data/`
- 生成图：`generated_figures/`
- 补充表：`supplementary_tables/`
- 阶段分析：`phase_a_analyses/`、`phase_bc_analyses/`
- 相关脚本：如 `plot_manuscript_figures.py`、`build_ttd_external_validation_tables.py`

说明：

- 这部分不直接用于平台运行，但用于比赛材料、论文、结果图和补充分析。

## 6. 当前运行/接手时最重要的事实

### 6.1 正式平台代码在哪里

正式平台代码应认定为：

- 后端：`/Users/jhhe/Documents/Playground/dtd_platform/app.py`
- 前端源码：`/Users/jhhe/Documents/Playground/dtd_platform/frontend/src`
- 实际上线静态文件：`/Users/jhhe/Documents/Playground/dtd_platform/static`
- 正式数据库：`/Users/jhhe/Documents/Playground/dtd_vote2_formal_build/dtd_network_vote2_formal.sqlite`

### 6.2 当前文档有一处旧信息

`README.md` 中仍有旧示例路径：

- `/Users/jhhe/Documents/dtdplat/dtd_network.sqlite`

这不是当前 `app.py` 的默认正式路径。

当前真实默认路径以 `app.py` 为准：

- `/Users/jhhe/Documents/Playground/dtd_vote2_formal_build/dtd_network_vote2_formal.sqlite`

接手人应优先信任 `app.py` 和实际部署变量，而不是旧 README 示例。

### 6.3 当前仓库有未提交改动

`dtd_platform` 当前存在未提交更改，主要集中在：

- `frontend/src/components/AnalysisPage.jsx`
- `frontend/src/components/DatabasePage.jsx`
- `frontend/src/components/HomePage.jsx`
- `frontend/src/styles.css`
- `static/index.html`
- `static/assets/` 下新旧构建文件差异

含义：

- 当前本地状态不是一个完全干净的 git 工作区。
- 接手前建议先确认是否要提交一次“handover checkpoint”。

## 7. 本地启动方式

### 7.1 后端

```bash
cd /Users/jhhe/Documents/Playground/dtd_platform
python3 -m pip install -r requirements.txt
DTD_DB_PATH=/Users/jhhe/Documents/Playground/dtd_vote2_formal_build/dtd_network_vote2_formal.sqlite uvicorn app:app --host 127.0.0.1 --port 8787
```

### 7.2 前端构建

```bash
cd /Users/jhhe/Documents/Playground/dtd_platform/frontend
npm install
npm run build
```

说明：

- `npm run build` 会把构建结果写入 `/Users/jhhe/Documents/Playground/dtd_platform/static`
- FastAPI 最终读取的是 `static/`

## 8. 他人接手建议顺序

建议按这个顺序接手：

1. 先确认正式数据库路径是否正确
2. 运行后端并检查 `/api/health` 与 `/api/ready`
3. 确认 `Home / Analysis / Database / Help` 四页能正常打开
4. 检查 `static/` 是否与当前 `frontend/src/` 最近改动一致
5. 再决定是否继续做前端优化、数据补充或服务器部署

## 9. 接手时优先检查的问题

- README 里的旧数据库路径是否需要同步修正
- 本地未提交改动是否要整理后提交
- 服务器上的 `DTD_DB_PATH` 是否仍指向旧库
- 服务器上的 `static/` 是否仍是旧构建
- 网络图性能和页面折叠是否与本地最新版本一致

## 10. 结论

如果只记四个位置，接手人至少要知道：

- 项目根目录：`/Users/jhhe/Documents/Playground/dtd_platform`
- 正式数据库：`/Users/jhhe/Documents/Playground/dtd_vote2_formal_build/dtd_network_vote2_formal.sqlite`
- 前端源码：`/Users/jhhe/Documents/Playground/dtd_platform/frontend/src`
- 实际上线文件：`/Users/jhhe/Documents/Playground/dtd_platform/static`

