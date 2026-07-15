"""Parser e validação do pacote de corpus (contrato D9/§8.1) + chunking.

Funções puras sobre (manifest, arquivos em memória) — o transporte (S3/MinIO)
fica em ingest.py. Release é atômica: qualquer erro rejeita o pacote inteiro
com relatório por documento.
"""

import hashlib
import re
from dataclasses import dataclass, field

import frontmatter

REQUIRED_META = {"id", "title", "doc_type", "domain", "version", "status"}
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
MAX_CHUNK_CHARS = 3000  # ~700 tokens; seções maiores são particionadas


class ReleaseRejected(Exception):
    def __init__(self, version: str, errors: list[str]):
        super().__init__(f"release {version} rejeitada: {len(errors)} erro(s)")
        self.version = version
        self.errors = errors


@dataclass
class Chunk:
    heading_path: str  # "Regra" / "Regra > Exceções" / "" (preâmbulo)
    content: str


@dataclass
class ParsedDoc:
    doc_id: str
    title: str
    doc_type: str
    domain: str
    front_matter: dict
    chunks: list[Chunk] = field(default_factory=list)


def chunk_by_headings(body: str) -> list[Chunk]:
    """Divide o corpo pelos headings, preservando o caminho hierárquico —
    é o heading_path que torna a citação (doc > seção) verificável (D15)."""
    sections: list[tuple[str, list[str]]] = [("", [])]  # (heading_path, linhas)
    stack: list[tuple[int, str]] = []  # (nível, texto)

    for line in body.splitlines():
        m = HEADING_RE.match(line)
        if m:
            level, text = len(m.group(1)), m.group(2)
            while stack and stack[-1][0] >= level:
                stack.pop()
            stack.append((level, text))
            sections.append((" > ".join(t for _, t in stack), []))
        else:
            sections[-1][1].append(line)

    chunks: list[Chunk] = []
    for path, lines in sections:
        content = "\n".join(lines).strip()
        if not content:
            continue
        # partição de seções longas (mesmo heading_path)
        while len(content) > MAX_CHUNK_CHARS:
            cut = content.rfind("\n\n", 0, MAX_CHUNK_CHARS)
            cut = cut if cut > 0 else MAX_CHUNK_CHARS
            chunks.append(Chunk(heading_path=path, content=content[:cut].strip()))
            content = content[cut:].strip()
        chunks.append(Chunk(heading_path=path, content=content))
    return chunks


def validate_release(
    version: str, manifest: dict, files: dict[str, bytes]
) -> list[ParsedDoc]:
    """Valida manifest + checksums + front-matter e parseia todos os documentos.

    `files`: path relativo no pacote → bytes. Levanta ReleaseRejected com o
    relatório completo (não para no primeiro erro).
    """
    errors: list[str] = []

    if manifest.get("corpus_version") != version:
        errors.append(
            f"manifest.corpus_version={manifest.get('corpus_version')!r} "
            f"difere da versão publicada {version!r}"
        )
    entries = manifest.get("documents")
    if not isinstance(entries, list) or not entries:
        raise ReleaseRejected(version, errors + ["manifest sem lista de documents"])

    docs: list[ParsedDoc] = []
    seen_ids: set[str] = set()
    for entry in entries:
        path = entry.get("path", "?")
        raw = files.get(path)
        if raw is None:
            errors.append(f"{path}: listado no manifest mas ausente no pacote")
            continue
        if hashlib.sha256(raw).hexdigest() != entry.get("sha256"):
            errors.append(f"{path}: checksum sha256 não confere")
            continue
        try:
            post = frontmatter.loads(raw.decode("utf-8"))
        except Exception as exc:  # yaml inválido, encoding etc.
            errors.append(f"{path}: front-matter ilegível ({exc})")
            continue
        missing = REQUIRED_META - set(post.metadata)
        if missing:
            errors.append(f"{path}: front-matter incompleto — falta {sorted(missing)}")
            continue
        doc_id = str(post.metadata["id"])
        if doc_id in seen_ids:
            errors.append(f"{path}: doc_id duplicado na release ({doc_id})")
            continue
        seen_ids.add(doc_id)
        chunks = chunk_by_headings(post.content)
        if not chunks:
            errors.append(f"{path}: documento sem conteúdo após o front-matter")
            continue
        docs.append(
            ParsedDoc(
                doc_id=doc_id,
                title=str(post.metadata["title"]),
                doc_type=str(post.metadata["doc_type"]),
                domain=str(post.metadata["domain"]),
                front_matter={k: str(v) for k, v in post.metadata.items()},
                chunks=chunks,
            )
        )

    if errors:
        raise ReleaseRejected(version, errors)
    return docs
