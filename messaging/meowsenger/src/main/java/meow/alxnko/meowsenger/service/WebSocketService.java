package meow.alxnko.meowsenger.service;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import meow.alxnko.meowsenger.config.UserChannelInterceptor;
import meow.alxnko.meowsenger.config.UserChannelInterceptor.WebSocketDisconnectEvent;
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
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketService {

    private final SimpMessagingTemplate messagingTemplate;
    private final ChatRepository chatRepository;
    private final UserRepository userRepository;
    private final MessageService messageService;
    private final UserChannelInterceptor userChannelInterceptor;
    
    // Map to track active user sessions
    private final Map<String, Long> sessionUserMap = new ConcurrentHashMap<>();
    // Map to track which users are in which chat rooms
    private final Map<Long, Map<Long, String>> userChatSessions = new ConcurrentHashMap<>();
    // Map to track typing status
    private final Map<Long, Map<Long, LocalDateTime>> userTypingStatus = new ConcurrentHashMap<>();
    
    /**
     * Register a new WebSocket session for a user
     */
    public void registerUserSession(String sessionId, Long userId) {
        sessionUserMap.put(sessionId, userId);
        // Set the principal in the interceptor for user-specific messaging
        userChannelInterceptor.setUserPrincipal(sessionId, userId);
        log.info("User {} connected with session {}", userId, sessionId);
    }
    
    /**
     * Get the user ID associated with a session
     */
    public Long getUserIdFromSession(String sessionId) {
        return sessionUserMap.get(sessionId);
    }
    
    /**
     * Handle disconnection events from UserChannelInterceptor
     */
    @EventListener
    public void handleWebSocketDisconnectEvent(WebSocketDisconnectEvent event) {
        removeUserSession(event.getSessionId());
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
    @Transactional
    public WebSocketMessage subscribeUserToChat(Long chatId, Long userId, String sessionId) {
        // First check if chat exists
        Chat chat = chatRepository.findById(chatId)
                .orElse(null);
        if (chat == null) {
            return createErrorMessage("Chat not found");
        }
        
        // Check if user exists
        User user = userRepository.findById(userId)
                .orElse(null);
        if (user == null) {
            return createErrorMessage("User not found");
        }
        
        // Check if user is member of the chat with direct query
        if (!chatRepository.isUserInChat(chatId, userId)) {
            return createErrorMessage("User is not a member of this chat");
        }
        
        // Add user to chat room
        userChatSessions.computeIfAbsent(chatId, k -> new HashMap<>()).put(userId, sessionId);
        
        log.info("User {} subscribed to chat {}", userId, chatId);
        
        // Create a subscription confirmation message - but don't broadcast it
        WebSocketMessage confirmationMessage = WebSocketMessage.builder()
                .type(WebSocketMessage.MessageType.JOIN)
                .userId(userId)
                .chatId(chatId)
                .username(user.getUsername())
                .content("User subscribed to chat")
                .timestamp(LocalDateTime.now())
                .isGroup(chat.isGroup())
                .chatName(chat.getName())
                .build();
                
        // Return the confirmation without broadcasting to other users
        return confirmationMessage;
    }
    
    /**
     * Process and save a new chat message, then broadcast it to all users in the chat
     * including the sender
     */
    @Transactional
    public WebSocketMessage processAndSendMessage(WebSocketMessage inputMessage) {
        Long chatId = inputMessage.getChatId();
        Long userId = inputMessage.getUserId();
        String content = inputMessage.getContent();
        Long replyToId = inputMessage.getReplyTo();
        
        // Check if chat exists
        Chat chat = chatRepository.findById(chatId)
                .orElse(null);
        if (chat == null) {
            return createErrorMessage("Chat not found");
        }
        
        // Check if user exists
        User user = userRepository.findById(userId)
                .orElse(null);
        if (user == null) {
            return createErrorMessage("User not found");
        }
        
        // Check if user is member of the chat
        if (!chatRepository.isUserInChat(chatId, userId)) {
            return createErrorMessage("User is not a member of this chat");
        }
        
        // Save message to database
        Message savedMessage = messageService.saveMessage(content, userId, chatId, replyToId);
        
        // Build response with complete message data
        WebSocketMessage responseMessage = WebSocketMessage.builder()
                .type(WebSocketMessage.MessageType.CHAT)
                .chatId(chatId)
                .userId(userId)
                .username(user.getUsername())
                .content(content)
                .messageId(savedMessage.getId())
                .timestamp(savedMessage.getSendTime())
                .isEdited(savedMessage.isEdited())
                .isDeleted(savedMessage.isDeleted())
                .isSystem(savedMessage.isSystem())
                .replyTo(savedMessage.getReplyTo())
                .isForwarded(savedMessage.isForwarded())
                .isRead(false)
                .isGroup(chat.isGroup())
                .chatName(chat.getName())
                .build();
        
        // Send to all users in the chat including the sender
        sendMessageToAllUsers(chatId, userId, responseMessage);
        
        // Clear typing status for this user
        clearTypingStatus(chatId, userId);
        
        return responseMessage;
    }
    
    /**
     * Mark a message as read for a user
     */
    @Transactional
    public void markMessageAsRead(Long messageId, Long userId) {
        try {
            Message message = messageService.markMessageAsRead(messageId, userId);
            if (message == null) {
                log.error("Message {} not found when marking as read", messageId);
                return;
            }
            
            // Get the message author
            User author = message.getUser();
            
            // Notify the message author that their message has been read
            WebSocketMessage readNotification = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.READ)
                    .messageId(messageId)
                    .userId(userId)
                    .chatId(message.getChat().getId())
                    .timestamp(LocalDateTime.now())
                    .isRead(true)
                    .build();
            
            // Send read receipt to the author of the message
            messagingTemplate.convertAndSend("/user/" + author.getId() + "/queue/read-receipts", readNotification);
            
            log.info("Message {} marked as read by user {}", messageId, userId);
        } catch (Exception e) {
            log.error("Error marking message as read: {}", e.getMessage());
        }
    }
    
    /**
     * Notify chat members that a user is typing
     */
    public void notifyTyping(Long chatId, Long userId) {
        // Skip processing if we've received a typing notification from this user recently
        Map<Long, LocalDateTime> chatTypingStatus = userTypingStatus.get(chatId);
        if (chatTypingStatus != null) {
            LocalDateTime lastTyping = chatTypingStatus.get(userId);
            if (lastTyping != null) {
                // Increase the rate limit to 2 seconds to reduce processing overhead
                // This matches the frontend's new optimized rate of 2 seconds
                if (lastTyping.plusSeconds(2).isAfter(LocalDateTime.now())) {
                    return;
                }
            }
        }
        
        // Update typing status
        userTypingStatus.computeIfAbsent(chatId, k -> new HashMap<>())
                .put(userId, LocalDateTime.now());
        
        // Get user details from cache if possible, or from database as fallback
        String username;
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;
        username = user.getUsername();
        
        WebSocketMessage typingMessage = WebSocketMessage.builder()
                .type(WebSocketMessage.MessageType.TYPING)
                .chatId(chatId)
                .userId(userId)
                .username(username)
                .timestamp(LocalDateTime.now())
                .build();
        
        // Send typing notification to all users in the chat
        messagingTemplate.convertAndSend("/topic/chat." + chatId + "/typing", typingMessage);
    }
    
    /**
     * Clear typing status for a user
     */
    private void clearTypingStatus(Long chatId, Long userId) {
        Map<Long, LocalDateTime> chatTypingStatus = userTypingStatus.get(chatId);
        if (chatTypingStatus != null) {
            chatTypingStatus.remove(userId);
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
    
    /**
     * Send a message to all users in a chat including the sender
     */
    private void sendMessageToAllUsers(Long chatId, Long senderId, WebSocketMessage message) {
        Map<Long, String> chatUsers = userChatSessions.get(chatId);
        if (chatUsers == null || chatUsers.isEmpty()) {
            log.warn("No users found in chat {} to send message", chatId);
            return;
        }
        
        log.debug("Chat {} has {} users", chatId, chatUsers.size());
        
        // Send the message to each user in the chat INCLUDING the sender
        for (Long userId : chatUsers.keySet()) {
            log.debug("Sending message to user {} for chat {}", userId, chatId);
            
            try {
                // Use both approaches to ensure delivery
                // 1. User-specific messaging with convertAndSendToUser
                messagingTemplate.convertAndSendToUser(
                    userId.toString(),
                    "/queue/chat." + chatId, 
                    message
                );
                
                // 2. Also try with broadcast to specific user's topic as fallback
                messagingTemplate.convertAndSend(
                    "/topic/user." + userId + ".chat." + chatId,
                    message
                );
                
                log.debug("Message sent successfully to user {} for chat {}", userId, chatId);
            } catch (Exception e) {
                log.error("Error sending message to user {}: {}", userId, e.getMessage());
            }
        }
        
        log.info("Message sent to {} users in chat {}", chatUsers.size(), chatId);
    }
    
    /**
     * Broadcast a message update (edit or delete) to all users in a chat including the sender
     */
    public void broadcastMessageUpdate(WebSocketMessage message) {
        Long chatId = message.getChatId();
        Long senderId = message.getUserId();
        
        if (chatId == null) {
            log.error("Cannot broadcast message update: No chat ID provided");
            return;
        }
        
        // Send the updated message to all users in the chat including the sender
        sendMessageToAllUsers(chatId, senderId, message);
        
        log.info("Message update (ID: {}, Type: {}) broadcast to chat {}", 
                message.getMessageId(), 
                message.getIsDeleted() ? "DELETE" : "EDIT", 
                chatId);
    }
    
    /**
     * Send a notification when a user is added to a chat
     */
    @Transactional
    public void notifyChatMemberAdded(Long chatId, Long userId, String addedUsername) {
        try {
            // Get chat details
            Chat chat = chatRepository.findById(chatId).orElse(null);
            User user = userRepository.findById(userId).orElse(null);
            
            if (chat == null || user == null) {
                log.error("Chat or user not found when notifying chat member added");
                return;
            }
            
            // Create the notification message
            WebSocketMessage chatUpdateMessage = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.CHAT_UPDATE)
                    .chatId(chatId)
                    .userId(userId)
                    .username(user.getUsername())
                    .content(addedUsername + " was added to " + chat.getName())
                    .timestamp(LocalDateTime.now())
                    .isGroup(chat.isGroup())
                    .chatName(chat.getName())
                    .updateType("MEMBER_ADDED")
                    .build();
            
            // Send notification to the user who was added
            User addedUser = userRepository.findByUsername(addedUsername).orElse(null);
            if (addedUser != null) {
                messagingTemplate.convertAndSendToUser(
                    addedUser.getId().toString(),
                    "/queue/chat-updates", 
                    chatUpdateMessage
                );
                
                // Also send to user's topic as fallback
                messagingTemplate.convertAndSend(
                    "/topic/user." + addedUser.getId() + ".chat-updates",
                    chatUpdateMessage
                );
                
                log.info("Sent chat update notification to user {} for chat {}", addedUser.getId(), chatId);
            }
        } catch (Exception e) {
            log.error("Error sending chat member added notification: {}", e.getMessage());
        }
    }
    
    /**
     * Send a notification when a new chat is created
     */
    @Transactional
    public void notifyNewChatCreated(Chat chat, User creator, List<User> members) {
        try {
            for (User member : members) {
                // Skip the creator (they'll know they created it)
                if (member.getId().equals(creator.getId())) {
                    continue;
                }
                
                WebSocketMessage newChatMessage = WebSocketMessage.builder()
                        .type(WebSocketMessage.MessageType.CHAT_UPDATE)
                        .chatId(chat.getId())
                        .userId(creator.getId())
                        .username(creator.getUsername())
                        .content("You were added to " + chat.getName())
                        .timestamp(LocalDateTime.now())
                        .isGroup(chat.isGroup())
                        .chatName(chat.getName())
                        .updateType("NEW_CHAT")
                        .build();
                
                // Send to user's queue
                messagingTemplate.convertAndSendToUser(
                    member.getId().toString(),
                    "/queue/chat-updates", 
                    newChatMessage
                );
                
                // Also send to user's topic as fallback
                messagingTemplate.convertAndSend(
                    "/topic/user." + member.getId() + ".chat-updates",
                    newChatMessage
                );
                
                log.info("Sent new chat notification to user {} for chat {}", member.getId(), chat.getId());
            }
        } catch (Exception e) {
            log.error("Error sending new chat notification: {}", e.getMessage());
        }
    }
    
    /**
     * Send a notification when admin status changes for a user
     */
    @Transactional
    public void notifyAdminStatusChanged(Long chatId, Long changedByUserId, String changedByUsername, 
                                         Long targetUserId, String targetUsername, boolean isPromotion) {
        try {
            // Get chat details
            Chat chat = chatRepository.findById(chatId).orElse(null);
            
            if (chat == null) {
                log.error("Chat not found when notifying admin status change");
                return;
            }
            
            // Create the notification message with system flag
            String content = isPromotion 
                ? changedByUsername + " made " + targetUsername + " an admin" 
                : changedByUsername + " removed admin rights from " + targetUsername;
                
            WebSocketMessage systemMessage = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.CHAT)
                    .chatId(chatId)
                    .userId(changedByUserId)
                    .username(changedByUsername)
                    .content(content)
                    .timestamp(LocalDateTime.now())
                    .isSystem(true)  // Mark as system message
                    .isGroup(chat.isGroup())
                    .chatName(chat.getName())
                    .build();
                    
            // Process and send this message to all members including the target user
            processAndSendMessage(systemMessage);
            
            // Also send a special admin status update notification directly to the affected user
            WebSocketMessage statusUpdateMessage = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.CHAT_UPDATE)
                    .chatId(chatId)
                    .userId(changedByUserId)
                    .username(changedByUsername)
                    .content(content)
                    .timestamp(LocalDateTime.now())
                    .updateType("ADMIN_CHANGED")
                    .isGroup(chat.isGroup())
                    .chatName(chat.getName())
                    .build();
            
            // Send to the target user's queue
            messagingTemplate.convertAndSendToUser(
                targetUserId.toString(),
                "/queue/chat-updates", 
                statusUpdateMessage
            );
            
            // Also send to target user's topic as fallback
            messagingTemplate.convertAndSend(
                "/topic/user." + targetUserId + ".chat-updates",
                statusUpdateMessage
            );
            
            log.info("Sent admin status change notification to user {} for chat {}", targetUserId, chatId);
        } catch (Exception e) {
            log.error("Error sending admin status change notification: {}", e.getMessage());
        }
    }
    
    /**
     * Send a notification when a user is removed from a chat
     */
    @Transactional
    public void notifyUserRemoved(Long chatId, Long removedByUserId, String removedByUsername, 
                                 Long targetUserId, String targetUsername) {
        try {
            // Get chat details
            Chat chat = chatRepository.findById(chatId).orElse(null);
            
            if (chat == null) {
                log.error("Chat not found when notifying user removal");
                return;
            }
            
            // Create system message for the chat
            String content = removedByUsername + " removed " + targetUsername + " from the group";
            WebSocketMessage systemMessage = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.CHAT)
                    .chatId(chatId)
                    .userId(removedByUserId)
                    .username(removedByUsername)
                    .content(content)
                    .timestamp(LocalDateTime.now())
                    .isSystem(true)  // Mark as system message
                    .isGroup(chat.isGroup())
                    .chatName(chat.getName())
                    .build();
                    
            // Process and send this message to all remaining members
            processAndSendMessage(systemMessage);
            
            // Send a special removal notification to the removed user
            WebSocketMessage removalMessage = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.CHAT_UPDATE)
                    .chatId(chatId)
                    .userId(removedByUserId)
                    .username(removedByUsername)
                    .content(content)
                    .timestamp(LocalDateTime.now())
                    .updateType("MEMBER_REMOVED")
                    .isGroup(chat.isGroup())
                    .chatName(chat.getName())
                    .build();
            
            // Send to the removed user's queue
            messagingTemplate.convertAndSendToUser(
                targetUserId.toString(),
                "/queue/chat-updates", 
                removalMessage
            );
            
            // Also send to removed user's topic as fallback
            messagingTemplate.convertAndSend(
                "/topic/user." + targetUserId + ".chat-updates",
                removalMessage
            );
            
            log.info("Sent removal notification to user {} for chat {}", targetUserId, chatId);
        } catch (Exception e) {
            log.error("Error sending user removal notification: {}", e.getMessage());
        }
    }
    
    /**
     * Send a notification when chat settings are changed
     */
    @Transactional
    public void notifyChatSettingsChanged(Long chatId, Long changedByUserId, String changedByUsername,
                                         String name, String description, String message) {
        try {
            // Get chat details
            Chat chat = chatRepository.findById(chatId).orElse(null);
            
            if (chat == null) {
                log.error("Chat not found when notifying settings change");
                return;
            }
            
            // Create system message for the chat
            WebSocketMessage systemMessage = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.CHAT)
                    .chatId(chatId)
                    .userId(changedByUserId)
                    .username(changedByUsername)
                    .content(message)
                    .timestamp(LocalDateTime.now())
                    .isSystem(true)  // Mark as system message
                    .isGroup(chat.isGroup())
                    .chatName(name)  // Use the new name
                    .build();
                    
            // Process and send this message to all members
            processAndSendMessage(systemMessage);
            
            // Also send a special chat update notification to all members
            WebSocketMessage updateMessage = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.CHAT_UPDATE)
                    .chatId(chatId)
                    .userId(changedByUserId)
                    .username(changedByUsername)
                    .content(message)
                    .timestamp(LocalDateTime.now())
                    .updateType("SETTINGS_CHANGED")
                    .isGroup(chat.isGroup())
                    .chatName(name)
                    .build();
                    
            // Get all users in the chat
            Map<Long, String> chatUsers = userChatSessions.get(chatId);
            if (chatUsers != null && !chatUsers.isEmpty()) {
                for (Long userId : chatUsers.keySet()) {
                    // Send to each user's queue
                    messagingTemplate.convertAndSendToUser(
                        userId.toString(),
                        "/queue/chat-updates", 
                        updateMessage
                    );
                    
                    // Also send to user's topic as fallback
                    messagingTemplate.convertAndSend(
                        "/topic/user." + userId + ".chat-updates",
                        updateMessage
                    );
                }
                
                log.info("Sent settings change notification to {} users for chat {}", chatUsers.size(), chatId);
            }
        } catch (Exception e) {
            log.error("Error sending chat settings change notification: {}", e.getMessage());
        }
    }
}