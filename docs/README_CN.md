# NyaGallery 首页

[English home](../README.md)

NyaGallery 是一个面向插画收藏的自部署图库系统，用于归档、浏览、搜索、打标签、上传和同步图片资源。当前包含 FastAPI 后端、Next.js 前端、不可变原图存储、可重建 metadata/数据库索引、Pixiv 同步、多用户权限、API Token、媒体缓存，以及可选 PostgreSQL/Redis 支持。

## 文档导航

| 文档 | 作用 |
| --- | --- |
| [../README.md](../README.md) | 英文项目首页、快速上手和开发说明。 |
| [../READMORE.md](../READMORE.md) | 英文完整后端、存储、标签、Pixiv、API 与测试说明。 |
| [README_CN.md](README_CN.md) | 中文项目首页、快速上手和开发说明。 |
| [READMORE_CN.md](READMORE_CN.md) | 中文完整后端、存储、标签、Pixiv、API 与测试说明。 |
| [QUICKSTART_CN.md](QUICKSTART_CN.md) | 中文简洁部署步骤和常用命令。 |
| [USAGE_CN.md](USAGE_CN.md) | 中文完整使用手册、API 示例、维护流程和 FAQ。 |
| [summary.md](summary.md) | 中文当前实现、模块边界和后续方向总结。 |
| [../frontend/README.md](../frontend/README.md) | 前端结构、页面、hooks、API 对照和构建说明。 |
| [../config.example.toml](../config.example.toml) | 后端部署配置模板。 |

## 环境要求

- Python 3.11+
- Node.js 18+
- npm
- 可选：PostgreSQL、Redis、Pixiv refresh token、媒体/Pixiv 可选依赖

## 快速启动

安装后端：

```powershell
python -m pip install -e ".[media,pixiv,pixiv-login,postgres,redis]"
```

安装前端：

```powershell
cd frontend
npm install
cd ..
```

初始化 `storage/`、标签目录、数据库和管理员账号：

```powershell
nyagallery --storage storage setup --username admin --role admin --password 123123
```

启动后端：

```powershell
nyagallery --storage storage serve --host 127.0.0.1 --port 8001
```

另开终端启动前端：

```powershell
cd frontend
$env:NYA_API_BACKEND = "http://127.0.0.1:8001"
npm run dev
```

访问：

```text
http://localhost:3000
```

## 配置文件

需要可复用部署配置时，复制模板：

```powershell
Copy-Item config.example.toml nyagallery.toml
nyagallery --config nyagallery.toml serve
```

主要配置段：

- `[core]`：存储根目录、数据库 URL、标签目录路径
- `[server]`：监听地址、端口、访问日志、安全 Cookie
- `[site]`：项目主页、仓库地址、可选 ICP 备案号
- `[pixiv]`：可选 Pixiv 默认凭据和同步默认参数
- `[redis]`：可选 Redis URL 和共享安全限流

## 常用命令

重建数据库索引：

```powershell
nyagallery --storage storage rebuild-db
```

生成媒体缓存：

```powershell
nyagallery --storage storage generate-cache
```

同步单个 Pixiv 作品：

```powershell
nyagallery --storage storage pixiv-sync-pid 123456 --generate-cache --rebuild-db
```

创建用户：

```powershell
nyagallery --storage storage create-user viewer --role viewer --password 123123
```

签发 API Token：

```powershell
nyagallery --storage storage issue-token viewer
```

## 开发教程

后端检查：

```powershell
python -m py_compile src/nyagallery/*.py
python -m unittest tests.test_config tests.test_tags tests.test_db
```

前端检查：

```powershell
cd frontend
npm run typecheck
npm run lint
npm run build
```

推荐开发安装：

```powershell
python -m pip install -e ".[dev,media,pixiv,pixiv-login,postgres,redis]"
```

## 发行文件

建议包含：

- `src/`
- `frontend/`
- `pyproject.toml`
- `config.example.toml`
- `README.md`、`READMORE.md`、`docs/README_CN.md`、`docs/READMORE_CN.md`、`docs/QUICKSTART_CN.md`、`docs/USAGE_CN.md`、`docs/summary.md`、`frontend/README.md`
- `LICENSE`

不要包含运行时/缓存目录：

- `storage/`
- `frontend/node_modules/`
- `frontend/.next/`
- `frontend/tsconfig.tsbuildinfo`
- `dist/`、`build/`、`*.egg-info/`

## 架构说明

原图不可变；metadata、数据库索引和媒体缓存都可重建。标签别名、显示名、蕴含关系和来源站点标签由后端 tag catalog 统一管理，方便多个前端、多个后端实例或未来云存储部署共享同一套标签语义。
