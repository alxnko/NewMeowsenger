package meow.alxnko.meowsenger.service;

import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import meow.alxnko.meowsenger.model.Chat;
import meow.alxnko.meowsenger.model.Message;
import meow.alxnko.meowsenger.model.User;
import meow.alxnko.meowsenger.model.WebSocketMessage;
import meow.alxnko.meowsenger.repository.ChatRepository;
import meow.alxnko.meowsenger.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketService {

    private final SimpMessagingTemplate messagingTemplate;
    private final ChatRepository chatRepository;
    private final UserRepository userRepository;
    private final MessageService messageService;
    
    // Map to track active user sessions
    private final Map<String, Long> sessionUserMap = new ConcurrentHashMap<>();
    // Map to track which users are in which chat rooms
    private final Map<Long, Map<Long, String>> userChatSessions = new ConcurrentHashMap<>();
    
    /**
     * Register a new WebSocket session for a user
     */
    public void registerUserSession(String sessionId, Long userId) {
        sessionUserMap.put(sessionId, userId);
        log.info("User {} connected with session {}", userId, sessionId);
    }
    
    /**
     * Get the user ID associated with a session
     */
    public Long getUserIdFromSession(String sessionId) {
        return sessionUserMap.get(sessionId);
    }
    
    /**
     * Remove a user session when the WebSocket disconnects
     */
    public void removeUserSession(String sessionId) {
        Long userId = sessionUserMap.get(sessionId);
        if (userId != null) {
            sessionUserMap.remove(sessionId);
            
            // Remove user from all chat rooms they were in with this session
            userChatSessions.forEach((chatId, userSessions) -> {
                String userSessionId = userSessions.get(userId);
                if (sessionId.equals(userSessionId)) {
                    userSessions.remove(userId);
                    log.info("User {} removed from chat {}", userId, chatId);
                }
            });
            
            log.info("User {} disconnected", userId);
        }
    }
    
    /**
     * Subscribe a user to a chat room
     */
    public WebSocketMessage subscribeUserToChat(Long chatId, Long userId, String sessionId) {
        // Check if chat exists
        Optional<Chat> chatOpt = chatRepository.findById(chatId);
        if (chatOpt.isEmpty()) {
            return createErrorMessage("Chat not found");
        }
        
        Chat chat = chatOpt.get();
        
        // Check if user exists
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return createErrorMessage("User not found");
        }
        
        User user = userOpt.get();
        
        // Check if user is member of the chat
        if (!chat.getUsers().contains(user)) {
            return createErrorMessage("User is not a member of this chat");
        }
        
        // Add user to chat room
        userChatSessions.computeIfAbsent(chatId, k -> new HashMap<>()).put(userId, sessionId);
        
        log.info("User {} subscribed to chat {}", userId, chatId);
        
        // Create and return a success message
        return WebSocketMessage.builder()
                .type(WebSocketMessage.MessageType.JOIN)
                .userId(userId)
                .chatId(chatId)
                .content("User joined the chat")
                .timestamp(LocalDateTime.now())
                .build();
    }
    
    /**
     * Process and save a new chat message, then broadcast it to all users in the chat
     */
    public WebSocketMessage processAndSendMessage(WebSocketMessage message) {
        Long chatId = message.getChatId();
        Long userId = message.getUserId();
        
        // Verify chat exists
        Optional<Chat> chatOpt = chatRepository.findById(chatId);
        if (chatOpt.isEmpty()) {
            return createErrorMessage("Chat not found");
        }
        
        Chat chat = chatOpt.get();
        
        // Verify user exists
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return createErrorMessage("User not found");
        }
        
        User user = userOpt.get();
        
        // Verify user is member of the chat
        if (!chat.getUsers().contains(user)) {
            return createErrorMessage("User is not a member of this chat");
        }
        
        // Save message to database
        Message savedMessage = messageService.saveMessage(
                message.getContent(), 
                userId, 
                chatId);
        
        // Build response with saved message ID
        WebSocketMessage responseMessage = WebSocketMessage.builder()
                .type(WebSocketMessage.MessageType.CHAT)
                .chatId(chatId)
                .userId(userId)
                .content(message.getContent())
                .messageId(savedMessage.getId())
                .timestamp(savedMessage.getSendTime())
                .build();
        
        // Send message to all users subscribed to the chat
        messagingTemplate.convertAndSend("/topic/chat." + chatId, responseMessage);
        
        return responseMessage;
    }
    
    /**
     * Mark a message as read for a user
     */
    public void markMessageAsRead(Long messageId, Long userId) {
        try {
            messageService.markMessageAsRead(messageId, userId);
            
            // Notify other clients that the message has been read
            WebSocketMessage readNotification = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.CHAT)
                    .messageId(messageId)
                    .userId(userId)
                    .content("Message read")
                    .timestamp(LocalDateTime.now())
                    .build();
            
            messagingTemplate.convertAndSend("/user/" + userId + "/queue/read-receipts", readNotification);
            
            log.info("Message {} marked as read by user {}", messageId, userId);
        } catch (Exception e) {
            log.error("Error marking message as read: {}", e.getMessage());
        }
    }
    
    /**
     * Create an error message
     */
    private WebSocketMessage createErrorMessage(String errorMessage) {
        return WebSocketMessage.builder()
                .type(WebSocketMessage.MessageType.ERROR)
                .content(errorMessage)
                .timestamp(LocalDateTime.now())
                .build();
    }
}