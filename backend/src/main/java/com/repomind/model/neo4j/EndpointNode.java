package com.repomind.model.neo4j;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

@Node("Endpoint")
public class EndpointNode {

    @Id
    private String id; // Format: "endpoint:{repoId}:{httpMethod}:{endpoint}"
    private Long repoId;
    private String method; // GET, POST, PUT, DELETE, etc.
    private String endpoint; // Request Mapping URI
    private String controllerName;

    public EndpointNode() {
    }

    public EndpointNode(String id, Long repoId, String method, String endpoint, String controllerName) {
        this.id = id;
        this.repoId = repoId;
        this.method = method;
        this.endpoint = endpoint;
        this.controllerName = controllerName;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Long getRepoId() { return repoId; }
    public void setRepoId(Long repoId) { this.repoId = repoId; }

    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }

    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }

    public String getControllerName() { return controllerName; }
    public void setControllerName(String controllerName) { this.controllerName = controllerName; }
}
