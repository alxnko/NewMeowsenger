package meow.alxnko.meowsenger.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import meow.alxnko.meowsenger.model.User;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> { // Changed from Integer to Long
    
    Optional<User> findByUsername(String username);
    
    /**
     * Find username by ID without loading the entire user object
     */
    @Query("SELECT u.username FROM User u WHERE u.id = :userId")
    String findUsernameById(@Param("userId") Long userId);
}