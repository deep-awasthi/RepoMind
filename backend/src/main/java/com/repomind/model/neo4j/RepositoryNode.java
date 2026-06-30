package com.repomind.model.neo4j;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

@Node("Repository")
public class RepositoryNode {

    @Id
    private String id; // Format: "repo:{repoId}"
    private Long repoId;
    private String name;
    private String url;

    public RepositoryNode() {
    }

    public RepositoryNode(String id, Long repoId, String name, String url) {
        this.id = id;
        this.repoId = repoId;
        this.name = name;
        this.url = url;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Long getRepoId() { return repoId; }
    public void setRepoId(Long repoId) { this.repoId = repoId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
}
