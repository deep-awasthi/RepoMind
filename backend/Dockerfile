# Stage 1: Build the Maven application
FROM maven:3.9.6-eclipse-temurin-21-alpine AS build
WORKDIR /app
COPY pom.xml .
# Download dependencies first (cached)
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests -B

# Stage 2: Create runtime environment
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Install git (required by JGit for some native fallback operations, though JGit is pure Java)
# Install nodejs and npm (required for JS/TS parser script execution)
RUN apk update && apk add --no-cache git nodejs npm

# Copy built JAR from stage 1
COPY --from=build /app/target/repomind-backend-*.jar app.jar

# Copy parser script package.json and code into runtime
# We will create this inside resources and it will be bundled inside the jar,
# but we can also extract it or reference it from resource paths.
# To make JS/TS parsing simple, we can package a node CLI inside resources and execute it using Node.

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
