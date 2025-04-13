package meow.alxnko.meowsenger.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import meow.alxnko.meowsenger.model.Update;

@Repository
public interface UpdateRepository extends JpaRepository<Update, Integer> { // Changed from Long to Integer
    
    List<Update> findByChatId(Integer chatId); // Changed from Long to Integer
    
    List<Update> findByMessageId(Integer messageId); // Changed from Long to Integer
}