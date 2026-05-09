from __future__ import annotations


def write_payload_to_neo4j(
    *,
    payload: dict,
    uri: str,
    username: str,
    password: str,
    database: str = "neo4j",
) -> None:
    from neo4j import GraphDatabase

    driver = GraphDatabase.driver(uri, auth=(username, password))
    try:
        with driver.session(database=database) as session:
            session.run(
                """
                MERGE (scenario:Scenario {id: $scenarioId})
                SET scenario.name = $scenarioName,
                    scenario.agentName = $agentName,
                    scenario.shortageRiskLevel = $shortageRiskLevel
                """,
                scenarioId="scenario-root",
                scenarioName=payload.get("sandboxName"),
                agentName=payload.get("agentName"),
                shortageRiskLevel=payload.get("summary", {}).get("shortageRiskLevel"),
            )
            for node in payload.get("graph", {}).get("nodes", []):
                session.run(
                    """
                    MERGE (n:SandboxNode {id: $id})
                    SET n.label = $label,
                        n.type = $type,
                        n.riskLevel = $riskLevel
                    """,
                    id=node.get("id"),
                    label=node.get("label"),
                    type=node.get("type"),
                    riskLevel=node.get("riskLevel"),
                )
            for edge in payload.get("graph", {}).get("edges", []):
                session.run(
                    """
                    MATCH (source:SandboxNode {id: $source})
                    MATCH (target:SandboxNode {id: $target})
                    MERGE (source)-[r:SANDBOX_EDGE {label: $label}]->(target)
                    """,
                    source=edge.get("source"),
                    target=edge.get("target"),
                    label=edge.get("label"),
                )
    finally:
        driver.close()
