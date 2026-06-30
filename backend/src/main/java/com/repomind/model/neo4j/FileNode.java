package com.repomind.model.neo4j;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

@Node("File")
public class FileNode {

    @Id
    private String id; // Format: "file:{repoId}:{relativePath}"
    private Long repoId;
    private String name;
    private String path;
    private String language;
    private Long size;
    private Boolean unreachable;

    public FileNode() {
    }

    public FileNode(String id, Long repoId, String name, String path, String language, Long size, Boolean unreachable) {
        this.id = id;
        this.repoId = repoId;
        this.name = name;
        this.path = path;
        this.language = language;
        this.size = size;
        this.unreachable = unreachable;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Long getRepoId() { return repoId; }
    public void setRepoId(Long repoId) { this.repoId = repoId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public Long getSize() { return size; }
    public void setSize(Long size) { this.size = size; }

    public Boolean getUnreachable() { return unreachable; }
    public void setUnreachable(Boolean unreachable) { this.unreachable = unreachable; }
}
