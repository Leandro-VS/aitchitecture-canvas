from blueprint.exports.mermaid import render_mermaid


def test_mermaid_escapes_labels_and_ignores_ghosts_and_dangling_edges():
    canvas = {
        "nodes": [
            {
                "id": "client:1",
                "type": "arch",
                "data": {
                    "name": 'Cliente "VIP"',
                    "label": "Client <Web>",
                    "subtitle": "entrada & saída",
                },
            },
            {
                "id": "app",
                "type": "arch",
                "data": {
                    "name": "App\nServer",
                    "label": "App Server",
                    "capacityManagedExternally": True,
                },
            },
            {
                "id": "ghost",
                "type": "arch",
                "data": {"name": "Sugestão", "ghost": True},
            },
        ],
        "edges": [
            {
                "source": "client:1",
                "target": "app",
                "data": {"intent": 'request "sync"'},
            },
            {"source": "app", "target": "ghost", "data": {"intent": "ai_call"}},
            {"source": "missing", "target": "app"},
        ],
    }

    mermaid = render_mermaid(canvas)

    assert (
        'n0["Cliente &quot;VIP&quot;<br/>Client &lt;Web&gt;<br/>'
        'entrada &amp; saída"]' in mermaid
    )
    assert 'n1["App<br/>Server<br/>App Server<br/>Fora da simulação"]' in mermaid
    assert 'n0 -->|"request &quot;sync&quot;"| n1' in mermaid
    assert "Sugestão" not in mermaid
    assert "ai_call" not in mermaid
    assert "missing" not in mermaid


def test_empty_canvas_is_valid_mermaid_source():
    assert render_mermaid(None) == "flowchart LR\n  %% Diagrama vazio\n"
