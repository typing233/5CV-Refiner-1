# 简历评估与优化系统 (CV Refiner)

基于本地大模型的简历评估与优化工具。上传简历 + 目标岗位描述，自动从五个维度进行专业评估，生成结构化问题清单和优化建议，并提供交互式对话修改能力。

**核心特点：**
- 五维度定制评估（结构完整性、语言表达、关键词匹配、量化成果、冗余内容）
- 支持 PDF / DOCX / TXT 文件自动抽取
- 生成 Markdown 格式评估报告 + 优化后简历草稿
- Web 对话界面，支持追问和逐条修改
- 前后差异对比视图
- 全本地运行，无云服务依赖，简历数据不落盘

## 系统要求

- Python 3.11+
- [Ollama](https://ollama.ai) 已安装并运行
- 推荐硬件：2核CPU / 4GB内存（可流畅运行7B量化模型）

## 快速开始

### 方式一：直接运行

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 确保 Ollama 已启动并拉取模型
ollama serve &
ollama pull qwen2:7b-instruct-q4_0

# 3. 启动服务
python run.py
```

打开浏览器访问 http://localhost:8080

### 方式二：Docker Compose

```bash
# 一键启动（含 Ollama 服务）
docker compose up -d

# 首次运行需拉取模型（约4GB）
docker compose exec ollama ollama pull qwen2:7b-instruct-q4_0
```

访问 http://localhost:8080

## 配置

通过环境变量或 `.env` 文件配置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama 服务地址 |
| `MODEL_NAME` | `qwen2:7b-instruct-q4_0` | 使用的模型名称 |
| `TIMEOUT_SECONDS` | `120` | 模型推理超时时间（秒） |
| `MAX_FILE_SIZE_MB` | `5` | 上传文件大小限制 |
| `NUM_CTX` | `4096` | 模型上下文窗口大小 |
| `PORT` | `8080` | 服务端口 |

## API 说明

### `POST /api/evaluate`

提交简历进行评估。返回 SSE（Server-Sent Events）流。

**请求格式：** `multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `resume_file` | File | 否 | 简历文件（PDF/DOCX/TXT） |
| `resume_text` | string | 否 | 简历文本（与文件二选一） |
| `job_description` | string | 是 | 目标岗位描述 |

**SSE 事件：**

```
event: status
data: {"stage": "parsing", "message": "正在解析文件..."}

event: status
data: {"stage": "evaluating", "message": "正在评估简历..."}

event: result
data: {"overall_score": 65, "dimensions": [...], "issues": [...], "summary": "..."}

event: error
data: {"code": "LLM_TIMEOUT", "message": "模型响应超时"}
```

**评估结果结构：**

```json
{
  "overall_score": 65,
  "dimensions": [
    {"dimension": "结构完整性", "score": 7, "summary": "..."},
    {"dimension": "语言表达", "score": 5, "summary": "..."},
    {"dimension": "关键词匹配", "score": 6, "summary": "..."},
    {"dimension": "量化成果", "score": 4, "summary": "..."},
    {"dimension": "冗余内容", "score": 8, "summary": "..."}
  ],
  "issues": [
    {
      "dimension": "语言表达",
      "problem": "使用模糊表达'参与了'",
      "impact": "HR无法判断具体贡献",
      "suggestion": "改为'主导XX系统核心模块开发'",
      "location": "工作经历第1段"
    }
  ],
  "summary": "总体评价..."
}
```

### `POST /api/optimize`

生成优化后的简历草稿。返回 SSE 流（逐字输出 Markdown）。

**请求格式：** `application/json`

```json
{
  "resume_text": "原始简历文本",
  "job_description": "目标岗位描述",
  "issues": [{"dimension": "...", "problem": "...", "suggestion": "..."}]
}
```

### `POST /api/chat`

对评估结果进行追问。返回 SSE 流。

**请求格式：** `application/json`

```json
{
  "question": "工作经历第一段怎么改比较好？",
  "resume_text": "原始简历文本",
  "job_description": "目标岗位描述",
  "evaluation_summary": "评估总结"
}
```

### `POST /api/parse`

从上传文件中提取文本。

**请求：** `multipart/form-data`，字段 `file`

**响应：**
```json
{"text": "提取的文本内容", "filename": "resume.pdf"}
```

### `GET /api/health`

健康检查。

**响应：**
```json
{
  "status": "ok",
  "ollama_available": true,
  "model_loaded": true,
  "available_models": ["qwen2:7b-instruct-q4_0"]
}
```

## 错误码

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| `VALIDATION_ERROR` | 422 | 输入验证失败 |
| `FILE_PARSE_ERROR` | 400 | 文件解析失败 |
| `FILE_TOO_LARGE` | 413 | 文件超过大小限制 |
| `UNSUPPORTED_FORMAT` | 400 | 不支持的文件格式 |
| `LLM_TIMEOUT` | 504 | 模型响应超时 |
| `LLM_UNAVAILABLE` | 503 | Ollama 服务不可用 |
| `LLM_RESPONSE_ERROR` | 502 | 模型返回格式异常 |

## 运行测试

```bash
pip install -r requirements.txt
python -m pytest tests/ -v
```

测试覆盖三类场景：
- `test_evaluation.py` — 正常评估流程（报告结构、五维度完整性）
- `test_file_parsing.py` — 文件格式异常（损坏PDF、不支持格式、超大文件）
- `test_llm_failure.py` — 模型调用失败（超时、不可用、返回格式错误）

## 隐私说明

- 所有简历数据仅在内存中处理，不写入磁盘
- 无日志记录用户简历内容
- 本地模型推理，数据不出服务器
- 会话结束后数据随进程销毁

## 项目结构

```
├── app/
│   ├── main.py              # FastAPI 应用入口
│   ├── config.py            # 配置管理
│   ├── api/
│   │   ├── routes.py        # API 路由
│   │   └── schemas.py       # 数据模型
│   ├── services/
│   │   ├── llm.py           # Ollama 客户端
│   │   ├── parser.py        # 文件解析
│   │   ├── evaluator.py     # 评估逻辑
│   │   └── optimizer.py     # 优化与对话
│   ├── prompts/
│   │   ├── evaluation.py    # 评估提示词
│   │   └── optimization.py  # 优化提示词
│   └── utils/
│       └── exceptions.py    # 自定义异常
├── static/                  # 前端静态文件
├── tests/                   # 测试文件
├── docker-compose.yml       # Docker 编排
├── Dockerfile
├── requirements.txt
└── run.py                   # 启动脚本
```
