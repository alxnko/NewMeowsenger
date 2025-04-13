package meow.alxnko.meowsenger.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import meow.alxnko.meowsenger.model.Message;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Integer> { // Changed from Long to Integer
    
    List<Message> findByChatIdOrderBySendTimeDesc(Integer chatId); // Changed from Long to Integer
    
    List<Message> findByUserIdOrderBySendTimeDesc(Integer userId); // Changed from Long to Integer
}