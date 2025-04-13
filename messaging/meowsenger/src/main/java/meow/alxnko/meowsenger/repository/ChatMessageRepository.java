package meow.alxnko.meowsenger.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import meow.alxnko.meowsenger.model.Message;

@Repository
public interface ChatMessageRepository extends JpaRepository<Message, Long> {
    
    // Updated to use Message entity fields
    List<Message> findByChatId(Long chatId);
    
    // Updated to use Message entity fields
    List<Message> findByChatIdOrderBySendTimeDesc(Long chatId);
    
    // Updated to use Message entity fields
    List<Message> findByUserId(Long userId);
}