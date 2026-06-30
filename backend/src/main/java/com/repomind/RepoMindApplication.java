package com.repomind;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
@EnableCaching
public class RepoMindApplication {
    public static void main(String[] args) {
        SpringApplication.run(RepoMindApplication.class, args);
    }
}
