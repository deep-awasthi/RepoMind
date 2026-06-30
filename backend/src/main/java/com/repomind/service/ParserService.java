package com.repomind.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.repomind.model.jpa.RepositoryEntity;
import com.repomind.parser.JavaCodeParser;
import com.repomind.repository.jpa.RepositoryJpaRepository;
import com.repomind.repository.neo4j.Neo4jGraphRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
public class ParserService {

    private final RepositoryJpaRepository repositoryJpaRepository;
    private final Neo4jGraphRepository neo4jGraphRepository;
    private final GitCloneService gitCloneService;
    private final JavaCodeParser javaCodeParser;
    private final ResourceLoader resourceLoader;
    private final ObjectMapper objectMapper;

    @Value("${repomind.clone-dir:backend/clones}")
    private String cloneBaseDir;

    public ParserService(RepositoryJpaRepository repositoryJpaRepository,
                         Neo4jGraphRepository neo4jGraphRepository,
                         GitCloneService gitCloneService,
                         JavaCodeParser javaCodeParser,
                         ResourceLoader resourceLoader,
                         ObjectMapper objectMapper) {
        this.repositoryJpaRepository = repositoryJpaRepository;
        this.neo4jGraphRepository = neo4jGraphRepository;
        this.gitCloneService = gitCloneService;
        this.javaCodeParser = javaCodeParser;
        this.resourceLoader = resourceLoader;
        this.objectMapper = objectMapper;
    }

    @Async
    public CompletableFuture<Void> parseRepositoryAsync(Long repoId, String token) {
        Optional<RepositoryEntity> repoOpt = repositoryJpaRepository.findById(repoId);
        if (repoOpt.isEmpty()) {
            return CompletableFuture.completedFuture(null);
        }

        RepositoryEntity repo = repoOpt.get();
        repo.setStatus("CLONING");
        repositoryJpaRepository.save(repo);

        File cloneDir = null;
        try {
            // Step 1: Clone Repository
            if (repo.getUrl().startsWith("http://") || repo.getUrl().startsWith("https://") || repo.getUrl().startsWith("git@")) {
                cloneDir = gitCloneService.cloneRepository(repo.getUrl(), token, repo.getBranch());
            } else if (repo.getUrl().equals("local")) {
                cloneDir = new File(repo.getClonePath());
            } else {
                throw new IllegalArgumentException("Unsupported repository import URL: " + repo.getUrl());
            }

            repo.setClonePath(cloneDir.getAbsolutePath());
            repo.setStatus("PARSING");
            repositoryJpaRepository.save(repo);

            // Step 2: Parse and build graph
            parseAndBuildGraph(repoId, cloneDir);

            repo.setStatus("COMPLETED");
            repo.setErrorMessage(null);
        } catch (Exception e) {
            repo.setStatus("FAILED");
            repo.setErrorMessage(e.getMessage() != null ? e.getMessage() : e.toString());
            // Cleanup clone directory on failure if we created it
            if (cloneDir != null && !repo.getUrl().equals("local")) {
                gitCloneService.deleteDirectory(cloneDir);
            }
        } finally {
            repo.setUpdatedAt(LocalDateTime.now());
            repositoryJpaRepository.save(repo);
        }

        return CompletableFuture.completedFuture(null);
    }

