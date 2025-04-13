package meow.alxnko.meowsenger.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import meow.alxnko.meowsenger.model.Chat;

@Repository
public interface ChatRepository extends JpaRepository<Chat, Long> {
    
    @Query("SELECT c FROM Chat c JOIN c.users u WHERE u.id = :userId")
    List<Chat> findByParticipantId(Long userId);
    
    // Check if a user is part of a chat using direct query instead of loading collections
    @Query("SELECT COUNT(c) > 0 FROM Chat c JOIN c.users u WHERE c.id = :chatId AND u.id = :userId")
    boolean isUserInChat(Long chatId, Long userId);
    
    // Fetch chat with users eagerly loaded
    @Query("SELECT c FROM Chat c LEFT JOIN FETCH c.users WHERE c.id = :chatId")
    Optional<Chat> findByIdWithUsers(Long chatId);
}