import json
from unittest.mock import patch, AsyncMock

import pytest


@pytest.mark.anyio
async def test_evaluate_with_text_success(client, sample_resume_text, sample_jd, mock_evaluation_response):
    with patch("app.services.evaluator.ollama_client.generate", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = json.dumps(mock_evaluation_response)

        response = await client.post(
            "/api/evaluate",
            data={"resume_text": sample_resume_text, "job_description": sample_jd},
        )
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

        events = parse_sse(response.text)
        assert any(e["event"] == "status" for e in events)
        result_events = [e for e in events if e["event"] == "result"]
        assert len(result_events) == 1

        report = json.loads(result_events[0]["data"])
        assert report["overall_score"] == 55
        assert len(report["dimensions"]) == 5
        assert len(report["issues"]) == 3


@pytest.mark.anyio
async def test_evaluate_empty_jd(client, sample_resume_text):
    response = await client.post(
        "/api/evaluate",
        data={"resume_text": sample_resume_text, "job_description": ""},
    )
    assert response.status_code == 422


@pytest.mark.anyio
async def test_evaluate_empty_resume(client, sample_jd):
    with patch("app.services.evaluator.ollama_client.generate", new_callable=AsyncMock):
        response = await client.post(
            "/api/evaluate",
            data={"resume_text": "", "job_description": sample_jd},
        )
        assert response.status_code == 200
        events = parse_sse(response.text)
        error_events = [e for e in events if e["event"] == "error"]
        assert len(error_events) == 1
        err = json.loads(error_events[0]["data"])
        assert "为空" in err["message"]


@pytest.mark.anyio
async def test_evaluate_report_has_all_dimensions(client, sample_resume_text, sample_jd, mock_evaluation_response):
    with patch("app.services.evaluator.ollama_client.generate", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = json.dumps(mock_evaluation_response)

        response = await client.post(
            "/api/evaluate",
            data={"resume_text": sample_resume_text, "job_description": sample_jd},
        )
        events = parse_sse(response.text)
        result_events = [e for e in events if e["event"] == "result"]
        report = json.loads(result_events[0]["data"])

        dimension_names = {d["dimension"] for d in report["dimensions"]}
        assert "结构完整性" in dimension_names
        assert "语言表达" in dimension_names
        assert "关键词匹配" in dimension_names
        assert "量化成果" in dimension_names
        assert "冗余内容" in dimension_names


@pytest.mark.anyio
async def test_evaluate_issues_have_required_fields(client, sample_resume_text, sample_jd, mock_evaluation_response):
    with patch("app.services.evaluator.ollama_client.generate", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = json.dumps(mock_evaluation_response)

        response = await client.post(
            "/api/evaluate",
            data={"resume_text": sample_resume_text, "job_description": sample_jd},
        )
        events = parse_sse(response.text)
        result_events = [e for e in events if e["event"] == "result"]
        report = json.loads(result_events[0]["data"])

        for issue in report["issues"]:
            assert "dimension" in issue
            assert "problem" in issue
            assert "impact" in issue
            assert "suggestion" in issue


def parse_sse(text):
    events = []
    current_event = ""
    for line in text.split("\n"):
        if line.startswith("event: "):
            current_event = line[7:].strip()
        elif line.startswith("data: "):
            events.append({"event": current_event, "data": line[6:]})
    return events
