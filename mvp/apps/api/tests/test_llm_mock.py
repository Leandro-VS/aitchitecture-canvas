import json

import pytest

from blueprint.llm.mock import MockLLMClient, pseudo_embedding


def test_pseudo_embedding_is_deterministic_and_normalized():
    a = pseudo_embedding("cache", dim=1024)
    b = pseudo_embedding("cache", dim=1024)
    assert a == b
    assert len(a) == 1024
    assert abs(sum(v * v for v in a) - 1.0) < 1e-6
    assert pseudo_embedding("outro texto", dim=1024) != a


async def test_chat_falls_back_to_default_fixture(tmp_path):
    (tmp_path / "judge-default.json").write_text(json.dumps({"content": "ok"}))
    client = MockLLMClient(fixtures_dir=tmp_path)
    result = await client.chat([{"role": "user", "content": "qualquer"}], feature="judge")
    assert result == {"content": "ok"}


async def test_chat_raises_on_missing_fixture(tmp_path):
    client = MockLLMClient(fixtures_dir=tmp_path)
    with pytest.raises(FileNotFoundError):
        await client.chat([{"role": "user", "content": "x"}], feature="inexistente")


async def test_embed_uses_settings_dim(tmp_path):
    client = MockLLMClient(fixtures_dir=tmp_path)
    vecs = await client.embed(["a", "b"], feature="ingest")
    assert len(vecs) == 2
    assert len(vecs[0]) == 1024
