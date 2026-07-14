#!/usr/bin/env python3
"""Recalcula os sha256 do manifest.json do pacote de corpus de exemplo.

Uso: python3 scripts/build_manifest.py corpus-example/
"""

import datetime as dt
import hashlib
import json
import sys
from pathlib import Path


def main(root: Path) -> None:
    docs = sorted((root / "docs").glob("*.md"))
    manifest = {
        "corpus_version": dt.date.today().strftime("%Y.%m.%d"),
        "generated_at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"),
        "documents": [
            {
                "path": f"docs/{doc.name}",
                "sha256": hashlib.sha256(doc.read_bytes()).hexdigest(),
            }
            for doc in docs
        ],
    }
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"manifest.json atualizado: {len(docs)} documentos")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
