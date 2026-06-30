package com.repomind.service;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.diff.DiffEntry;
import org.eclipse.jgit.diff.DiffFormatter;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.treewalk.TreeWalk;
import org.eclipse.jgit.util.io.DisabledOutputStream;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.*;

@Service
public class GitHotspotService {

    public Map<String, Integer> calculateModificationCounts(File repoDir) {
        Map<String, Integer> counts = new HashMap<>();
        try {
            // Check if directory has a .git folder
            File gitFolder = new File(repoDir, ".git");
            if (!gitFolder.exists()) {
                return counts; // Local ZIP uploads may not have git history
            }

            try (Git git = Git.open(repoDir)) {
                Repository repository = git.getRepository();
                Iterable<RevCommit> commits = git.log().call();
                
                int limit = 500; // Limit commit scan for performance
                int count = 0;
                
                try (DiffFormatter df = new DiffFormatter(DisabledOutputStream.INSTANCE)) {
                    df.setRepository(repository);
                    
                    for (RevCommit commit : commits) {
                        if (++count > limit) break;
                        
                        // Parse commit body/parent to compare trees
                        if (commit.getParentCount() > 0) {
                            // Find differences between this commit and its first parent
                            RevCommit parent = commit.getParent(0);
                            // We need to parse body to get parent trees if needed
                            try {
                                List<DiffEntry> diffs = df.scan(parent.getTree(), commit.getTree());
                                for (DiffEntry diff : diffs) {
                                    String path = diff.getNewPath();
                                    if (DiffEntry.DEV_NULL.equals(path)) {
                                        path = diff.getOldPath();
                                    }
                                    counts.put(path, counts.getOrDefault(path, 0) + 1);
                                }
                            } catch (Exception e) {
                                // Parse commit and try again
                            }
                        } else {
                            // First commit in repo - list all files
                            try (TreeWalk tw = new TreeWalk(repository)) {
                                tw.addTree(commit.getTree());
                                tw.setRecursive(true);
                                while (tw.next()) {
                                    String path = tw.getPathString();
                                    counts.put(path, counts.getOrDefault(path, 0) + 1);
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            // Log warning, return whatever counts we got or empty map
        }
        return counts;
    }

    public List<Map<String, Object>> getFileContributors(File repoDir, String filePath) {
        List<Map<String, Object>> contributors = new ArrayList<>();
        try {
            File gitFolder = new File(repoDir, ".git");
            if (!gitFolder.exists()) {
                return contributors;
            }

            try (Git git = Git.open(repoDir)) {
                Iterable<RevCommit> commits = git.log().addPath(filePath).call();
                Map<String, Integer> authorCounts = new HashMap<>();
                
                for (RevCommit commit : commits) {
                    String author = commit.getAuthorIdent().getName();
                    if (author != null) {
                        authorCounts.put(author, authorCounts.getOrDefault(author, 0) + 1);
                    }
                }

                authorCounts.forEach((author, count) -> {
                    Map<String, Object> c = new HashMap<>();
                    c.put("author", author);
                    c.put("commits", count);
                    contributors.add(c);
                });

                contributors.sort((a, b) -> ((Integer) b.get("commits")).compareTo((Integer) a.get("commits")));
            }
        } catch (Exception e) {
            // Log error
        }
        return contributors;
    }
}
