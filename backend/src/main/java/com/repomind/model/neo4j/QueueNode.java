package com.repomind.model.neo4j;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

@Node("Queue")
public class QueueNode {

    @Id
    private String id; // Format: "queue:{repoId}:{topicOrQueueName}"
    private Long repoId;
    private String name;
    private String type; // KAFKA, RABBITMQ, SQS, REDIS

    public QueueNode() {
    }

    public QueueNode(String id, Long repoId, String name, String type) {
        this.id = id;
        this.repoId = repoId;
        this.name = name;
        this.type = type;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Long getRepoId() { return repoId; }
    public void setRepoId(Long repoId) { this.repoId = repoId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
}
