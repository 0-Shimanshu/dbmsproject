from typing import Any


def success_response(data: Any = None, message: str | None = None, **extra: Any) -> dict:
    payload: dict[str, Any] = {"success": True}
    if message is not None:
        payload["message"] = message
    if data is not None:
        payload["data"] = data
    payload.update(extra)
    return payload


def error_response(message: str) -> dict:
    return {"success": False, "message": message}
