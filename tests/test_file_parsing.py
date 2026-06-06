import pytest
from io import BytesIO


@pytest.mark.anyio
async def test_parse_unsupported_file_type(client):
    response = await client.post(
        "/api/parse",
        files={"file": ("test.xyz", BytesIO(b"some content"), "application/octet-stream")},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["code"] == "UNSUPPORTED_FORMAT"
    assert "不支持" in data["message"]


@pytest.mark.anyio
async def test_parse_corrupted_pdf(client):
    fake_pdf = BytesIO(b"%PDF-1.4 this is corrupted content not a real pdf")
    response = await client.post(
        "/api/parse",
        files={"file": ("bad.pdf", fake_pdf, "application/pdf")},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["code"] == "FILE_PARSE_ERROR"
    assert "解析失败" in data["message"]


@pytest.mark.anyio
async def test_parse_corrupted_docx(client):
    fake_docx = BytesIO(b"PK\x03\x04 not a real docx")
    response = await client.post(
        "/api/parse",
        files={"file": ("bad.docx", fake_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["code"] == "FILE_PARSE_ERROR"


@pytest.mark.anyio
async def test_parse_oversized_file(client):
    large_content = b"x" * (6 * 1024 * 1024)
    response = await client.post(
        "/api/parse",
        files={"file": ("big.pdf", BytesIO(large_content), "application/pdf")},
    )
    assert response.status_code == 413
    data = response.json()
    assert data["code"] == "FILE_TOO_LARGE"


@pytest.mark.anyio
async def test_parse_valid_txt(client):
    content = "张三\n软件工程师\n工作经历：\n- 开发了用户系统"
    response = await client.post(
        "/api/parse",
        files={"file": ("resume.txt", BytesIO(content.encode("utf-8")), "text/plain")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "张三" in data["text"]
    assert data["filename"] == "resume.txt"


@pytest.mark.anyio
async def test_evaluate_with_corrupted_file(client, sample_jd):
    fake_pdf = b"not a valid pdf at all"
    response = await client.post(
        "/api/evaluate",
        data={"job_description": sample_jd, "resume_text": ""},
        files={"resume_file": ("bad.pdf", BytesIO(fake_pdf), "application/pdf")},
    )
    assert response.status_code == 200
    text = response.text
    assert "error" in text
    assert "解析失败" in text or "FILE_PARSE_ERROR" in text
