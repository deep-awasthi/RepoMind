package com.repomind.model.neo4j;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import java.util.List;

@Node("Method")
public class MethodNode {

    @Id
    private String id; // Format: "method:{repoId}:{classFullName}:{methodName}(params)"
    private Long repoId;
    private String name;
    private String fullName;
    private String returnType;
    private List<String> parameters;
    private List<String> annotations;
    private Boolean unreachable;

    public MethodNode() {
    }

    public MethodNode(String id, Long repoId, String name, String fullName, String returnType, List<String> parameters, List<String> annotations, Boolean unreachable) {
        this.id = id;
        this.repoId = repoId;
        this.name = name;
        this.fullName = fullName;
        this.returnType = returnType;
        this.parameters = parameters;
        this.annotations = annotations;
        this.unreachable = unreachable;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Long getRepoId() { return repoId; }
    public void setRepoId(Long repoId) { this.repoId = repoId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getReturnType() { return returnType; }
    public void setReturnType(String returnType) { this.returnType = returnType; }

    public List<String> getParameters() { return parameters; }
    public void setParameters(List<String> parameters) { this.parameters = parameters; }

    public List<String> getAnnotations() { return annotations; }
    public void setAnnotations(List<String> annotations) { this.annotations = annotations; }

    public Boolean getUnreachable() { return unreachable; }
    public void setUnreachable(Boolean unreachable) { this.unreachable = unreachable; }
}
