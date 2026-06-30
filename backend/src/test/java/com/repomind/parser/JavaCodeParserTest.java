package com.repomind.parser;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class JavaCodeParserTest {

    @TempDir
    Path tempDir;

    @Test
    public void testParseJavaFile() throws Exception {
        // Arrange
        String code = 
            "package com.test;\n" +
            "import org.springframework.web.bind.annotation.*;\n" +
            "@RestController\n" +
            "public class TestController {\n" +
            "    private String name;\n" +
            "    @GetMapping(\"/api/hello\")\n" +
            "    public String sayHello(String input) {\n" +
            "        System.out.println(input);\n" +
            "        return \"hello\";\n" +
            "    }\n" +
            "}\n";

        Path filePath = tempDir.resolve("TestController.java");
        Files.writeString(filePath, code);

        JavaCodeParser parser = new JavaCodeParser();

        // Act
        JavaCodeParser.ParsedFile parsed = parser.parseJavaFile(filePath.toFile(), tempDir.toFile());

        // Assert
        assertNotNull(parsed);
        assertEquals("TestController.java", parsed.name);
        assertEquals("com.test", parsed.packageName);
        assertEquals(1, parsed.imports.size());
        assertEquals("org.springframework.web.bind.annotation", parsed.imports.get(0));

        assertEquals(1, parsed.classes.size());
        JavaCodeParser.ParsedClass clazz = parsed.classes.get(0);
        assertEquals("TestController", clazz.name);
        assertEquals("com.test.TestController", clazz.fullName);
        assertEquals("CLASS", clazz.type);
        assertTrue(clazz.annotations.contains("RestController"));

        // Field check
        assertEquals(1, clazz.fields.size());
        assertEquals("name", clazz.fields.get(0).name);
        assertEquals("String", clazz.fields.get(0).type);

        // Method check
        assertEquals(1, clazz.methods.size());
        JavaCodeParser.ParsedMethod method = clazz.methods.get(0);
        assertEquals("sayHello", method.name);
        assertEquals("com.test.TestController.sayHello", method.fullName);
        assertEquals("String", method.returnType);
        assertTrue(method.annotations.stream().anyMatch(a -> a.startsWith("GetMapping")));
        
        // Parameter check
        assertEquals(1, method.parameters.size());
        assertEquals("String input", method.parameters.get(0));

        // Calls check
        assertEquals(1, method.calls.size());
        assertEquals("System.out.println", method.calls.get(0));
    }
}
