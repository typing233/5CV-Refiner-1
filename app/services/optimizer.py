import json
from typing import AsyncGenerator

from app.config import settings
from app.prompts.optimization import (
    OPTIMIZATION_SYSTEM_PROMPT,
    OPTIMIZATION_USER_PROMPT,
    CHAT_SYSTEM_PROMPT,
    CHAT_USER_PROMPT,
    FIX_ISSUE_SYSTEM_PROMPT,
    FIX_ISSUE_USER_PROMPT,
)
from app.services.llm import ollama_client


async def optimize_resume(
    resume_text: str,
    job_description: str,
    issues: list[dict],
) -> AsyncGenerator[str, None]:
    issues_text = "\n".join(
        f"- [{issue.get('dimension', '')}] {issue.get('problem', '')}: {issue.get('suggestion', '')}"
        for issue in issues
    )

    prompt = OPTIMIZATION_USER_PROMPT.format(
        resume_text=resume_text,
        job_description=job_description,
        issues_text=issues_text,
    )

    async for token in ollama_client.generate_stream(
        prompt=prompt,
        system=OPTIMIZATION_SYSTEM_PROMPT,
        temperature=settings.opt_temperature,
    ):
        yield token


async def fix_single_issue(
    resume_text: str,
    job_description: str,
    issue: dict,
) -> AsyncGenerator[str, None]:
    prompt = FIX_ISSUE_USER_PROMPT.format(
        resume_text=resume_text,
        job_description=job_description,
        dimension=issue.get("dimension", ""),
        problem=issue.get("problem", ""),
        impact=issue.get("impact", ""),
        suggestion=issue.get("suggestion", ""),
        location=issue.get("location", ""),
    )

    async for token in ollama_client.generate_stream(
        prompt=prompt,
        system=FIX_ISSUE_SYSTEM_PROMPT,
        temperature=settings.opt_temperature,
    ):
        yield token


async def chat_followup(
    question: str,
    resume_text: str,
    job_description: str,
    evaluation_summary: str,
) -> AsyncGenerator[str, None]:
    prompt = CHAT_USER_PROMPT.format(
        question=question,
        resume_text=resume_text,
        job_description=job_description,
        evaluation_summary=evaluation_summary,
    )

    async for token in ollama_client.generate_stream(
        prompt=prompt,
        system=CHAT_SYSTEM_PROMPT,
        temperature=settings.opt_temperature,
    ):
        yield token
