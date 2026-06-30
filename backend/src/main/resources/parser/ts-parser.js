const ts = require('typescript');
const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const name = path.join(dir, file);
        if (fs.statSync(name).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'build') {
                getFiles(name, files);
            }
        } else {
            if (/\.(js|ts|jsx|tsx)$/.test(file)) {
                files.push(name);
            }
        }
    }
    return files;
}

function parseFile(filePath, repoRootDir) {
    const content = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
    const relPath = path.relative(repoRootDir, filePath);

    const fileMeta = {
        name: path.basename(filePath),
        path: relPath,
        language: filePath.endsWith('ts') || filePath.endsWith('tsx') ? 'TypeScript' : 'JavaScript',
        size: fs.statSync(filePath).size,
        imports: [],
        classes: [],
        functions: [],
        endpoints: []
    };

    function visit(node) {
        if (ts.isImportDeclaration(node)) {
            let source = '';
            if (node.moduleSpecifier) {
                source = node.moduleSpecifier.text || node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
            }
            const specifiers = [];
            if (node.importClause) {
                if (node.importClause.name) {
                    specifiers.push(node.importClause.name.text);
                }
                if (node.importClause.namedBindings) {
                    if (ts.isNamedImports(node.importClause.namedBindings)) {
                        node.importClause.namedBindings.elements.forEach(el => {
                            specifiers.push(el.name.text);
                        });
                    } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
                        specifiers.push(node.importClause.namedBindings.name.text);
                    }
                }
            }
            fileMeta.imports.push({ source, specifiers });
        } else if (ts.isClassDeclaration(node)) {
            const className = node.name ? node.name.text : 'AnonymousClass';
            const classMeta = {
                name: className,
                extends: null,
                implements: [],
                methods: [],
                annotations: []
            };

            // Extends / Implements
            if (node.heritageClauses) {
                node.heritageClauses.forEach(clause => {
                    if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
                        classMeta.extends = clause.types[0].expression.getText(sourceFile);
                    } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
                        clause.types.forEach(t => {
                            classMeta.implements.push(t.expression.getText(sourceFile));
                        });
                    }
                });
            }

            // Decorators / Annotations (e.g. NestJS @Controller)
            const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) : [];
            if (decorators) {
                decorators.forEach(dec => {
                    classMeta.annotations.push(dec.expression.getText(sourceFile));
                });
            }

            // Methods inside class
            node.members.forEach(member => {
                if (ts.isMethodDeclaration(member)) {
                    const methodName = member.name.getText(sourceFile);
                    const methodMeta = {
                        name: methodName,
                        parameters: member.parameters.map(p => p.name.getText(sourceFile)),
                        returnType: member.type ? member.type.getText(sourceFile) : 'any',
                        calls: [],
                        annotations: []
                    };

                    const decs = ts.canHaveDecorators(member) ? ts.getDecorators(member) : [];
                    if (decs) {
                        decs.forEach(dec => {
                            methodMeta.annotations.push(dec.expression.getText(sourceFile));
                            
                            // Detect NestJS endpoints
                            const text = dec.expression.getText(sourceFile);
                            if (/(Get|Post|Put|Delete|Patch)\(/.test(text)) {
                                const match = text.match(/(Get|Post|Put|Delete|Patch)\((['"])(.*?)\2\)/);
                                const method = text.match(/(Get|Post|Put|Delete|Patch)/)[0].toUpperCase();
                                const route = match ? match[3] : '/';
                                fileMeta.endpoints.push({
                                    method,
                                    endpoint: route,
                                    controllerName: className
                                });
                            }
                        });
                    }

                    // Extract function calls inside method
                    function findCalls(n) {
                        if (ts.isCallExpression(n)) {
                            methodMeta.calls.push(n.expression.getText(sourceFile));
                        }
                        ts.forEachChild(n, findCalls);
                    }
                    if (member.body) {
                        findCalls(member.body);
                    }

                    classMeta.methods.push(methodMeta);
                }
            });

            fileMeta.classes.push(classMeta);
        } else if (ts.isFunctionDeclaration(node)) {
            const funcName = node.name ? node.name.text : 'anonymous';
            const funcMeta = {
                name: funcName,
                calls: []
            };

            function findCalls(n) {
                if (ts.isCallExpression(n)) {
                    funcMeta.calls.push(n.expression.getText(sourceFile));
                }
                ts.forEachChild(n, findCalls);
            }
            if (node.body) {
                findCalls(node.body);
            }
            fileMeta.functions.push(funcMeta);
        } else if (ts.isCallExpression(node)) {
            // Look for Express routing calls like app.get('/route', ...)
            const text = node.expression.getText(sourceFile);
            if (/\b(app|router)\.(get|post|put|delete|patch)\b/.test(text)) {
                const method = text.split('.')[1].toUpperCase();
                if (node.arguments && node.arguments.length > 1) {
                    const routeArg = node.arguments[0];
                    if (ts.isStringLiteral(routeArg)) {
                        fileMeta.endpoints.push({
                            method,
                            endpoint: routeArg.text,
                            controllerName: 'ExpressRouter'
                        });
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return fileMeta;
}

function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Please provide repository root path');
        process.exit(1);
    }
    const repoRootDir = path.resolve(args[0]);
    if (!fs.existsSync(repoRootDir)) {
        console.error('Directory does not exist:', repoRootDir);
        process.exit(1);
    }

    const files = getFiles(repoRootDir);
    const parsedFiles = files.map(file => {
        try {
            return parseFile(file, repoRootDir);
        } catch (e) {
            return {
                name: path.basename(file),
                path: path.relative(repoRootDir, file),
                error: e.message
            };
        }
    });

    console.log(JSON.stringify({ files: parsedFiles }));
}

main();
