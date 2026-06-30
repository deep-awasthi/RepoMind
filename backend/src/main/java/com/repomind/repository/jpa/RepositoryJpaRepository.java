package com.repomind.repository.jpa;

import com.repomind.model.jpa.RepositoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RepositoryJpaRepository extends JpaRepository<RepositoryEntity, Long> {
}
