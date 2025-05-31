package meow.alxnko.meowsenger.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import meow.alxnko.meowsenger.model.Chat;

@Repository
public interface ChatRepository extends JpaRepository<Chat, Long> {
    
    @Query("SELECT c FROM Chat c JOIN c.users u WHERE u.id = :userId")
    List<Chat> findByParticipantId(Long userId);
    
    // Check if a user is part of a chat using direct query instead of loading collections
    @Query("SELECT COUNT(c) > 0 FROM Chat c JOIN c.users u WHERE c.id = :chatId AND u.id = :userId")
    boolean isUserInChat(Long chatId, Long userId);
    
    // Alias method for isUserInChat for better readability in some contexts
    default boolean isMember(Long chatId, Long userId) {
        return isUserInChat(chatId, userId);
    }
    
    // Fetch chat with users eagerly loaded
    @Query("SELECT c FROM Chat c LEFT JOIN FETCH c.users WHERE c.id = :chatId")
    Optional<Chat> findByIdWithUsers(Long chatId);
    
    // Check if a user is an admin in a chat
    @Query("SELECT COUNT(c) > 0 FROM Chat c JOIN c.admins a WHERE c.id = :chatId AND a.id = :userId")
    boolean isUserAdmin(Long chatId, Long userId);
    
    // Add a user as an admin to a chat - using the correct Django table name (admin_chat)
    @Modifying
    @Transactional
    @Query(value = "INSERT INTO admin_chat (chat_id, user_id) VALUES (:chatId, :userId) ON CONFLICT DO NOTHING", nativeQuery = true)
    void addUserAsAdmin(Long chatId, Long userId);
    
    // Remove a user as an admin from a chat - using the correct Django table name (admin_chat)
    @Modifying
    @Transactional
    @Query(value = "DELETE FROM admin_chat WHERE chat_id = :chatId AND user_id = :userId", nativeQuery = true)
    void removeUserAsAdmin(Long chatId, Long userId);
    
    // Remove a user from a chat - using the Django table name (meowsenger_backend_chat_users)
    @Modifying
    @Transactional
    @Query(value = "DELETE FROM meowsenger_backend_chat_users WHERE chat_id = :chatId AND user_id = :userId", nativeQuery = true)
    int removeUserFromChatRaw(Long chatId, Long userId);
    
    // Also remove them from admin if they were an admin
    @Modifying
    @Transactional
    @Query(value = "DELETE FROM admin_chat WHERE chat_id = :chatId AND user_id = :userId", nativeQuery = true)
    int removeUserFromAdminRaw(Long chatId, Long userId);
    
    /**
     * Remove a user from a chat, including from admin status if applicable
     * Returns true if the operation was successful
     */
    @Transactional
    default boolean removeUserFromChat(Long chatId, Long userId) {
        // First remove from admin list if they were an admin
        removeUserFromAdminRaw(chatId, userId);
        
        // Then remove from the chat users
        int rowsAffected = removeUserFromChatRaw(chatId, userId);
        
        return rowsAffected > 0;
    }
}