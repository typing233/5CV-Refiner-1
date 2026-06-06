import uvicorn
from app.config import settings

if __name__ == "__main__":
    print(f"简历评估优化系统启动中...")
    print(f"Ollama地址: {settings.ollama_base_url}")
    print(f"使用模型: {settings.model_name}")
    print(f"打开浏览器访问: http://localhost:{settings.port}")
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=False)
