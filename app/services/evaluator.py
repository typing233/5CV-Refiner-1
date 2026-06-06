import json
import re

from app.config import settings
from app.prompts.evaluation import EVALUATION_SYSTEM_PROMPT, EVALUATION_USER_PROMPT
from app.services.llm import ollama_client
from app.utils.exceptions import LLMResponseError


def extract_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    raise LLMResponseError("无法从模型输出中提取有效JSON")


def _validate_report(data: dict) -> dict:
    if "overall_score" not in data:
        data["overall_score"] = 50
    if "dimensions" not in data or not isinstance(data["dimensions"], list):
        data["dimensions"] = []
    if "issues" not in data or not isinstance(data["issues"], list):
        data["issues"] = []
    if "summary" not in data:
        data["summary"] = "评估完成"

    for dim in data["dimensions"]:
        dim.setdefault("dimension", "未知维度")
        dim.setdefault("score", 5)
        dim.setdefault("summary", "")

    for issue in data["issues"]:
        issue.setdefault("dimension", "未知维度")
        issue.setdefault("problem", "")
        issue.setdefault("impact", "")
        issue.setdefault("suggestion", "")
        issue.setdefault("location", "")

    return data


async def evaluate_resume(resume_text: str, job_description: str) -> dict:
    prompt = EVALUATION_USER_PROMPT.format(
        resume_text=resume_text,
        job_description=job_description,
    )

    last_error = None
    for attempt in range(settings.max_retries + 1):
        try:
            response = await ollama_client.generate(
                prompt=prompt,
                system=EVALUATION_SYSTEM_PROMPT,
                temperature=settings.eval_temperature,
                format_json=True,
            )
            data = extract_json(response)
            return _validate_report(data)
        except LLMResponseError as e:
            last_error = e
            if attempt < settings.max_retries:
                continue
            raise

    raise last_error
