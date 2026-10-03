"""The same checker is used in browser workers and content verification.

Each browser test owns a fresh Pyodide interpreter. This module never mounts or
reads host files. It grades a named Python value, not printed output.
"""

import contextlib
import copy
import io
import json
import math
import traceback


class OutputLimitExceeded(Exception):
    pass


class LimitedOutput(io.StringIO):
    def __init__(self, limit=8000):
        super().__init__()
        self.limit = limit
        self.written = 0

    def write(self, value):
        remaining = self.limit - self.written
        super().write(value[:remaining])
        self.written += min(len(value), remaining)
        if len(value) > remaining:
            raise OutputLimitExceeded("Output reached 8,000 characters. Check whether a loop keeps printing.")
        return len(value)


def same_value(actual, expected):
    """Keep Python's bool/int and list/tuple distinctions visible to learners."""
    if type(actual) is not type(expected):
        return False
    if isinstance(expected, list):
        return len(actual) == len(expected) and all(
            same_value(item, target) for item, target in zip(actual, expected)
        )
    if isinstance(expected, dict):
        return actual.keys() == expected.keys() and all(
            same_value(actual[key], expected[key]) for key in expected
        )
    return actual == expected


def display_value(value, budget=None, seen=None, depth=0):
    """Return bounded JSON data even for accidental cycles or non-JSON values."""
    if budget is None:
        budget = [1000]
    if seen is None:
        seen = set()
    if depth > 12:
        return "<deeper items omitted>"
    budget[0] -= 1
    if budget[0] < 0:
        return "<remaining items omitted>"
    if value is None or type(value) in (bool, int):
        if type(value) is int and value.bit_length() > 4096:
            return "<very large integer>"
        if type(value) is int and abs(value) > 9007199254740991:
            return f"{value} (integer)"
        return value
    if type(value) is float:
        return value if math.isfinite(value) else str(value)
    if type(value) is str:
        return value[:8000] + ("…" if len(value) > 8000 else "")
    if id(value) in seen:
        return "<circular reference>"
    if type(value) in (list, dict):
        seen.add(id(value))
        if type(value) is list:
            result = [display_value(item, budget, seen, depth + 1) for item in value[:1000]]
            if len(value) > 1000:
                result.append("<remaining items omitted>")
        else:
            result = {}
            for index, (key, item) in enumerate(value.items()):
                if index >= 99:
                    result["…"] = "<remaining items omitted>"
                    break
                key_text = str(key)[:200]
                if key_text in ("__proto__", "prototype", "constructor"):
                    key_text = f"<key: {key_text}>"
                result[key_text] = display_value(item, budget, seen, depth + 1)
        seen.remove(id(value))
        return result
    # Avoid calling user-defined __repr__ just to show feedback.
    return f"<{type(value).__name__}: expected the result type stated in the exercise>"


def describe_error(error, code):
    if isinstance(error, SyntaxError):
        line = error.lineno
        source = (error.text or "").rstrip()
        marker = " " * max(0, (error.offset or 1) - 1) + "^"
        return f"{type(error).__name__} on line {line}: {error.msg}\n{source}\n{marker}"
    frames = [frame for frame in traceback.extract_tb(error.__traceback__) if frame.filename == "<your code>"]
    location = f" on line {frames[-1].lineno}" if frames else ""
    source_lines = code.splitlines()
    source = ""
    if frames and 0 < frames[-1].lineno <= len(source_lines):
        source = "\n" + source_lines[frames[-1].lineno - 1]
    return f"{type(error).__name__}{location}: {str(error)[:2000]}{source}"


def check_attempt(code, input_json, expected_json, result_variable="result", checks_json="{}"):
    inputs = json.loads(input_json)
    expected = json.loads(expected_json)
    checks = json.loads(checks_json)
    original_inputs = copy.deepcopy(inputs)
    namespace = {"__name__": "__main__", **inputs}
    original_objects = dict(inputs)
    output = LimitedOutput()
    response = {"passed": False, "actual": None, "stdout": "", "error": None, "errorType": None}
    try:
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            exec(compile(code, "<your code>", "exec"), namespace)
        if result_variable not in namespace:
            response["errorType"] = "MissingResult"
            response["error"] = f"Store your answer in {result_variable}. Printing alone does not set this variable."
        else:
            result = namespace[result_variable]
            response["actual"] = display_value(result)
            if len(json.dumps(response["actual"], ensure_ascii=False)) > 12000:
                response["actual"] = f"<{type(result).__name__}: result is too large to display; inspect a shorter example>"
            response["passed"] = same_value(result, expected)
            if not response["passed"] and type(result) is not type(expected):
                response["errorType"] = "ResultType"
                response["error"] = f"{result_variable} should be a {type(expected).__name__}; your code produced a {type(result).__name__}."
            distinct_name = checks.get("distinctFrom")
            if distinct_name and result is original_objects.get(distinct_name):
                response["passed"] = False
                response["errorType"] = "Contract"
                response["error"] = f"Build a new list. {result_variable} currently refers to the original {distinct_name} list."
            for name in checks.get("preserveInputs", []):
                if name not in original_objects or not same_value(original_objects[name], original_inputs[name]):
                    response["passed"] = False
                    response["errorType"] = "Contract"
                    response["error"] = f"Keep the original {name} unchanged, as the exercise requires."
                    break
    except BaseException as error:
        response["errorType"] = type(error).__name__
        response["error"] = describe_error(error, code)[:8000]
    response["stdout"] = output.getvalue()
    return json.dumps(response, ensure_ascii=False, allow_nan=False)
