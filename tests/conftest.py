import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def sample_resume_text():
    return """张三
软件工程师 | 3年经验
联系方式: zhangsan@email.com | 13800138000

工作经历：
2021-2023 某科技公司 后端开发工程师
- 参与了用户系统的开发
- 负责一些接口的编写
- 做了一些性能优化的工作

教育背景：
2017-2021 某大学 计算机科学与技术 本科

技能：
Python, Java, MySQL
"""


@pytest.fixture
def sample_jd():
    return """高级Python开发工程师

岗位职责：
1. 负责核心业务系统的架构设计和开发
2. 优化系统性能，提升服务稳定性
3. 参与技术方案评审和代码审查

任职要求：
1. 3年以上Python开发经验
2. 熟悉FastAPI/Django等Web框架
3. 熟悉MySQL/Redis/MongoDB等数据库
4. 有微服务架构设计和实践经验
5. 熟悉Docker/Kubernetes等容器技术
6. 良好的沟通能力和团队合作精神
"""


@pytest.fixture
def mock_evaluation_response():
    return {
        "overall_score": 55,
        "dimensions": [
            {"dimension": "结构完整性", "score": 7, "summary": "基本结构完整，缺少项目经验模块"},
            {"dimension": "语言表达", "score": 4, "summary": "大量模糊表达，缺乏强动词"},
            {"dimension": "关键词匹配", "score": 5, "summary": "缺少多个关键技术词"},
            {"dimension": "量化成果", "score": 3, "summary": "几乎没有量化数据"},
            {"dimension": "冗余内容", "score": 7, "summary": "内容较精简，无明显冗余"},
        ],
        "issues": [
            {
                "dimension": "语言表达",
                "problem": "使用'参与了'、'负责一些'等模糊表达",
                "impact": "HR无法判断你的具体贡献和能力水平，简历可能在初筛阶段被淘汰",
                "suggestion": "改为'主导用户系统核心模块开发，独立完成XX功能'",
                "location": "工作经历第1段",
            },
            {
                "dimension": "量化成果",
                "problem": "'做了一些性能优化的工作'缺少具体数据",
                "impact": "缺乏说服力，面试官无法评估你的实际贡献",
                "suggestion": "改为'优化核心接口响应时间，P99延迟从500ms降至120ms，QPS提升3倍'",
                "location": "工作经历第1段第3条",
            },
            {
                "dimension": "关键词匹配",
                "problem": "缺少FastAPI、Redis、Docker、Kubernetes、微服务等关键词",
                "impact": "ATS系统关键词匹配度低，可能被自动过滤",
                "suggestion": "在技能栏补充：FastAPI, Redis, Docker, Kubernetes；工作描述中体现微服务实践",
                "location": "技能栏",
            },
        ],
        "summary": "简历结构基本完整但表述过于模糊，缺少量化成果和关键技术词，建议重点优化语言表达并补充数据支撑。",
    }
