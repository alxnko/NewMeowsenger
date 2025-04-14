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
     * Save a new message to the database with optional reply-to reference
     */
    @Transactional
    public Message saveMessage(String content, Long senderId, Long chatId, Long replyToId) {
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
                .replyTo(replyToId) // Add reply-to reference if provided
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
     * Overloaded method for backward compatibility
     */
    @Transactional
    public Message saveMessage(String content, Long senderId, Long chatId) {
        return saveMessage(content, senderId, chatId, null);
    }
    
    /**
     * Get messages for a specific chat
     */
    public List<Message> getMessagesForChat(Long chatId) {
        return messageRepository.findByChatIdOrderBySendTimeDesc(chatId);
    }
    
    /**
     * Mark a message as read for a user and return the message
     */
    @Transactional
    public Message markMessageAsRead(Long messageId, Long userId) {
        // First find the message to return it
        Message message = messageRepository.findById(messageId).orElse(null);
        if (message == null) {
            return null;
        }
        
        // Use native SQL to delete from the usermessage junction table
        Query query = entityManager.createNativeQuery(
            "DELETE FROM user_message WHERE user_id = ? AND msg_id = ?");
        query.setParameter(1, userId);
        query.setParameter(2, messageId);
        query.executeUpdate();
        
        return message;
    }
    
    /**
     * Edit an existing message
     */
    @Transactional
    public Message editMessage(Long messageId, String newContent, Long userId) {
        Message message = messageRepository.findById(messageId).orElse(null);
        if (message == null) {
            return null;
        }
        
        // Verify the user is the message author
        if (!message.getUser().getId().equals(userId)) {
            throw new RuntimeException("Only the message author can edit a message");
        }
        
        message.setText(newContent);
        message.setEdited(true);  // Changed from setIsEdited to setEdited
        return messageRepository.save(message);
    }
    
    /**
     * Delete a message (soft delete)
     */
    @Transactional
    public Message deleteMessage(Long messageId, Long userId) {
        Message message = messageRepository.findById(messageId).orElse(null);
        if (message == null) {
            return null;
        }
        
        // Verify the user is the message author or a chat admin
        User user = userRepository.findById(userId).orElse(null);
        Chat chat = message.getChat();
        boolean isAdmin = chat.getAdmins().contains(user);
        boolean isAuthor = message.getUser().getId().equals(userId);
        
        if (!isAuthor && !isAdmin) {
            throw new RuntimeException("Only the message author or chat admins can delete a message");
        }
        
        message.setDeleted(true);  // Changed from setIsDeleted to setDeleted
        message.setText("[This message was deleted]");
        return messageRepository.save(message);
    }
    
    /**
     * Check if a message is read by a specific user
     */
    public boolean isMessageReadByUser(Long messageId, Long userId) {
        Query query = entityManager.createNativeQuery(
            "SELECT COUNT(*) FROM user_message WHERE user_id = ? AND msg_id = ?");
        query.setParameter(1, userId);
        query.setParameter(2, messageId);
        
        Number count = (Number) query.getSingleResult();
        return count.intValue() == 0; // If no record exists, the message is read
    }
}