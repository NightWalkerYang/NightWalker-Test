from __future__ import annotations


class SandboxError(Exception):
    code = "sandbox_error"


class PredictError(SandboxError):
    code = "predict_error"


class RuleError(SandboxError):
    code = "rule_error"


class AgentError(SandboxError):
    code = "agent_error"


class GraphError(SandboxError):
    code = "graph_error"


class EngineError(SandboxError):
    code = "engine_error"
