import json
from unittest.mock import patch, AsyncMock

import pytest

from app.utils.exceptions import LLMTimeoutError, LLMUnavailableError


@pytest.mark.anyio
async def test_ollama_timeout(client, sample_resume_text, sample_jd):
    with patch("app.services.evaluator.ollama_client.generate", new_callable=AsyncMock) as mock_gen:
        mock_gen.side_effect = LLMTimeoutError()

        response = await client.post(
            "/api/evaluate",
            data={"resume_text": sample_resume_text, "job_description": sample_jd},
        )
        assert response.status_code == 200
        events = parse_sse(response.text)
        error_events = [e for e in events if e["event"] == "error"]
        assert len(error_events) == 1
        err = json.loads(error_events[0]["data"])
        assert err["code"] == "LLM_TIMEOUT"
        assert "超时" in err["message"]


@pytest.mark.anyio
async def test_ollama_connection_refused(client, sample_resume_text, sample_jd):
    with patch("app.services.evaluator.ollama_client.generate", new_callable=AsyncMock) as mock_gen:
        mock_gen.side_effect = LLMUnavailableError()

        response = await client.post(
            "/api/evaluate",
            data={"resume_text": sample_resume_text, "job_description": sample_jd},
        )
        events = parse_sse(response.text)
        error_events = [e for e in events if e["event"] == "error"]
        assert len(error_events) == 1
        err = json.loads(error_events[0]["data"])
        assert err["code"] == "LLM_UNAVAILABLE"


@pytest.mark.anyio
async def test_ollama_malformed_json_response(client, sample_resume_text, sample_jd):
    with patch("app.services.evaluator.ollama_client.generate", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = "This is not JSON at all, just plain text with no structure"

        response = await client.post(
            "/api/evaluate",
            data={"resume_text": sample_resume_text, "job_description": sample_jd},
        )
        events = parse_sse(response.text)
        error_events = [e for e in events if e["event"] == "error"]
        assert len(error_events) == 1
        err = json.loads(error_events[0]["data"])
        assert err["code"] == "LLM_RESPONSE_ERROR"


@pytest.mark.anyio
async def test_ollama_json_in_markdown_fence(client, sample_resume_text, sample_jd):
    wrapped_response = """Here is the evaluation:
```json
{"overall_score": 60, "dimensions": [], "issues": [], "summary": "测试"}
```
"""
    with patch("app.services.evaluator.ollama_client.generate", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = wrapped_response

        response = await client.post(
            "/api/evaluate",
            data={"resume_text": sample_resume_text, "job_description": sample_jd},
        )
        events = parse_sse(response.text)
        result_events = [e for e in events if e["event"] == "result"]
        assert len(result_events) == 1
        report = json.loads(result_events[0]["data"])
        assert report["overall_score"] == 60


@pytest.mark.anyio
async def test_health_check_ollama_down(client):
    with patch("app.services.llm.ollama_client.health_check", new_callable=AsyncMock) as mock_hc:
        mock_hc.return_value = {"ollama_available": False, "model_loaded": False, "available_models": []}

        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["ollama_available"] is False


def parse_sse(text):
    events = []
    current_event = ""
    for line in text.split("\n"):
        if line.startswith("event: "):
            current_event = line[7:].strip()
        elif line.startswith("data: "):
            events.append({"event": current_event, "data": line[6:]})
    return events
