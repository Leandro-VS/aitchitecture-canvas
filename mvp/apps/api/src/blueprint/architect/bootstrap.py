"""Bootstrap por linguagem natural em duas etapas (M13/D11).

1. prefill: descrição livre → IA pré-preenche o intake (campos marcados
   "inferido — revisar"); o usuário SEMPRE revisa/completa antes do passo 2.
2. sketch: intake validado + catálogo + RAG → ProposedDiff sobre canvas vazio
   (mesmo schema/validação do chat); auto-layout (dagre) acontece no front.
"""

from ..catalog import CATALOG
from ..llm import make_llm_client
from ..llm.parse import parse_with_retry
from ..schemas.intake import Intake
from .diff import ProposedDiff, truncate_sketch, validate_against_canvas

EMPTY_CANVAS: dict = {"nodes": [], "edges": []}

INTAKE_EXTRACTION_PROMPT = """Extraia da descrição livre do usuário os campos do
intake de um diagrama de arquitetura: summary (2–5 frases), functional_requirements
(lista), considerations (premissas/restrições), data_classification
(publica|interna|confidencial|restrita) e out_of_scope quando explícito.
Liste em inferred_fields exatamente os campos que você preencheu por inferência.
Responda APENAS com JSON no schema fornecido."""

SKETCH_PROMPT = """Você é um arquiteto de software. A partir do intake validado e
dos guidelines fornecidos, proponha um ESBOÇO inicial de arquitetura como um
ProposedDiff sobre um canvas vazio: add_node para cada componente (use apenas
arquétipos do catálogo) e connect com o intent correto. Máximo de {max_nodes}
componentes — esboço, não arquitetura final. Cite os guidelines que influenciaram
o desenho. Responda APENAS com JSON no schema fornecido."""


async def prefill_intake(free_text: str) -> Intake:
    intake = await parse_with_retry(
        Intake,
        make_llm_client(),
        [
            {"role": "system", "content": INTAKE_EXTRACTION_PROMPT},
            {"role": "user", "content": free_text},
        ],
        feature="bootstrap_intake",
    )
    if not intake.inferred_fields:  # fixture/LLM não marcou → tudo veio de inferência
        intake.inferred_fields = sorted(intake.model_fields_set - {"inferred_fields"})
    return intake


async def generate_sketch(intake: Intake, guidelines: list) -> ProposedDiff:
    catalog = ", ".join(sorted(item["archetype"] for item in CATALOG))
    guideline_text = "\n\n".join(f"[{h.citation}]\n{h.excerpt}" for h in guidelines)
    diff = await parse_with_retry(
        ProposedDiff,
        make_llm_client(),
        [
            {"role": "system", "content": SKETCH_PROMPT.format(max_nodes=25)},
            {
                "role": "user",
                "content": f"CATÁLOGO: {catalog}\n\nGUIDELINES:\n{guideline_text}\n\n"
                f"INTAKE:\n{intake.model_dump_json(indent=1)}",
            },
        ],
        feature="bootstrap_sketch",
    )
    diff = truncate_sketch(diff)
    return validate_against_canvas(diff, EMPTY_CANVAS)
