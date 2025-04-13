package meow.alxnko.meowsenger.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import meow.alxnko.meowsenger.model.Chat;
import meow.alxnko.meowsenger.model.Message;
import meow.alxnko.meowsenger.model.User;
import meow.alxnko.meowsenger.repository.ChatRepository;
import meow.alxnko.meowsenger.repository.MessageRepository;
import meow.alxnko.meowsenger.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ChatRepository chatRepository;
    private final UpdateService updateService;
    
    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Save a new message to the database
     */
    @Transactional
    public Message saveMessage(String content, Long senderId, Long chatId) {
        // Get the user
        User user = userRepository.findById(senderId)
                .orElseThrow(() -> new RuntimeException("User not found"));
                
        // Get the chat
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new RuntimeException("Chat not found"));
        
        // Create and save the message
        Message message = Message.builder()
                .text(content)
                .user(user)
                .chat(chat)
                .sendTime(LocalDateTime.now())
                .isDeleted(false)
                .isEdited(false)
                .isSystem(false)
                .isForwarded(false)
                .build();
        
        // Save the message first to get its ID
        Message savedMessage = messageRepository.save(message);
        
        // Add all users in the chat except the sender as unread recipients
        // Using native SQL to match Django's table structure
        Set<User> otherUsers = chat.getUsers().stream()
                .filter(chatUser -> !chatUser.getId().equals(senderId))
                .collect(Collectors.toSet());
                
        for (User otherUser : otherUsers) {
            Query query = entityManager.createNativeQuery(
                "INSERT INTO user_message (user_id, msg_id) VALUES (?, ?)");
            query.setParameter(1, otherUser.getId());
            query.setParameter(2, savedMessage.getId());
            query.executeUpdate();
        }
        
        // Create an update record for this message
        updateService.createUpdate(chatId, savedMessage.getId());
        
        return savedMessage;
    }
    
    /**
     * Get messages for a specific chat
     */
    public List<Message> getMessagesForChat(Long chatId) {
        return messageRepository.findByChatIdOrderBySendTimeDesc(chatId);
    }
    
    /**
     * Mark a message as read for a user
     */
    @Transactional
    public void markMessageAsRead(Long messageId, Long userId) {
        // Use native SQL to delete from the usermessage junction table
        Query query = entityManager.createNativeQuery(
            "DELETE FROM user_message WHERE user_id = ? AND msg_id = ?");
        query.setParameter(1, userId);
        query.setParameter(2, messageId);
        query.executeUpdate();
    }
}