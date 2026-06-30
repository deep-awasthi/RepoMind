package com.repomind.model.neo4j;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import java.util.List;

@Node("Class")
public class ClassNode {

    @Id
    private String id; // Format: "class:{repoId}:{fullyQualifiedName}"
    private Long repoId;
    private String name;
    private String fullName;
    private String type; // CLASS or INTERFACE
    private List<String> annotations;

    public ClassNode() {
    }

    public ClassNode(String id, Long repoId, String name, String fullName, String type, List<String> annotations) {
        this.id = id;
        this.repoId = repoId;
        this.name = name;
        this.fullName = fullName;
        this.type = type;
        this.annotations = annotations;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Long getRepoId() { return repoId; }
    public void setRepoId(Long repoId) { this.repoId = repoId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public List<String> getAnnotations() { return annotations; }
    public void setAnnotations(List<String> annotations) { this.annotations = annotations; }
}
