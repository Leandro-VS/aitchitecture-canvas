import hashlib
import json
from pathlib import Path

import pytest

from blueprint.corpus.parser import (
    MAX_CHUNK_CHARS,
    ReleaseRejected,
    chunk_by_headings,
    validate_release,
)

CORPUS_DIR = Path(__file__).parents[3] / "corpus-example"  # mvp/corpus-example


def load_example() -> tuple[str, dict, dict[str, bytes]]:
    manifest = json.loads((CORPUS_DIR / "manifest.json").read_text())
    files = {
        f"docs/{p.name}": p.read_bytes() for p in (CORPUS_DIR / "docs").glob("*.md")
    }
    return manifest["corpus_version"], manifest, files


def test_example_package_is_valid():
    version, manifest, files = load_example()
    docs = validate_release(version, manifest, files)
    assert {d.doc_id for d in docs} == {"SEC-012", "GENAI-001", "REF-ARCH-RAG-01"}
    sec = next(d for d in docs if d.doc_id == "SEC-012")
    assert [c.heading_path for c in sec.chunks] == ["Regra", "Racional", "Exceções"]
    assert "guardrail de saída" in sec.chunks[0].content


def test_wrong_version_is_rejected():
    version, manifest, files = load_example()
    with pytest.raises(ReleaseRejected, match="1 erro"):
        validate_release("outra-versao", manifest, files)


def test_bad_checksum_rejects_whole_release():
    version, manifest, files = load_example()
    path = manifest["documents"][0]["path"]
    files[path] = files[path] + b"\nadulterado"
    with pytest.raises(ReleaseRejected) as exc:
        validate_release(version, manifest, files)
    assert any("checksum" in e for e in exc.value.errors)


def test_missing_frontmatter_key_is_reported():
    version, manifest, files = load_example()
    path = manifest["documents"][0]["path"]
    body = files[path].decode()
    tampered = body.replace("domain: genai\n", "").encode()
    manifest["documents"][0]["sha256"] = hashlib.sha256(tampered).hexdigest()
    files[path] = tampered
    with pytest.raises(ReleaseRejected) as exc:
        validate_release(version, manifest, files)
    assert any("domain" in e for e in exc.value.errors)


def test_missing_file_is_reported():
    version, manifest, files = load_example()
    missing = manifest["documents"][0]["path"]
    del files[missing]
    with pytest.raises(ReleaseRejected) as exc:
        validate_release(version, manifest, files)
    assert any("ausente" in e for e in exc.value.errors)


def test_chunking_preserves_hierarchy_and_splits_long_sections():
    body = (
        "preâmbulo antes do primeiro heading\n\n"
        "## Regra\n\ntexto da regra\n\n"
        "### Detalhe\n\ntexto do detalhe\n\n"
        "## Outra seção\n\n" + ("parágrafo longo. " * 400)  # > MAX_CHUNK_CHARS
    )
    chunks = chunk_by_headings(body)
    paths = [c.heading_path for c in chunks]
    assert paths[0] == ""  # preâmbulo
    assert "Regra" in paths
    assert "Regra > Detalhe" in paths
    long_parts = [c for c in chunks if c.heading_path == "Outra seção"]
    assert len(long_parts) >= 2  # seção longa particionada
    assert all(len(c.content) <= MAX_CHUNK_CHARS for c in chunks)