    public void parseAndBuildGraph(Long repoId, File repoDir) throws Exception {
        // Clear existing graph nodes for this repo
        neo4jGraphRepository.deleteByRepoId(repoId);

        // Create Repository Node
        String repoNodeId = "repo:" + repoId;
        neo4jGraphRepository.mergeRepository(repoNodeId, repoId, repoDir.getName(), repoNodeId);

        // Walk directories and collect file nodes
        List<JavaCodeParser.ParsedFile> parsedJavaFiles = new ArrayList<>();
        List<File> javaFiles = new ArrayList<>();
        findJavaFiles(repoDir, javaFiles);

        // 1. Parse Java Files
        for (File f : javaFiles) {
            JavaCodeParser.ParsedFile pf = javaCodeParser.parseJavaFile(f, repoDir);
            parsedJavaFiles.add(pf);

            // Merge File Node
            String fileNodeId = "file:" + repoId + ":" + pf.path;
            neo4jGraphRepository.mergeFile(fileNodeId, repoId, pf.name, pf.path, "Java", pf.size);
            neo4jGraphRepository.createRelationship(repoNodeId, fileNodeId, "CONTAINS");

            // Merge Class/Interface Nodes
            for (JavaCodeParser.ParsedClass pc : pf.classes) {
                String classNodeId = "class:" + repoId + ":" + pc.fullName;
                neo4jGraphRepository.mergeClass(classNodeId, repoId, pc.name, pc.fullName, pc.type, pc.annotations);
                neo4jGraphRepository.createRelationship(fileNodeId, classNodeId, "DECLARES");

                // Check Spring annotations
                detectSpringComponents(repoId, pc, classNodeId);

                // Merge Methods
                for (JavaCodeParser.ParsedMethod pm : pc.methods) {
                    String methodNodeId = "method:" + repoId + ":" + pc.fullName + ":" + pm.name;
                    neo4jGraphRepository.mergeMethod(methodNodeId, repoId, pm.name, pm.fullName, pm.returnType, pm.parameters, pm.annotations);
                    neo4jGraphRepository.createRelationship(classNodeId, methodNodeId, "DECLARES");

                    // Detect endpoint mapping annotations
                    detectSpringEndpoints(repoId, pc, pm, methodNodeId, classNodeId);
                }
            }
        }

        // 2. Parse JS/TS Files (if node is installed)
        List<JsonNode> parsedTsFiles = parseTsJsFiles(repoDir);
        for (JsonNode f : parsedTsFiles) {
            String path = f.get("path").asText();
            String name = f.get("name").asText();
            String lang = f.get("language").asText();
            long size = f.get("size").asLong();

            String fileNodeId = "file:" + repoId + ":" + path;
            neo4jGraphRepository.mergeFile(fileNodeId, repoId, name, path, lang, size);
            neo4jGraphRepository.createRelationship(repoNodeId, fileNodeId, "CONTAINS");

            // Classes
            if (f.has("classes")) {
                for (JsonNode c : f.get("classes")) {
                    String className = c.get("name").asText();
                    String classNodeId = "class:" + repoId + ":" + className;
                    
                    List<String> annotations = new ArrayList<>();
                    if (c.has("annotations")) {
                        c.get("annotations").forEach(a -> annotations.add(a.asText()));
                    }

                    neo4jGraphRepository.mergeClass(classNodeId, repoId, className, className, "CLASS", annotations);
                    neo4jGraphRepository.createRelationship(fileNodeId, classNodeId, "DECLARES");

                    // Methods
                    if (c.has("methods")) {
                        for (JsonNode m : c.get("methods")) {
                            String methodName = m.get("name").asText();
                            String methodNodeId = "method:" + repoId + ":" + className + ":" + methodName;
                            List<String> params = new ArrayList<>();
                            m.get("parameters").forEach(p -> params.add(p.asText()));
                            List<String> mAnns = new ArrayList<>();
                            m.get("annotations").forEach(a -> mAnns.add(a.asText()));

                            neo4jGraphRepository.mergeMethod(methodNodeId, repoId, methodName, className + "." + methodName, m.get("returnType").asText(), params, mAnns);
                            neo4jGraphRepository.createRelationship(classNodeId, methodNodeId, "DECLARES");
                        }
                    }
                }
            }

            // Endpoints
            if (f.has("endpoints")) {
                for (JsonNode ep : f.get("endpoints")) {
                    String method = ep.get("method").asText();
                    String route = ep.get("endpoint").asText();
                    String ctrl = ep.get("controllerName").asText();
                    String endpointNodeId = "endpoint:" + repoId + ":" + method + ":" + route;

                    neo4jGraphRepository.mergeEndpoint(endpointNodeId, repoId, method, route, ctrl);
                    neo4jGraphRepository.createRelationship("file:" + repoId + ":" + path, endpointNodeId, "EXPOSES");
                }
            }
        }

        // 3. Resolve Relationships
        // A: Resolve IMPORTS
        // Java Imports
        for (JavaCodeParser.ParsedFile pf : parsedJavaFiles) {
            String fileNodeId = "file:" + repoId + ":" + pf.path;
            for (String imp : pf.imports) {
                // Find file path that contains this imported class fully qualified package
                Optional<JavaCodeParser.ParsedFile> importedFile = parsedJavaFiles.stream()
                        .filter(f -> f.classes.stream().anyMatch(c -> c.fullName.equals(imp) || imp.startsWith(c.fullName)))
                        .findFirst();
                if (importedFile.isPresent()) {
                    String targetFileNodeId = "file:" + repoId + ":" + importedFile.get().path;
                    neo4jGraphRepository.createRelationship(fileNodeId, targetFileNodeId, "IMPORTS");
                }
            }
        }

        // JS/TS Imports
        for (JsonNode f : parsedTsFiles) {
            String path = f.get("path").asText();
            String fileNodeId = "file:" + repoId + ":" + path;
            if (f.has("imports")) {
                for (JsonNode imp : f.get("imports")) {
                    String source = imp.get("source").asText();
                    // Resolve relative import path e.g. ./components/Button relative to path
                    String targetPath = resolveRelativePath(path, source);
                    if (targetPath != null) {
                        // Find matching file
                        boolean fileExists = parsedTsFiles.stream().anyMatch(tf -> tf.get("path").asText().startsWith(targetPath));
                        if (fileExists) {
                            String targetFileNodeId = "file:" + repoId + ":" + targetPath;
                            neo4jGraphRepository.createRelationship(fileNodeId, targetFileNodeId, "IMPORTS");
                        }
                    }
                }
            }
        }

        // B: Resolve Class Heritage (EXTENDS / IMPLEMENTS)
        for (JavaCodeParser.ParsedFile pf : parsedJavaFiles) {
            for (JavaCodeParser.ParsedClass pc : pf.classes) {
                String classNodeId = "class:" + repoId + ":" + pc.fullName;
                
                if (pc.extendsClass != null) {
                    // Resolve extends class
                    resolveClassRef(pc.extendsClass, pf.imports, pf.packageName, parsedJavaFiles)
                            .ifPresent(targetFullName -> neo4jGraphRepository.createRelationship(
                                    classNodeId, "class:" + repoId + ":" + targetFullName, "EXTENDS"));
                }

                for (String itf : pc.implementsInterfaces) {
                    resolveClassRef(itf, pf.imports, pf.packageName, parsedJavaFiles)
                            .ifPresent(targetFullName -> neo4jGraphRepository.createRelationship(
                                    classNodeId, "class:" + repoId + ":" + targetFullName, "IMPLEMENTS"));
                }
            }
        }

        // C: Resolve Method CALLS
        for (JavaCodeParser.ParsedFile pf : parsedJavaFiles) {
            for (JavaCodeParser.ParsedClass pc : pf.classes) {
                for (JavaCodeParser.ParsedMethod pm : pc.methods) {
                    String methodNodeId = "method:" + repoId + ":" + pc.fullName + ":" + pm.name;

                    for (String call : pm.calls) {
                        if (call.startsWith("kafkaTemplate.send:")) {
                            String topic = call.substring("kafkaTemplate.send:".length());
                            String qNodeId = "queue:" + repoId + ":" + topic;
                            neo4jGraphRepository.mergeQueue(qNodeId, repoId, topic, "KAFKA");
                            neo4jGraphRepository.createRelationship(methodNodeId, qNodeId, "PUBLISHES");
                        } else if (!call.contains(".")) {
                            // Self-call or method in the same class
                            boolean exists = pc.methods.stream().anyMatch(m -> m.name.equals(call));
                            if (exists) {
                                String targetMethodNodeId = "method:" + repoId + ":" + pc.fullName + ":" + call;
                                neo4jGraphRepository.createRelationship(methodNodeId, targetMethodNodeId, "CALLS");
                            }
                        } else {
                            // Scope call: e.g. "productService.createProduct"
                            int idx = call.indexOf('.');
                            String scope = call.substring(0, idx);
                            String targetMethodName = call.substring(idx + 1);

                            // Resolve scope to class name by scanning field variables
                            Optional<JavaCodeParser.ParsedField> field = pc.fields.stream()
                                    .filter(f -> f.name.equals(scope))
                                    .findFirst();

                            if (field.isPresent()) {
                                String fieldType = field.get().type;
                                resolveClassRef(fieldType, pf.imports, pf.packageName, parsedJavaFiles)
                                        .ifPresent(targetClassFullName -> {
                                            String targetMethodNodeId = "method:" + repoId + ":" + targetClassFullName + ":" + targetMethodName;
                                            neo4jGraphRepository.createRelationship(methodNodeId, targetMethodNodeId, "CALLS");
                                        });
                            }
                        }
                    }
                }
            }
        }

        // D: Resolve Spring Dependency Injections (INJECTS)
        for (JavaCodeParser.ParsedFile pf : parsedJavaFiles) {
            for (JavaCodeParser.ParsedClass pc : pf.classes) {
                String classNodeId = "class:" + repoId + ":" + pc.fullName;
                for (JavaCodeParser.ParsedField field : pc.fields) {
                    resolveClassRef(field.type, pf.imports, pf.packageName, parsedJavaFiles).ifPresent(targetClassFullName -> {
                        // Check if target is a Spring Component (annotated)
                        boolean isComponent = parsedJavaFiles.stream()
                                .flatMap(f -> f.classes.stream())
                                .filter(c -> c.fullName.equals(targetClassFullName))
                                .anyMatch(c -> c.annotations.stream().anyMatch(ann -> 
                                        ann.equals("Service") || ann.equals("Repository") || 
                                        ann.equals("Component") || ann.equals("RestController") || 
                                        ann.equals("Controller")));
                        
                        if (isComponent) {
                            String targetClassNodeId = "class:" + repoId + ":" + targetClassFullName;
                            neo4jGraphRepository.createRelationship(targetClassNodeId, classNodeId, "INJECTS");
                        }
                    });
                }
            }
        }

        // 4. Run reachability analysis (unreachable code flagging)
        neo4jGraphRepository.markUnreachableMethods(repoId);
    }

