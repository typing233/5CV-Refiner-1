from pydantic import BaseModel


class Issue(BaseModel):
    dimension: str
    problem: str
    impact: str
    suggestion: str
    location: str = ""


class DimensionScore(BaseModel):
    dimension: str
    score: int
    summary: str


class EvaluationReport(BaseModel):
    overall_score: int
    dimensions: list[DimensionScore]
    issues: list[Issue]
    summary: str


class ChatRequest(BaseModel):
    question: str
    resume_text: str
    job_description: str
    evaluation_summary: str = ""


class OptimizeRequest(BaseModel):
    resume_text: str
    job_description: str
    issues: list[dict] = []


class HealthResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    status: str
    ollama_available: bool
    model_loaded: bool
    available_models: list[str] = []


class ErrorResponse(BaseModel):
    code: str
    message: str
