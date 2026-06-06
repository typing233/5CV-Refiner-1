import json

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import StreamingResponse

from app.api.schemas import ChatRequest, OptimizeRequest, FixIssueRequest, HealthResponse
from app.services.evaluator import evaluate_resume
from app.services.optimizer import optimize_resume, chat_followup, fix_single_issue
from app.services.parser import parse_file
from app.services.report import generate_markdown_report
from app.services.llm import ollama_client
from app.utils.exceptions import InputValidationError

router = APIRouter(prefix="/api")


def _sse_event(event: str, data: dict | str) -> str:
    if isinstance(data, dict):
        data = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {data}\n\n"


@router.post("/evaluate")
async def evaluate(
    resume_file: UploadFile | None = File(default=None),
    resume_text: str = Form(default=""),
    job_description: str = Form(default=""),
):
    if not job_description.strip():
        raise InputValidationError("目标岗位描述不能为空")

    async def event_stream():
        text = resume_text

        if resume_file and resume_file.filename:
            yield _sse_event("status", {"stage": "parsing", "message": "正在解析文件..."})
            try:
                content = await resume_file.read()
                text = await parse_file(content, resume_file.filename)
            except Exception as e:
                yield _sse_event("error", {
                    "code": getattr(e, "code", "FILE_PARSE_ERROR"),
                    "message": getattr(e, "message", str(e)),
                })
                return

        if not text.strip():
            yield _sse_event("error", {"code": "VALIDATION_ERROR", "message": "简历内容为空，请上传文件或粘贴文本"})
            return

        yield _sse_event("status", {"stage": "evaluating", "message": "正在评估简历..."})

        try:
            report = await evaluate_resume(text, job_description)
            markdown_report = generate_markdown_report(report)
            report["markdown_report"] = markdown_report
            report["parsed_resume_text"] = text
            yield _sse_event("result", report)
        except Exception as e:
            yield _sse_event("error", {
                "code": getattr(e, "code", "UNKNOWN_ERROR"),
                "message": getattr(e, "message", str(e)),
            })

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/optimize")
async def optimize(request: OptimizeRequest):
    if not request.resume_text.strip():
        raise InputValidationError("简历内容不能为空")
    if not request.job_description.strip():
        raise InputValidationError("目标岗位描述不能为空")

    async def event_stream():
        yield _sse_event("status", {"stage": "optimizing", "message": "正在生成优化建议..."})
        try:
            async for token in optimize_resume(
                request.resume_text, request.job_description, request.issues
            ):
                yield _sse_event("token", {"content": token})
            yield _sse_event("done", {"message": "优化完成"})
        except Exception as e:
            yield _sse_event("error", {
                "code": getattr(e, "code", "UNKNOWN_ERROR"),
                "message": getattr(e, "message", str(e)),
            })

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/chat")
async def chat(request: ChatRequest):
    if not request.question.strip():
        raise InputValidationError("问题不能为空")

    async def event_stream():
        try:
            async for token in chat_followup(
                question=request.question,
                resume_text=request.resume_text,
                job_description=request.job_description,
                evaluation_summary=request.evaluation_summary,
            ):
                yield _sse_event("token", {"content": token})
            yield _sse_event("done", {"message": "回答完成"})
        except Exception as e:
            yield _sse_event("error", {
                "code": getattr(e, "code", "UNKNOWN_ERROR"),
                "message": getattr(e, "message", str(e)),
            })

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/parse")
async def parse(file: UploadFile = File(...)):
    if not file.filename:
        raise InputValidationError("未提供文件")
    content = await file.read()
    text = await parse_file(content, file.filename)
    return {"text": text, "filename": file.filename}


@router.post("/fix-issue")
async def fix_issue(request: FixIssueRequest):
    if not request.resume_text.strip():
        raise InputValidationError("简历内容不能为空")

    async def event_stream():
        try:
            async for token in fix_single_issue(
                resume_text=request.resume_text,
                job_description=request.job_description,
                issue=request.issue,
            ):
                yield _sse_event("token", {"content": token})
            yield _sse_event("done", {"message": "修改完成"})
        except Exception as e:
            yield _sse_event("error", {
                "code": getattr(e, "code", "UNKNOWN_ERROR"),
                "message": getattr(e, "message", str(e)),
            })

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/health", response_model=HealthResponse)
async def health():
    llm_status = await ollama_client.health_check()
    return HealthResponse(
        status="ok" if llm_status["ollama_available"] else "degraded",
        **llm_status,
    )
