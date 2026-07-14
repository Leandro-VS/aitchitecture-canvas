import pytest
from pydantic import ValidationError

from blueprint.settings import Settings


def test_stub_auth_rejected_outside_local():
    with pytest.raises(ValidationError):
        Settings(env="pilot", auth_mode="stub")


def test_real_llm_provider_rejected_in_mvp():
    with pytest.raises(ValidationError):
        Settings(env="local", llm_provider="ollama")


def test_defaults_are_local_mock():
    s = Settings()
    assert s.env == "local"
    assert s.llm_provider == "mock"
