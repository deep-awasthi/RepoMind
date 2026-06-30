package com.repomind.repository.neo4j;

import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Repository
public class Neo4jGraphRepository {

    private final Neo4jClient neo4jClient;

    public Neo4jGraphRepository(Neo4jClient neo4jClient) {
        this.neo4jClient = neo4jClient;
    }

    @Transactional
    public void deleteByRepoId(Long repoId) {
        neo4jClient.query("MATCH (n) WHERE n.repoId = $repoId DETACH DELETE n")
                .bind(repoId).to("repoId")
                .run();
    }

    @Transactional
    public void mergeRepository(String id, Long repoId, String name, String url) {
        neo4jClient.query(
                "MERGE (n:Repository {id: $id}) " +
                "SET n.repoId = $repoId, n.name = $name, n.url = $url"
        )
        .bind(id).to("id")
        .bind(repoId).to("repoId")
        .bind(name).to("name")
        .bind(url).to("url")
        .run();
    }

    @Transactional
    public void mergeFile(String id, Long repoId, String name, String path, String language, Long size) {
        neo4jClient.query(
                "MERGE (n:File {id: $id}) " +
                "SET n.repoId = $repoId, n.name = $name, n.path = $path, n.language = $language, n.size = $size, n.unreachable = false"
        )
        .bind(id).to("id")
        .bind(repoId).to("repoId")
        .bind(name).to("name")
        .bind(path).to("path")
        .bind(language).to("language")
        .bind(size).to("size")
        .run();
    }

    @Transactional
    public void mergeClass(String id, Long repoId, String name, String fullName, String type, List<String> annotations) {
        neo4jClient.query(
                "MERGE (n:Class {id: $id}) " +
                "SET n.repoId = $repoId, n.name = $name, n.fullName = $fullName, n.type = $type, n.annotations = $annotations"
        )
        .bind(id).to("id")
        .bind(repoId).to("repoId")
        .bind(name).to("name")
        .bind(fullName).to("fullName")
        .bind(type).to("type")
        .bind(annotations).to("annotations")
        .run();
    }

    @Transactional
    public void mergeMethod(String id, Long repoId, String name, String fullName, String returnType, List<String> parameters, List<String> annotations) {
        neo4jClient.query(
                "MERGE (n:Method {id: $id}) " +
                "SET n.repoId = $repoId, n.name = $name, n.fullName = $fullName, n.returnType = $returnType, n.parameters = $parameters, n.annotations = $annotations, n.unreachable = false"
        )
        .bind(id).to("id")
        .bind(repoId).to("repoId")
        .bind(name).to("name")
        .bind(fullName).to("fullName")
        .bind(returnType).to("returnType")
        .bind(parameters).to("parameters")
        .bind(annotations).to("annotations")
        .run();
    }

    @Transactional
    public void mergeEndpoint(String id, Long repoId, String method, String endpoint, String controllerName) {
        neo4jClient.query(
                "MERGE (n:Endpoint {id: $id}) " +
                "SET n.repoId = $repoId, n.method = $method, n.endpoint = $endpoint, n.controllerName = $controllerName"
        )
        .bind(id).to("id")
        .bind(repoId).to("repoId")
        .bind(method).to("method")
        .bind(endpoint).to("endpoint")
        .bind(controllerName).to("controllerName")
        .run();
    }

    @Transactional
    public void mergeDatabase(String id, Long repoId, String name, String type) {
        neo4jClient.query(
                "MERGE (n:Database {id: $id}) " +
                "SET n.repoId = $repoId, n.name = $name, n.type = $type"
        )
        .bind(id).to("id")
        .bind(repoId).to("repoId")
        .bind(name).to("name")
        .bind(type).to("type")
        .run();
    }

    @Transactional
    public void mergeQueue(String id, Long repoId, String name, String type) {
        neo4jClient.query(
                "MERGE (n:Queue {id: $id}) " +
                "SET n.repoId = $repoId, n.name = $name, n.type = $type"
        )
        .bind(id).to("id")
        .bind(repoId).to("repoId")
        .bind(name).to("name")
        .bind(type).to("type")
        .run();
    }

    @Transactional
    public void createRelationship(String sourceId, String targetId, String relType) {
        // Formulate a dynamic relationship type query securely using string formatting for the relation label only.
        // Neo4j Cypher parameters don't allow parameterizing relationship types directly.
        String query = String.format(
                "MATCH (a) WHERE a.id = $sourceId " +
                "MATCH (b) WHERE b.id = $targetId " +
                "MERGE (a)-[r:%s]->(b)", relType);
        
        neo4jClient.query(query)
                .bind(sourceId).to("sourceId")
                .bind(targetId).to("targetId")
                .run();
    }

    public List<Map<String, Object>> getNodes(Long repoId, List<String> nodeTypes) {
        String query = "MATCH (n) WHERE n.repoId = $repoId ";
        if (nodeTypes != null && !nodeTypes.isEmpty()) {
            query += "AND labels(n)[0] IN $nodeTypes ";
        }
        query += "RETURN n, labels(n)[0] as label";

        var spec = neo4jClient.query(query).bind(repoId).to("repoId");
        if (nodeTypes != null && !nodeTypes.isEmpty()) {
            spec = spec.bind(nodeTypes).to("nodeTypes");
        }

        return new ArrayList<>(spec.fetch().all().stream().map(record -> {
            Map<String, Object> node = new HashMap<>();
            Object nVal = record.get("n");
            Map<String, Object> properties;
            if (nVal instanceof org.neo4j.driver.types.Node nodeVal) {
                properties = nodeVal.asMap();
            } else if (nVal instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> mapVal = (Map<String, Object>) nVal;
                properties = mapVal;
            } else {
                properties = Collections.emptyMap();
            }
            node.put("id", properties.get("id"));
            node.put("label", record.get("label"));
            node.put("properties", properties);
            return node;
        }).toList());
    }

