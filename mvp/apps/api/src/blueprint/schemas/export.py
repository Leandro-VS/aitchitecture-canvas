"""Exporta os schemas Pydantic como JSON Schema → tipos TS no front (contrato único).

Uso: python -m blueprint.schemas.export --out /tmp/schemas
Conforme os contratos crescerem (Intake, ProposedDiff, JudgeResult...), basta
adicioná-los a EXPORTED — o front regenera com `make types`.
"""

import argparse
import json
from pathlib import Path

from pydantic import BaseModel

from ..routers.archetypes import ArchetypeOut
from ..routers.me import UserOut

EXPORTED: list[type[BaseModel]] = [UserOut, ArchetypeOut]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for model in EXPORTED:
        schema = model.model_json_schema()
        (out / f"{model.__name__}.json").write_text(json.dumps(schema, indent=2))
    print(f"{len(EXPORTED)} schemas exportados para {out}")


if __name__ == "__main__":
    main()