    private void detectSpringComponents(Long repoId, JavaCodeParser.ParsedClass pc, String classNodeId) {
        for (String ann : pc.annotations) {
            if (ann.startsWith("Repository") || pc.name.endsWith("Repository") || pc.name.endsWith("Repo")) {
                String dbNodeId = "db:" + repoId + ":" + pc.name;
                neo4jGraphRepository.mergeDatabase(dbNodeId, repoId, pc.name, "JPA");
                neo4jGraphRepository.createRelationship(classNodeId, dbNodeId, "INTERACTS_WITH");
                break;
            }
            if (ann.startsWith("KafkaListener") || ann.contains("KafkaListener")) {
                String topic = "kafka-topic";
                if (ann.contains("topics")) {
                    int start = ann.indexOf("topics");
                    start = ann.indexOf("\"", start);
                    if (start != -1) {
                        int end = ann.indexOf("\"", start + 1);
                        if (end != -1) {
                            topic = ann.substring(start + 1, end);
                        }
                    }
                }
                String qNodeId = "queue:" + repoId + ":" + topic;
                neo4jGraphRepository.mergeQueue(qNodeId, repoId, topic, "KAFKA");
                neo4jGraphRepository.createRelationship(classNodeId, qNodeId, "SUBSCRIBES");
            }
        }
    }

