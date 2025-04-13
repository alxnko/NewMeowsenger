package meow.alxnko.meowsenger.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import meow.alxnko.meowsenger.model.User;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Integer> { // Changed from Long to Integer
    
    Optional<User> findByUsername(String username);
}