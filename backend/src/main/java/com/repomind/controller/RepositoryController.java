package com.repomind.controller;

import com.repomind.model.jpa.RepositoryEntity;
import com.repomind.repository.jpa.RepositoryJpaRepository;
import com.repomind.repository.neo4j.Neo4jGraphRepository;
import com.repomind.service.GitHotspotService;
import com.repomind.service.ParserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/repositories")
@CrossOrigin(origins = "*")
public class RepositoryController {

    private final RepositoryJpaRepository repositoryJpaRepository;
    private final Neo4jGraphRepository neo4jGraphRepository;
    private final ParserService parserService;
    private final GitHotspotService gitHotspotService;

    public RepositoryController(RepositoryJpaRepository repositoryJpaRepository,
                                Neo4jGraphRepository neo4jGraphRepository,
                                ParserService parserService,
                                GitHotspotService gitHotspotService) {
        this.repositoryJpaRepository = repositoryJpaRepository;
        this.neo4jGraphRepository = neo4jGraphRepository;
        this.parserService = parserService;
        this.gitHotspotService = gitHotspotService;
    }

    @PostMapping
    public ResponseEntity<RepositoryEntity> importRepository(@RequestBody Map<String, String> request) {
        String name = request.get("name");
        String url = request.get("url");
        String branch = request.getOrDefault("branch", "main");
        String token = request.get("token");

        if (name == null || name.trim().isEmpty() || url == null || url.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        RepositoryEntity repo = RepositoryEntity.builder()
                .name(name)
                .url(url)
                .branch(branch)
                .status("PENDING")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        RepositoryEntity savedRepo = repositoryJpaRepository.save(repo);
        parserService.parseRepositoryAsync(savedRepo.getId(), token);

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(savedRepo);
    }

    @PostMapping("/local")
    public ResponseEntity<RepositoryEntity> importLocalDirectory(@RequestBody Map<String, String> request) {
        String name = request.get("name");
        String path = request.get("path");

        if (name == null || name.trim().isEmpty() || path == null || path.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        File folder = new File(path);
        if (!folder.exists() || !folder.isDirectory()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);
        }

        RepositoryEntity repo = RepositoryEntity.builder()
                .name(name)
                .url("local")
                .clonePath(path)
                .status("PENDING")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        RepositoryEntity savedRepo = repositoryJpaRepository.save(repo);
        parserService.parseRepositoryAsync(savedRepo.getId(), null);

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(savedRepo);
    }

    @GetMapping
    public List<RepositoryEntity> listRepositories() {
        return repositoryJpaRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<RepositoryEntity> getRepository(@PathVariable Long id) {
        return repositoryJpaRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRepository(@PathVariable Long id) {
        Optional<RepositoryEntity> repoOpt = repositoryJpaRepository.findById(id);
        if (repoOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        RepositoryEntity repo = repoOpt.get();
        // Delete graph
        neo4jGraphRepository.deleteByRepoId(id);
        // Delete metadata
        repositoryJpaRepository.deleteById(id);
        
        // Delete clone dir if it's not a local imported dir
        if (repo.getClonePath() != null && !repo.getUrl().equals("local")) {
            File cloneDir = new File(repo.getClonePath());
            if (cloneDir.exists()) {
                deleteDirectory(cloneDir);
            }
        }

        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/status")
    public ResponseEntity<Map<String, Object>> getStatus(@PathVariable Long id) {
        return repositoryJpaRepository.findById(id)
                .map(repo -> {
                    Map<String, Object> res = new HashMap<>();
                    res.put("status", repo.getStatus());
                    res.put("errorMessage", repo.getErrorMessage());
                    return ResponseEntity.ok(res);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/graph")
    public ResponseEntity<Map<String, Object>> getGraph(
            @PathVariable Long id,
            @RequestParam(required = false) List<String> nodeTypes) {
        
        Optional<RepositoryEntity> repoOpt = repositoryJpaRepository.findById(id);
        if (repoOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        // Return empty graph if parsing hasn't completed
        RepositoryEntity repo = repoOpt.get();
        if (!"COMPLETED".equals(repo.getStatus())) {
            Map<String, Object> emptyGraph = new HashMap<>();
            emptyGraph.put("nodes", Collections.emptyList());
            emptyGraph.put("edges", Collections.emptyList());
            return ResponseEntity.ok(emptyGraph);
        }

        List<Map<String, Object>> nodes = neo4jGraphRepository.getNodes(id, nodeTypes);
        List<Map<String, Object>> edges = neo4jGraphRepository.getEdges(id, nodeTypes);

        Map<String, Object> graph = new HashMap<>();
        graph.put("nodes", nodes);
        graph.put("edges", edges);

        return ResponseEntity.ok(graph);
    }

    @GetMapping("/{id}/stats")
    public ResponseEntity<Map<String, Object>> getStats(@PathVariable Long id) {
        return repositoryJpaRepository.findById(id)
                .map(repo -> {
                    if (!"COMPLETED".equals(repo.getStatus())) {
                        return ResponseEntity.ok(Collections.<String, Object>emptyMap());
                    }
                    Map<String, Object> stats = neo4jGraphRepository.getRepositoryStats(id);
                    return ResponseEntity.ok(stats);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/code")
    public ResponseEntity<Map<String, String>> getCodeContent(
            @PathVariable Long id,
            @RequestParam String path) {
        
        Optional<RepositoryEntity> repoOpt = repositoryJpaRepository.findById(id);
        if (repoOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        RepositoryEntity repo = repoOpt.get();
        if (repo.getClonePath() == null) {
            return ResponseEntity.badRequest().build();
        }

        try {
            // Path traversal protection
            Path rootPath = Paths.get(repo.getClonePath()).toAbsolutePath().normalize();
            Path filePath = rootPath.resolve(path).toAbsolutePath().normalize();

            if (!filePath.startsWith(rootPath)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            File file = filePath.toFile();
            if (!file.exists() || file.isDirectory()) {
                return ResponseEntity.notFound().build();
            }

            String content = Files.readString(filePath, StandardCharsets.UTF_8);
            Map<String, String> res = new HashMap<>();
            res.put("content", content);
            res.put("language", getLanguageFromExtension(file.getName()));
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{id}/node-details")
    public ResponseEntity<Map<String, Object>> getNodeDetails(
            @PathVariable Long id,
            @RequestParam String nodeType,
            @RequestParam String nodeId,
            @RequestParam(required = false) String filePath) {
        
        Optional<RepositoryEntity> repoOpt = repositoryJpaRepository.findById(id);
        if (repoOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        RepositoryEntity repo = repoOpt.get();

        Map<String, Object> details = new HashMap<>();
        if (filePath != null && repo.getClonePath() != null) {
            File repoDir = new File(repo.getClonePath());
            details.put("gitHistory", gitHotspotService.getFileContributors(repoDir, filePath));
        }

        // Add cycles / dead code status specific to the nodes
        if ("Method".equalsIgnoreCase(nodeType)) {
            // We can look up method references or return default complexity
            details.put("complexity", "Medium");
        }

        return ResponseEntity.ok(details);
    }

    @GetMapping("/{id}/analysis")
    public ResponseEntity<Map<String, Object>> getAnalysisReport(@PathVariable Long id) {
        Optional<RepositoryEntity> repoOpt = repositoryJpaRepository.findById(id);
        if (repoOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        RepositoryEntity repo = repoOpt.get();
        if (!"COMPLETED".equals(repo.getStatus())) {
            return ResponseEntity.ok(Collections.emptyMap());
        }

        Map<String, Object> report = new HashMap<>();
        report.put("circularDependencies", neo4jGraphRepository.findCircularDependencies(id));
        report.put("deadCode", neo4jGraphRepository.getDeadCodeReport(id));

        // Get git hotspot modifications
        if (repo.getClonePath() != null) {
            File repoDir = new File(repo.getClonePath());
            report.put("hotspots", gitHotspotService.calculateModificationCounts(repoDir));
        }

        return ResponseEntity.ok(report);
    }

    private String getLanguageFromExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot == -1) return "plaintext";
        String ext = filename.substring(dot + 1).toLowerCase();
        return switch (ext) {
            case "java" -> "java";
            case "js", "jsx" -> "javascript";
            case "ts", "tsx" -> "typescript";
            case "json" -> "json";
            case "xml" -> "xml";
            case "yml", "yaml" -> "yaml";
            case "md" -> "markdown";
            default -> "plaintext";
        };
    }

    private void deleteDirectory(File dir) {
        File[] files = dir.listFiles();
        if (files != null) {
            for (File f : files) {
                if (f.isDirectory()) {
                    deleteDirectory(f);
                } else {
                    f.delete();
                }
            }
        }
        dir.delete();
    }
}