    private void detectSpringEndpoints(Long repoId, JavaCodeParser.ParsedClass pc, JavaCodeParser.ParsedMethod pm, String methodNodeId, String classNodeId) {
        String baseMapping = "";
        for (String ann : pc.annotations) {
            if (ann.startsWith("RequestMapping")) {
                baseMapping = extractRouteFromAnnotation(ann);
            }
        }

        for (String ann : pm.annotations) {
            if (ann.startsWith("KafkaListener") || ann.contains("KafkaListener")) {
                String topic = "kafka-topic";
                if (ann.contains("topics")) {
                    int start = ann.indexOf("topics");
                    start = ann.indexOf("\"", start);
                    if (start != -1) {
                        int end = ann.indexOf("\"", start + 1);
                        if (end != -1) {
                            topic = ann.substring(start + 1, end);
                        }
                    }
                }
                String qNodeId = "queue:" + repoId + ":" + topic;
                neo4jGraphRepository.mergeQueue(qNodeId, repoId, topic, "KAFKA");
                neo4jGraphRepository.createRelationship(methodNodeId, qNodeId, "SUBSCRIBES");
            }

            String method = null;
            String route = "";
            if (ann.startsWith("GetMapping")) {
                method = "GET";
                route = extractRouteFromAnnotation(ann);
            } else if (ann.startsWith("PostMapping")) {
                method = "POST";
                route = extractRouteFromAnnotation(ann);
            } else if (ann.startsWith("PutMapping")) {
                method = "PUT";
                route = extractRouteFromAnnotation(ann);
            } else if (ann.startsWith("DeleteMapping")) {
                method = "DELETE";
                route = extractRouteFromAnnotation(ann);
            } else if (ann.startsWith("RequestMapping")) {
                method = "REQUEST";
                route = extractRouteFromAnnotation(ann);
            }

            if (method != null) {
                String fullRoute = baseMapping + route;
                if (!fullRoute.startsWith("/")) fullRoute = "/" + fullRoute;
                fullRoute = fullRoute.replaceAll("//+", "/");

                String epNodeId = "endpoint:" + repoId + ":" + method + ":" + fullRoute;
                neo4jGraphRepository.mergeEndpoint(epNodeId, repoId, method, fullRoute, pc.name);
                neo4jGraphRepository.createRelationship(classNodeId, epNodeId, "EXPOSES");
                neo4jGraphRepository.createRelationship(epNodeId, methodNodeId, "CALLS");
            }
        }
    }

