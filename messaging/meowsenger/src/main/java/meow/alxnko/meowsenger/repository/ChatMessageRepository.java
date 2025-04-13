package meow.alxnko.meowsenger.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import meow.alxnko.meowsenger.model.Message;

@Repository
public interface ChatMessageRepository extends JpaRepository<Message, Integer> { // Changed from Long to Integer
    
    // Updated to use Message entity fields
    List<Message> findByChatId(Integer chatId); // Changed from Long to Integer
    
    // Updated to use Message entity fields
    List<Message> findByChatIdOrderBySendTimeDesc(Integer chatId); // Changed from Long to Integer
    
    // Updated to use Message entity fields
    List<Message> findByUserId(Integer userId); // Changed from Long to Integer
}