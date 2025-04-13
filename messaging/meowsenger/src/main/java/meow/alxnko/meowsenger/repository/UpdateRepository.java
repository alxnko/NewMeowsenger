package meow.alxnko.meowsenger.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import meow.alxnko.meowsenger.model.Update;

@Repository
public interface UpdateRepository extends JpaRepository<Update, Long> { // Changed from Integer to Long
    
    List<Update> findByChatId(Long chatId); // Changed from Integer to Long
    
    List<Update> findByMessageId(Long messageId); // Changed from Integer to Long
}