    private String extractRouteFromAnnotation(String annotation) {
        if (!annotation.contains("(")) return "";
        int start = annotation.indexOf('(');
        int end = annotation.lastIndexOf(')');
        String val = annotation.substring(start + 1, end).trim();
        // Remove value = or path =
        if (val.contains("value")) {
            val = val.substring(val.indexOf("value") + 5);
            val = val.substring(val.indexOf("=") + 1).trim();
        } else if (val.contains("path")) {
            val = val.substring(val.indexOf("path") + 4);
            val = val.substring(val.indexOf("=") + 1).trim();
        }
        // Remove braces and quotes
        val = val.replace("{", "").replace("}", "").replace("\"", "").trim();
        return val;
    }

    private Optional<String> resolveClassRef(String className, List<String> imports, String currentPackage, List<JavaCodeParser.ParsedFile> parsedFiles) {
        // 1. Check if name is already fully qualified
        if (className.contains(".")) {
            return Optional.of(className);
        }
        
        // 2. Check imports matching the class name
        for (String imp : imports) {
            if (imp.endsWith("." + className)) {
                return Optional.of(imp);
            }
        }

        // 3. Check same package
        String samePackageClass = currentPackage.isEmpty() ? className : currentPackage + "." + className;
        boolean existsInSamePackage = parsedFiles.stream()
                .flatMap(f -> f.classes.stream())
                .anyMatch(c -> c.fullName.equals(samePackageClass));
        if (existsInSamePackage) {
            return Optional.of(samePackageClass);
        }

        // 4. Return class if it matches any class name in project (fallback heuristic)
        return parsedFiles.stream()
                .flatMap(f -> f.classes.stream())
                .filter(c -> c.name.equals(className))
                .map(c -> c.fullName)
                .findFirst();
    }

    private void findJavaFiles(File dir, List<File> javaFiles) {
        File[] files = dir.listFiles();
        if (files != null) {
            for (File f : files) {
                if (f.isDirectory()) {
                    if (!f.getName().equals(".git") && !f.getName().equals("node_modules") && !f.getName().equals("target")) {
                        findJavaFiles(f, javaFiles);
                    }
                } else if (f.getName().endsWith(".java")) {
                    javaFiles.add(f);
                }
            }
        }
    }

    private List<JsonNode> parseTsJsFiles(File repoDir) {
        List<JsonNode> parsedFiles = new ArrayList<>();
        try {
            // Setup NodeJS ts-parser execution directory
            Path toolDir = Paths.get(cloneBaseDir, "parser-tool");
            Files.createDirectories(toolDir);

            // Copy ts-parser.js and package.json to toolDir if not present
            copyParserFile("parser/ts-parser.js", toolDir.resolve("ts-parser.js"));
            copyParserFile("parser/package.json", toolDir.resolve("package.json"));

            // Check if node_modules exists, if not install
            File nodeModules = toolDir.resolve("node_modules").toFile();
            if (!nodeModules.exists()) {
                ProcessBuilder npmInstall = new ProcessBuilder("npm", "install");
                npmInstall.directory(toolDir.toFile());
                Process process = npmInstall.start();
                process.waitFor();
            }

            // Run parser
            ProcessBuilder runParser = new ProcessBuilder("node", "ts-parser.js", repoDir.getAbsolutePath());
            runParser.directory(toolDir.toFile());
            
            // Allocate larger buffer for command output as graph payload can be huge
            Process process = runParser.start();
            
            StringBuilder jsonResult = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    jsonResult.append(line);
                }
            }
            process.waitFor();

            if (jsonResult.length() > 0) {
                JsonNode root = objectMapper.readTree(jsonResult.toString());
                if (root.has("files")) {
                    root.get("files").forEach(parsedFiles::add);
                }
            }
        } catch (Exception e) {
            // Ignore TS/JS parser failure if Node is not installed, or process fails
        }
        return parsedFiles;
    }

    private void copyParserFile(String resourcePath, Path destPath) throws IOException {
        Resource resource = resourceLoader.getResource("classpath:" + resourcePath);
        try (InputStream is = resource.getInputStream()) {
            Files.copy(is, destPath, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private String resolveRelativePath(String currentFilePath, String importSource) {
        if (!importSource.startsWith(".")) {
            return null; // External library import
        }
        try {
            Path currentDir = Paths.get(currentFilePath).getParent();
            if (currentDir == null) currentDir = Paths.get("");
            Path resolved = currentDir.resolve(importSource).normalize();
            
            // Format it nicely
            String pathStr = resolved.toString().replace("\\", "/");
            if (pathStr.startsWith("./")) pathStr = pathStr.substring(2);
            return pathStr;
        } catch (Exception e) {
            return null;
        }
    }
}
