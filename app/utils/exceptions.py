class AppError(Exception):
    def __init__(self, message: str, code: str, status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


class FileParseError(AppError):
    def __init__(self, message: str):
        super().__init__(message, "FILE_PARSE_ERROR", 400)


class FileTooLargeError(AppError):
    def __init__(self):
        super().__init__("文件大小超过5MB限制", "FILE_TOO_LARGE", 413)


class UnsupportedFormatError(AppError):
    def __init__(self, filename: str):
        super().__init__(f"不支持的文件格式: {filename}", "UNSUPPORTED_FORMAT", 400)


class LLMTimeoutError(AppError):
    def __init__(self):
        super().__init__("模型响应超时，请稍后重试", "LLM_TIMEOUT", 504)


class LLMUnavailableError(AppError):
    def __init__(self):
        super().__init__("模型服务不可用，请确认Ollama已启动", "LLM_UNAVAILABLE", 503)


class LLMResponseError(AppError):
    def __init__(self, detail: str):
        super().__init__(f"模型返回格式异常: {detail}", "LLM_RESPONSE_ERROR", 502)


class InputValidationError(AppError):
    def __init__(self, message: str):
        super().__init__(message, "VALIDATION_ERROR", 422)
