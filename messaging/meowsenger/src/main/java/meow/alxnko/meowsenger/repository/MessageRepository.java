package meow.alxnko.meowsenger.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import meow.alxnko.meowsenger.model.Message;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    
    List<Message> findByChatIdOrderBySendTimeDesc(Long chatId);
    
    List<Message> findByUserIdOrderBySendTimeDesc(Long userId);
}