from io import BytesIO

import pdfplumber
from docx import Document

from app.config import settings
from app.utils.exceptions import FileParseError, FileTooLargeError, UnsupportedFormatError

MAX_FILE_SIZE = settings.max_file_size_mb * 1024 * 1024
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt"}


async def parse_file(content: bytes, filename: str) -> str:
    if len(content) > MAX_FILE_SIZE:
        raise FileTooLargeError()

    ext = _get_extension(filename)
    if ext not in SUPPORTED_EXTENSIONS:
        raise UnsupportedFormatError(filename)

    if ext == ".pdf":
        return _parse_pdf(BytesIO(content))
    elif ext in (".docx", ".doc"):
        return _parse_docx(BytesIO(content))
    elif ext == ".txt":
        return content.decode("utf-8", errors="replace")

    raise UnsupportedFormatError(filename)


def _get_extension(filename: str) -> str:
    if "." not in filename:
        return ""
    return "." + filename.rsplit(".", 1)[-1].lower()


def _parse_pdf(buffer: BytesIO) -> str:
    try:
        with pdfplumber.open(buffer) as pdf:
            pages = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
            result = "\n\n".join(pages)
            if not result.strip():
                raise FileParseError("PDF文件中未提取到文字内容，可能是扫描件或图片PDF")
            return result
    except FileParseError:
        raise
    except Exception as e:
        raise FileParseError(f"PDF解析失败: {str(e)}")


def _parse_docx(buffer: BytesIO) -> str:
    try:
        doc = Document(buffer)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        result = "\n".join(paragraphs)
        if not result.strip():
            raise FileParseError("DOCX文件中未提取到文字内容")
        return result
    except FileParseError:
        raise
    except Exception as e:
        raise FileParseError(f"DOCX解析失败: {str(e)}")
