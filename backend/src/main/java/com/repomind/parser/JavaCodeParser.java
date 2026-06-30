package com.repomind.parser;

import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.FieldDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.VariableDeclarator;
import com.github.javaparser.ast.expr.AnnotationExpr;
import com.github.javaparser.ast.expr.MethodCallExpr;
import org.springframework.stereotype.Component;

import java.io.File;
import java.util.*;

@Component
public class JavaCodeParser {

    public static class ParsedFile {
        public String name;
        public String path;
        public Long size;
        public String packageName = "";
        public List<String> imports = new ArrayList<>();
        public List<ParsedClass> classes = new ArrayList<>();
    }

    public static class ParsedClass {
        public String name;
        public String fullName;
        public String type; // CLASS or INTERFACE
        public String extendsClass;
        public List<String> implementsInterfaces = new ArrayList<>();
        public List<String> annotations = new ArrayList<>();
        public List<ParsedField> fields = new ArrayList<>();
        public List<ParsedMethod> methods = new ArrayList<>();
    }

    public static class ParsedField {
        public String name;
        public String type;
    }

    public static class ParsedMethod {
        public String name;
        public String fullName;
        public String returnType;
        public List<String> parameters = new ArrayList<>();
        public List<String> annotations = new ArrayList<>();
        public List<String> calls = new ArrayList<>(); // Names of methods called
    }

    public ParsedFile parseJavaFile(File file, File repoRootDir) {
        ParsedFile parsedFile = new ParsedFile();
        parsedFile.name = file.getName();
        parsedFile.size = file.length();
        // Calculate relative path
        parsedFile.path = repoRootDir.toPath().relativize(file.toPath()).toString().replace("\\", "/");

        try {
            CompilationUnit cu = StaticJavaParser.parse(file);
            
            // Extract Package
            cu.getPackageDeclaration().ifPresent(pd -> parsedFile.packageName = pd.getNameAsString());
            
            // Extract Imports
            cu.getImports().forEach(im -> parsedFile.imports.add(im.getNameAsString()));

            // Extract Classes / Interfaces
            cu.findAll(ClassOrInterfaceDeclaration.class).forEach(cid -> {
                ParsedClass pc = new ParsedClass();
                pc.name = cid.getNameAsString();
                pc.fullName = parsedFile.packageName.isEmpty() ? pc.name : parsedFile.packageName + "." + pc.name;
                pc.type = cid.isInterface() ? "INTERFACE" : "CLASS";
                
                // Extends
                cid.getExtendedTypes().forEach(et -> pc.extendsClass = et.getNameAsString());
                
                // Implements
                cid.getImplementedTypes().forEach(it -> pc.implementsInterfaces.add(it.getNameAsString()));

                // Class annotations
                cid.getAnnotations().forEach(ann -> {
                    String str = ann.toString();
                    if (str.startsWith("@")) str = str.substring(1);
                    pc.annotations.add(str);
                });

                // Fields (useful for resolving call target types)
                cid.findAll(FieldDeclaration.class).forEach(fd -> {
                    for (VariableDeclarator vd : fd.getVariables()) {
                        ParsedField pf = new ParsedField();
                        pf.name = vd.getNameAsString();
                        pf.type = vd.getTypeAsString();
                        pc.fields.add(pf);
                    }
                });

                // Methods
                cid.getMethods().forEach(md -> {
                    ParsedMethod pm = new ParsedMethod();
                    pm.name = md.getNameAsString();
                    pm.fullName = pc.fullName + "." + pm.name;
                    pm.returnType = md.getTypeAsString();

                    // Parameters
                    md.getParameters().forEach(p -> pm.parameters.add(p.getTypeAsString() + " " + p.getNameAsString()));

                    // Method annotations
                    md.getAnnotations().forEach(ann -> {
                        String str = ann.toString();
                        if (str.startsWith("@")) str = str.substring(1);
                        pm.annotations.add(str);
                    });

                    // Method calls inside body
                    md.findAll(MethodCallExpr.class).forEach(mce -> {
                        String callName = mce.getNameAsString();
                        if ("send".equals(callName) && mce.getScope().isPresent() && mce.getScope().get().toString().contains("Template")) {
                            if (mce.getArguments().size() > 0) {
                                String topic = mce.getArgument(0).toString().replace("\"", "");
                                pm.calls.add("kafkaTemplate.send:" + topic);
                            }
                        } else {
                            mce.getScope().ifPresent(scope -> {
                                pm.calls.add(scope.toString() + "." + callName);
                            });
                            if (mce.getScope().isEmpty()) {
                                pm.calls.add(callName);
                            }
                        }
                    });

                    pc.methods.add(pm);
                });

                parsedFile.classes.add(pc);
            });

        } catch (Exception e) {
            // Log parse failure for this specific file, return whatever we parsed
        }
        return parsedFile;
    }
}
