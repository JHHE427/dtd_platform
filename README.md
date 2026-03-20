# DTD Atlas Platform

正式版前端平台（非 demo），直接连接 SQLite 数据库 `dtd_network.sqlite`。  
当前前端已升级为 React 组件架构，画面与交互向 `dtdatlas` 风格对齐。

## 功能

- 全库统计：节点类型计数、边类型计数
- 节点检索：按关键词 + 类型过滤（Drug/Target/Disease）+ 顶部智能建议
- 节点浏览：分页浏览全部节点
- 节点详情：查看边统计和关联邻居（可分页接口）
- 子网可视化：按中心节点、深度、边类别、边类型筛选并渲染 network
- 最短路径查询：Path Finder（source → target，最大 hops 可配）
- 数据导出：分析子网导出 + 数据库筛选结果导出（nodes/edges）

## 目录

- `app.py`: FastAPI 后端 + API
- `frontend/`: React 源码（Vite）
- `static/`: React 构建产物（由 FastAPI 直接托管）

新增 API：

- `/api/suggest`
- `/api/path`
- `/api/node/{id}/neighbors`

## 启动

1. 安装后端依赖

```bash
cd /Users/jhhe/Documents/Playground/dtd_platform
python3 -m pip install -r requirements.txt
```

2. 安装并构建前端（首次或有改动时）

```bash
cd /Users/jhhe/Documents/Playground/dtd_platform/frontend
npm install
npm run build
```

3. 启动服务（默认读取 `/Users/jhhe/Documents/dtdplat/dtd_network.sqlite`）

```bash
cd /Users/jhhe/Documents/Playground/dtd_platform
uvicorn app:app --host 0.0.0.0 --port 8787 --reload
```

4. 打开页面

`http://127.0.0.1:8787`

## 环境变量

- `DTD_DB_PATH`: 自定义数据库路径

示例：

```bash
DTD_DB_PATH=/Users/jhhe/Documents/dtdplat/dtd_network.sqlite uvicorn app:app --port 8787 --reload
```

## 前端开发模式（可选）

React 热更新开发：

```bash
cd /Users/jhhe/Documents/Playground/dtd_platform/frontend
npm run dev
```

默认代理 `/api` 到 `http://127.0.0.1:8787`。