    public List<Map<String, Object>> getEdges(Long repoId, List<String> nodeTypes) {
        String query = "MATCH (n)-[r]->(m) WHERE n.repoId = $repoId AND m.repoId = $repoId ";
        if (nodeTypes != null && !nodeTypes.isEmpty()) {
            query += "AND labels(n)[0] IN $nodeTypes AND labels(m)[0] IN $nodeTypes ";
        }
        query += "RETURN n.id as source, m.id as target, type(r) as type";

        var spec = neo4jClient.query(query).bind(repoId).to("repoId");
        if (nodeTypes != null && !nodeTypes.isEmpty()) {
            spec = spec.bind(nodeTypes).to("nodeTypes");
        }

        return new ArrayList<>(spec.fetch().all());
    }

    @Transactional
    public List<Map<String, Object>> findCircularDependencies(Long repoId) {
        // Detects circular imports or file dependencies
        String cypher = "MATCH path = (n:File)-[:IMPORTS*2..6]->(n) " +
                       "WHERE n.repoId = $repoId " +
                       "RETURN [node in nodes(path) | node.id] as cycle, length(path) as length";
        
        return new ArrayList<>(neo4jClient.query(cypher)
                .bind(repoId).to("repoId")
                .fetch().all());
    }

    @Transactional
    public void markUnreachableMethods(Long repoId) {
        // Reset all methods to unreachable = true
        neo4jClient.query("MATCH (m:Method) WHERE m.repoId = $repoId SET m.unreachable = true").bind(repoId).to("repoId").run();

        // Mark methods reachable from main or endpoints/listeners as unreachable = false
        // Let's find nodes that have annotations for APIs or "main" methods
        String findEntryPointsCypher = 
                "MATCH (m:Method) WHERE m.repoId = $repoId AND (" +
                "  m.name = 'main' OR " +
                "  any(ann IN m.annotations WHERE ann CONTAINS 'Mapping' OR ann CONTAINS 'Listener' OR ann CONTAINS 'Scheduled') " +
                ") RETURN m.id as id";
        
        Collection<Map<String, Object>> entryPoints = neo4jClient.query(findEntryPointsCypher)
                .bind(repoId).to("repoId")
                .fetch().all();

        if (entryPoints.isEmpty()) {
            // Fallback: If no entry points found, don't flag everything.
            // Mark all reachable from public controller methods
            neo4jClient.query("MATCH (m:Method) WHERE m.repoId = $repoId SET m.unreachable = false").bind(repoId).to("repoId").run();
            return;
        }

        List<String> entryPointIds = entryPoints.stream().map(m -> (String) m.get("id")).toList();

        // Perform reachability update: MATCH (entry)-[:CALLS*0..10]->(reachable:Method) SET reachable.unreachable = false
        String reachabilityCypher = 
                "MATCH (entry:Method) WHERE entry.id IN $entryIds " +
                "MATCH (entry)-[:CALLS*0..8]->(reachable:Method) " +
                "SET reachable.unreachable = false";
        
        neo4jClient.query(reachabilityCypher)
                .bind(entryPointIds).to("entryIds")
                .run();
    }

    public List<Map<String, Object>> getDeadCodeReport(Long repoId) {
        String cypher = "MATCH (m:Method) WHERE m.repoId = $repoId AND m.unreachable = true " +
                        "RETURN m.id as id, m.name as name, m.fullName as fullName";
        return new ArrayList<>(neo4jClient.query(cypher)
                .bind(repoId).to("repoId")
                .fetch().all());
    }

    public Map<String, Object> getRepositoryStats(Long repoId) {
        String cypher = "MATCH (n) WHERE n.repoId = $repoId " +
                        "RETURN labels(n)[0] as type, count(n) as count";
        Collection<Map<String, Object>> counts = neo4jClient.query(cypher)
                .bind(repoId).to("repoId")
                .fetch().all();

        Map<String, Object> stats = new HashMap<>();
        long totalNodes = 0;
        for (var row : counts) {
            String type = (String) row.get("type");
            long count = (long) row.get("count");
            stats.put(type.toLowerCase() + "Count", count);
            totalNodes += count;
        }
        stats.put("totalNodes", totalNodes);

        // Get edge count
        String edgeCypher = "MATCH (n)-[r]->(m) WHERE n.repoId = $repoId AND m.repoId = $repoId RETURN count(r) as count";
        Long edgeCount = neo4jClient.query(edgeCypher).bind(repoId).to("repoId").fetch().one().map(r -> (Long) r.get("count")).orElse(0L);
        stats.put("relationshipCount", edgeCount);

        // Get circular dependencies count
        List<Map<String, Object>> cycles = findCircularDependencies(repoId);
        stats.put("circularDependenciesCount", cycles.size());

        // Get dead code count
        String deadCypher = "MATCH (m:Method) WHERE m.repoId = $repoId AND m.unreachable = true RETURN count(m) as count";
        Long deadCount = neo4jClient.query(deadCypher).bind(repoId).to("repoId").fetch().one().map(r -> (Long) r.get("count")).orElse(0L);
        stats.put("deadCodeCount", deadCount);

        return stats;
    }
}
