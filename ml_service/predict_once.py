from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ml_service.app.main import PredictBenchmarkPayload, predict_benchmark


def main() -> None:
    payload = json.loads(sys.stdin.read())
    parsed = PredictBenchmarkPayload.model_validate(payload)
    result = predict_benchmark(parsed)
    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    main()
