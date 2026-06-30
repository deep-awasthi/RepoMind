package com.repomind.service;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.*;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
public class GitCloneService {

    @Value("${repomind.clone-dir:backend/clones}")
    private String cloneBaseDir;

    public File cloneRepository(String repoUrl, String token, String branch) throws Exception {
        String uniqueId = UUID.randomUUID().toString();
        Path clonePath = Paths.get(cloneBaseDir, uniqueId);
        Files.createDirectories(clonePath);

        var cloneCommand = Git.cloneRepository()
                .setURI(repoUrl)
                .setDirectory(clonePath.toFile())
                .setCloneAllBranches(false);

        if (branch != null && !branch.trim().isEmpty()) {
            cloneCommand.setBranch(branch);
        }

        if (token != null && !token.trim().isEmpty()) {
            // Support OAuth token (GitHub Personal Access Token)
            cloneCommand.setCredentialsProvider(new UsernamePasswordCredentialsProvider(token, ""));
        }

        try (Git git = cloneCommand.call()) {
            return clonePath.toFile();
        } catch (Exception e) {
            deleteDirectory(clonePath.toFile());
            throw e;
        }
    }

    public File extractZip(MultipartFile zipFile) throws IOException {
        String uniqueId = UUID.randomUUID().toString();
        Path extractPath = Paths.get(cloneBaseDir, uniqueId);
        Files.createDirectories(extractPath);

        try (ZipInputStream zis = new ZipInputStream(zipFile.getInputStream())) {
            ZipEntry entry = zis.getNextEntry();
            while (entry != null) {
                Path newPath = zipSlipProtect(entry, extractPath);
                if (entry.isDirectory()) {
                    Files.createDirectories(newPath);
                } else {
                    if (newPath.getParent() != null) {
                        Files.createDirectories(newPath.getParent());
                    }
                    Files.copy(zis, newPath, StandardCopyOption.REPLACE_EXISTING);
                }
                zis.closeEntry();
                entry = zis.getNextEntry();
            }
        } catch (Exception e) {
            deleteDirectory(extractPath.toFile());
            throw e;
        }
        return extractPath.toFile();
    }

    private Path zipSlipProtect(ZipEntry entry, Path targetDir) throws IOException {
        Path targetDirResolved = targetDir.toAbsolutePath().normalize();
        Path entryPath = Paths.get(entry.getName());
        Path resolvedPath = targetDirResolved.resolve(entryPath).toAbsolutePath().normalize();
        
        if (!resolvedPath.startsWith(targetDirResolved)) {
            throw new IOException("Entry is outside of the target directory (Zip Slip): " + entry.getName());
        }
        return resolvedPath;
    }

    public void deleteDirectory(File dir) {
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
