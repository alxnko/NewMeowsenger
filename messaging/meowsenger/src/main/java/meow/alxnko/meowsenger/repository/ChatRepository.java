package meow.alxnko.meowsenger.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import meow.alxnko.meowsenger.model.Chat;

@Repository
public interface ChatRepository extends JpaRepository<Chat, Integer> { // Changed from Long to Integer
    
    @Query("SELECT c FROM Chat c WHERE :userId MEMBER OF c.participantIds")
    List<Chat> findByParticipantId(Integer userId); // Changed from Long to Integer
    
    // Check if a user is part of a chat
    @Query("SELECT CASE WHEN COUNT(c) > 0 THEN true ELSE false END FROM Chat c WHERE c.id = :chatId AND :userId MEMBER OF c.participantIds")
    boolean isUserInChat(Integer chatId, Integer userId); // Changed from Long to Integer
}