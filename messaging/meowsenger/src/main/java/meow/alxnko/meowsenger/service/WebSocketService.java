package meow.alxnko.meowsenger.service;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.AccessDeniedException;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import meow.alxnko.meowsenger.config.UserChannelInterceptor;
import meow.alxnko.meowsenger.config.UserChannelInterceptor.WebSocketDisconnectEvent;
import meow.alxnko.meowsenger.model.Chat;
import meow.alxnko.meowsenger.model.Message;
import meow.alxnko.meowsenger.model.User;
import meow.alxnko.meowsenger.model.WebSocketMessage;
import meow.alxnko.meowsenger.repository.ChatRepository;
import meow.alxnko.meowsenger.repository.MessageRepository;
import meow.alxnko.meowsenger.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessageSendingOperations;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Set;

/**
 * Service for WebSocket operations
 * Enhanced with Cloud Run compatibility
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketService {

    private final SimpMessageSendingOperations messagingTemplate;
    private final ChatRepository chatRepository;
    private final UserRepository userRepository;
    private final MessageService messageService;
    private final MessageRepository messageRepository;
    private final UserChannelInterceptor userChannelInterceptor;
    
    // Map to track active user sessions
    private final Map<String, Long> sessionUserMap = new ConcurrentHashMap<>();
    // Map to track which users are in which chat rooms
    private final Map<Long, Map<Long, String>> userChatSessions = new ConcurrentHashMap<>();
    // Map to track typing status
    private final Map<Long, Map<Long, LocalDateTime>> userTypingStatus = new ConcurrentHashMap<>();
    
    // Collection to track all active WebSocket subscriptions
    private final Set<WebSocketSubscription> registeredSubscriptions = ConcurrentHashMap.newKeySet();
    
    @Value("${spring.profiles.active:default}")
    private String activeProfile;
    
    /**
     * Inner class to represent a WebSocket subscription
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    private static class WebSocketSubscription {
        private String sessionId;
        private Long userId;
        private Long chatId;
        private String gameId;
        private LocalDateTime subscriptionTime;
    }
    
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
     * Subscribe a user to a chat
     * 
     * @param chatId The chat ID
     * @param userId The user ID
     * @param sessionId The session ID
     * @return WebSocketMessage with JOIN type
     */
    public WebSocketMessage subscribeUserToChat(Long chatId, Long userId, String sessionId) {
        // If this is a game message (chatId = 0 or message type contains GAME), 
        // we bypass the membership check
        boolean isGameRelated = chatId != null && chatId == 0;
        
        if (!isGameRelated) {
            // Only check membership for non-game messages
            try {
                // Verify that the user is a member of the chat before subscribing
                boolean isMember = chatRepository.isMember(chatId, userId);
                
                if (!isMember) {
                    log.error("User {} is not a member of chat {}, cannot subscribe", userId, chatId);
                    throw new AccessDeniedException("User is not a member of this chat");
                }
            } catch (Exception e) {
                log.error("Error verifying chat membership for user {} in chat {}: {}", 
                        userId, chatId, e.getMessage());
                throw new RuntimeException("Failed to verify chat membership", e);
            }
        }
        
        // Register this subscription in our tracking data
        registeredSubscriptions.add(
            WebSocketSubscription.builder()
                .sessionId(sessionId)
                .userId(userId)
                .chatId(chatId)
                .subscriptionTime(LocalDateTime.now())
                .build()
        );
        
        log.info("User {} subscribed to chat {}", userId, chatId);
        
        // Return confirmation message
        return WebSocketMessage.builder()
                .type(WebSocketMessage.MessageType.JOIN)
                .chatId(chatId)
                .userId(userId)
                .content("User subscribed to chat")
                .timestamp(LocalDateTime.now())
                .build();
    }
    
    /**
     * Process and send a regular message
     */
    @Transactional
    public WebSocketMessage processAndSendMessage(WebSocketMessage inputMessage) {
        Long chatId = inputMessage.getChatId();
        Long userId = inputMessage.getUserId();
        String content = inputMessage.getContent();
        Long replyToId = inputMessage.getReplyTo();
        
        // Check if this is a game message (chatId == 0 or GAME_MESSAGE type)
        if ((chatId != null && chatId == 0) || 
            (inputMessage.getType() != null && inputMessage.getType() == WebSocketMessage.MessageType.GAME_MESSAGE)) {
            log.info("Detected game message, using game-specific handler");
            return processGameMessage(inputMessage);
        }
        
        // Check if this is a forwarded message
        Boolean isForwarded = inputMessage.getIsForwarded();
        if (isForwarded != null && isForwarded) {
            log.info("Detected forwarded message, redirecting to dedicated handler");
            return processAndSendForwardedMessage(inputMessage);
        }
        
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
     * Process and send a forwarded message
     */
    @Transactional
    public WebSocketMessage processAndSendForwardedMessage(WebSocketMessage inputMessage) {
        Long chatId = inputMessage.getChatId();
        Long userId = inputMessage.getUserId();
        String content = inputMessage.getContent();
        Long replyToId = inputMessage.getReplyTo();
        
        log.info("Processing forwarded message: chat={}, user={}, content='{}'", chatId, userId, content);
        
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
        
        // Save message to database with isForwarded=true
        Message savedMessage = messageService.saveForwardedMessage(content, userId, chatId, replyToId);
        
        log.info("Saved forwarded message with ID: {}, isForwarded: {}", 
            savedMessage.getId(), savedMessage.isForwarded());
        
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
                .isForwarded(true)  // Explicitly set forwarded flag
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
        for (Long userId : new HashMap<>(chatUsers).keySet()) { // Create a copy to avoid concurrent modification
            // Double-check that user is still a member of the chat before sending messages
            // This helps prevent sending messages to users who were removed but still in the userChatSessions map
            if (!chatRepository.isUserInChat(chatId, userId)) {
                // User is no longer a member of this chat, remove them from the session
                String removedSessionId = chatUsers.remove(userId);
                if (removedSessionId != null) {
                    log.info("Removed user {} from chat {} active sessions (not a member anymore)", userId, chatId);
                }
                continue; // Skip sending message to this user
            }
            
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
     * Broadcast a message to all users in a chat
     */
    public void broadcastToChat(Long chatId, WebSocketMessage message) {
        if (chatId == null) {
            log.error("Cannot broadcast message: No chat ID provided");
            return;
        }
        
        // Send the message to all users in the chat including the sender
        sendMessageToAllUsers(chatId, message.getUserId(), message);
        
        // For important updates like member removal, also try sending to all active sessions
        // who may not be actively subscribed to the chat but need to know about the update
        if (message.getType() == WebSocketMessage.MessageType.CHAT_UPDATE && 
            "MEMBER_REMOVED".equals(message.getUpdateType())) {
            
            log.info("Broadcasting member removal update to all active users who are in chat {}", chatId);
            
            // Get all active user sessions
            for (Long userId : sessionUserMap.values()) {
                // Skip duplicates and the removed user
                if (userId == null || 
                    (message.getTargetUserId() != null && userId.equals(message.getTargetUserId()))) {
                    continue;
                }
                
                // Only send to users who are still members of the chat
                if (chatRepository.isUserInChat(chatId, userId)) {
                    try {
                        // Send update notification to this user
                        messagingTemplate.convertAndSendToUser(
                            userId.toString(),
                            "/queue/chat-updates", 
                            message
                        );
                        
                        // Also use topic as fallback
                        messagingTemplate.convertAndSend(
                            "/topic/user." + userId + ".chat-updates",
                            message
                        );
                        
                        log.debug("Sent member removal update to user {}", userId);
                    } catch (Exception e) {
                        log.error("Error sending removal update to user {}: {}", userId, e.getMessage());
                    }
                }
            }
        }
        
        log.info("Message broadcast to chat {}", chatId);
    }
    
    /**
     * Notify all chat members when a new member is added
     */
    public void notifyChatMemberAdded(Long chatId, Long addedByUserId, String addedUsername) {
        // Verify chat exists
        Chat chat = chatRepository.findById(chatId).orElse(null);
        if (chat == null) {
            log.error("Chat not found for memberAdded notification: {}", chatId);
            return;
        }
        
        // Get the user who added the member
        User addedBy = userRepository.findById(addedByUserId).orElse(null);
        if (addedBy == null) {
            log.error("User not found for memberAdded notification: {}", addedByUserId);
            return;
        }
        
        // Find the target user
        User targetUser = userRepository.findByUsername(addedUsername).orElse(null);
        if (targetUser == null) {
            log.error("Target user not found for memberAdded notification: {}", addedUsername);
            return;
        }
        
        // Create notification message
        String content = addedBy.getUsername() + " added " + addedUsername + " to the group";
        
        // Create update message for the UI
        WebSocketMessage updateMessage = WebSocketMessage.builder()
                .type(WebSocketMessage.MessageType.CHAT_UPDATE)
                .updateType("MEMBER_ADDED")
                .chatId(chatId)
                .userId(addedByUserId)
                .username(addedBy.getUsername())
                .content(content)
                .timestamp(LocalDateTime.now())
                .targetUserId(targetUser.getId())
                .targetUsername(addedUsername)
                .isGroup(chat.isGroup())
                .chatName(chat.getName())
                .build();
                
        // Send notification to all members of the chat
        broadcastToChat(chatId, updateMessage);
                
        // Send a special notification to the added user
        WebSocketMessage newChatMessage = WebSocketMessage.builder()
                .type(WebSocketMessage.MessageType.CHAT_UPDATE)
                .updateType("NEW_CHAT")
                .chatId(chatId)
                .userId(addedByUserId)
                .username(addedBy.getUsername())
                .content("You were added to " + chat.getName())
                .timestamp(LocalDateTime.now())
                .isGroup(chat.isGroup())
                .chatName(chat.getName())
                .build();
                
        // Send to the specific target user's personal channel
        messagingTemplate.convertAndSendToUser(
            targetUser.getId().toString(),
            "/queue/chat-updates",
            newChatMessage
        );
    }
    
    /**
     * Notify all chat members and the removed user when someone is removed
     */
    @Transactional
    public void notifyUserRemoved(Long chatId, Long removedByUserId, String removedByUsername, 
                                 Long targetUserId, String targetUsername) {
        log.info("Sending user removal notification: {} removed {} from {}", 
                removedByUsername, targetUsername, chatId);
        
        // Verify chat exists
        Chat chat = chatRepository.findById(chatId).orElse(null);
        if (chat == null) {
            log.error("Chat not found for user removal notification: {}", chatId);
            return;
        }
        
        // Get the user who removed the member
        User removedBy = userRepository.findById(removedByUserId).orElse(null);
        if (removedBy == null) {
            log.error("User not found for user removal notification: {}", removedByUserId);
            return;
        }
        
        // Find the target user
        User targetUser = userRepository.findById(targetUserId).orElse(null);
        if (targetUser == null) {
            log.error("Target user not found for user removal notification: {}", targetUserId);
            return;
        }
        
        // Create system message content
        String content = removedByUsername + " removed " + targetUsername + " from the group";
        
        // Create and save system message
        Message systemMessage = new Message();
        systemMessage.setChat(chat);
        systemMessage.setUser(removedBy);
        systemMessage.setText(content);
        systemMessage.setSystem(true);
        systemMessage.setSendTime(LocalDateTime.now());
        Message savedMessage = messageRepository.save(systemMessage);
        
        log.info("Created system message for user removal: {}", savedMessage.getId());
        
        // First, create and send a regular chat message
        WebSocketMessage chatMessage = WebSocketMessage.builder()
                .type(WebSocketMessage.MessageType.CHAT)
                .chatId(chatId)
                .userId(removedByUserId)
                .username(removedByUsername)
                .content(content)
                .timestamp(savedMessage.getSendTime())
                .messageId(savedMessage.getId())
                .isSystem(true)
                .isGroup(chat.isGroup())
                .chatName(chat.getName())
                .build();
                
        // Send the chat message to all current members
        broadcastToChat(chatId, chatMessage);
        
        // Second, create a special update notification for UI updates
        WebSocketMessage updateMessage = WebSocketMessage.builder()
                .type(WebSocketMessage.MessageType.CHAT_UPDATE)
                .updateType("MEMBER_REMOVED")
                .chatId(chatId)
                .userId(removedByUserId)
                .username(removedByUsername)
                .content(content)
                .timestamp(LocalDateTime.now())
                .targetUserId(targetUserId)
                .targetUsername(targetUsername)
                .isGroup(chat.isGroup())
                .chatName(chat.getName())
                .build();
                
        // Send the update to all members (including the one being removed)
        broadcastToChat(chatId, updateMessage);
        
        // Third, send a special notification to the removed user's personal channel
        // This ensures they're notified even if offline when the broadcast happened
        WebSocketMessage personalMessage = WebSocketMessage.builder()
                .type(WebSocketMessage.MessageType.CHAT_UPDATE)
                .updateType("MEMBER_REMOVED")
                .chatId(chatId)
                .userId(removedByUserId) 
                .username(removedByUsername)
                .content("You were removed from " + chat.getName())
                .timestamp(LocalDateTime.now())
                .targetUserId(targetUserId)
                .targetUsername(targetUsername)
                .isGroup(chat.isGroup())
                .chatName(chat.getName())
                .build();
                
        // Send to the specific target user's personal channel
        messagingTemplate.convertAndSendToUser(
            targetUserId.toString(),
            "/queue/chat-updates",
            personalMessage
        );
        
        // Actually remove the user from the chat in the database
        chatRepository.removeUserFromChat(chatId, targetUserId);
        
        log.info("Successfully sent all user removal notifications and removed user from chat");
        
        // First, send a special direct removal notification to the removed user 
        // with clear instructions to redirect to home
        try {
            messagingTemplate.convertAndSendToUser(
                targetUserId.toString(),
                "/queue/chat-updates", 
                updateMessage
            );
            
            // Send to topic as well for redundancy
            messagingTemplate.convertAndSend(
                "/topic/user." + targetUserId + ".chat-updates",
                updateMessage
            );
            
            log.info("Sent direct removal notification to user {}", targetUserId);
            
            // Now broadcast message to remaining chat members
            for (Long userId : sessionUserMap.values()) {
                // Skip duplicates and the removed user
                if (userId == null || userId.equals(targetUserId)) {
                    continue;
                }
                
                // Only send to actual chat members
                if (chatRepository.isUserInChat(chatId, userId)) {
                    try {
                        // Send both message types to ensure delivery
                        messagingTemplate.convertAndSendToUser(
                            userId.toString(),
                            "/queue/chat." + chatId, 
                            chatMessage
                        );
                        
                        messagingTemplate.convertAndSendToUser(
                            userId.toString(),
                            "/queue/chat-updates", 
                            updateMessage
                        );
                        
                        log.debug("Sent removal notifications to user {}", userId);
                    } catch (Exception e) {
                        log.error("Error sending removal notifications to user {}: {}", userId, e.getMessage());
                    }
                }
            }
            
            // Actually remove the user from the chat in the database
            chatRepository.removeUserFromChat(chatId, targetUserId);
            
            log.info("Successfully removed user {} from chat {}", targetUserId, chatId);
        } catch (Exception e) {
            log.error("Error processing user removal: {}", e.getMessage());
        }
    }
    
    /**
     * Send notification about chat settings changes to all members
     */
    @Transactional
    public void notifyChatSettingsChanged(Long chatId, Long changedByUserId, String changedByUsername, 
                                         String newChatName, String description, String updateMessage) {
        try {
            // Get chat details
            Chat chat = chatRepository.findById(chatId).orElse(null);
            if (chat == null) {
                log.error("Chat not found when notifying about settings change");
                return;
            }
            
            // Get user who made the change
            User changedByUser = userRepository.findById(changedByUserId).orElse(null);
            if (changedByUser == null) {
                log.error("User {} not found when notifying about settings change", changedByUserId);
                return;
            }
            
            // Use provided username or fallback to the user's actual username
            String username = changedByUsername != null ? changedByUsername : changedByUser.getUsername();
            
            // Create update message with all the settings data
            WebSocketMessage settingsUpdateMessage = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.CHAT_UPDATE)
                    .updateType("SETTINGS_CHANGED")
                    .chatId(chatId)
                    .userId(changedByUserId)
                    .username(username)
                    .content(description) // Use content for description
                    .timestamp(LocalDateTime.now())
                    .isGroup(chat.isGroup())
                    .chatName(newChatName) // Use the new chat name
                    .updateMessage(updateMessage) // Message about what changed
                    .build();
            
            // Broadcast to all chat members
            broadcastToChat(chatId, settingsUpdateMessage);
            
            log.info("Sent chat settings change notification for chat {}: {}", chatId, updateMessage);
        } catch (Exception e) {
            log.error("Error sending chat settings change notification: {}", e.getMessage());
        }
    }
    
    /**
     * Send notification about chat settings changes to all members
     * (Overloaded method for backward compatibility)
     */
    @Transactional
    public void notifyChatSettingsChanged(Long chatId, Long changedByUserId, String updateMessage) {
        try {
            // Get user who made the change
            User changedByUser = userRepository.findById(changedByUserId).orElse(null);
            if (changedByUser == null) {
                log.error("User {} not found when notifying about settings change", changedByUserId);
                return;
            }
            
            // Call the full method with default values
            notifyChatSettingsChanged(
                chatId, 
                changedByUserId, 
                changedByUser.getUsername(),
                null, // No new chat name
                updateMessage, // Use update message as description
                updateMessage  // And as update message
            );
        } catch (Exception e) {
            log.error("Error sending chat settings change notification: {}", e.getMessage());
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
            
            // Get user who made the change
            User changedByUser = userRepository.findById(changedByUserId).orElse(null);
            if (changedByUser == null) {
                log.error("User {} not found when notifying admin status change", changedByUserId);
                changedByUsername = changedByUsername != null ? changedByUsername : "Unknown user";
            } else if (changedByUsername == null) {
                changedByUsername = changedByUser.getUsername();
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
                    
            // Save the system message directly
            Message savedMessage = messageService.saveMessage(
                content, 
                changedByUserId, 
                chatId, 
                null
            );
            
            // Update the system message with the saved message ID
            systemMessage.setMessageId(savedMessage.getId());
                    
            // First try sending to active subscribers
            sendMessageToAllUsers(chatId, changedByUserId, systemMessage);
            
            // Build the CHAT_UPDATE notification for UI updates
            WebSocketMessage statusUpdateMessage = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.CHAT_UPDATE)
                    .chatId(chatId)
                    .userId(changedByUserId)
                    .username(changedByUsername)
                    .timestamp(LocalDateTime.now())
                    .updateType("ADMIN_CHANGED")
                    .isGroup(chat.isGroup())
                    .chatName(chat.getName())
                    .targetUserId(targetUserId)
                    .targetUsername(targetUsername)
                    .isPromotion(isPromotion)
                    .content(content) // Include content for context
                    .build();
            
            // Get all active user sessions (regardless of chat subscription)
            for (Long userId : sessionUserMap.values()) {
                // Skip duplicates
                if (userId == null) continue;
                
                // Check if user is member of the chat
                if (chatRepository.isUserInChat(chatId, userId)) {
                    try {
                        // Send both the system message and the update notification
                        // System message (for the chat feed)
                        messagingTemplate.convertAndSendToUser(
                            userId.toString(),
                            "/queue/chat." + chatId, 
                            systemMessage
                        );
                        
                        // Update notification (for UI updates)
                        messagingTemplate.convertAndSendToUser(
                            userId.toString(),
                            "/queue/chat-updates", 
                            statusUpdateMessage
                        );
                        
                        // Also use broadcast topics as fallback
                        messagingTemplate.convertAndSend(
                            "/topic/user." + userId + ".chat." + chatId,
                            systemMessage
                        );
                        
                        messagingTemplate.convertAndSend(
                            "/topic/user." + userId + ".chat-updates",
                            statusUpdateMessage
                        );
                        
                        log.debug("Sent admin change notifications to user {}", userId);
                    } catch (Exception e) {
                        log.error("Error sending admin notifications to user {}: {}", userId, e.getMessage());
                    }
                }
            }
            
            log.info("Admin status change notifications sent for chat {}", chatId);
        } catch (Exception e) {
            log.error("Error sending admin status change notification: {}", e.getMessage());
        }
    }
    
    /**
     * Send a message to a specific chat room
     */
    public void sendMessage(WebSocketMessage message) {
        String destination = getTopicDestination(message.getChatId());
        log.debug("Sending message to {}: {}", destination, message);
        
        try {
            messagingTemplate.convertAndSend(destination, message);
            log.debug("Message sent successfully to {}", destination);
        } catch (Exception e) {
            log.error("Failed to send message to {}: {}", destination, e.getMessage());
        }
    }
    
    /**
     * Send a typing indicator to a specific chat room
     */
    public void sendTypingIndicator(WebSocketMessage message) {
        String destination = getTypingDestination(message.getChatId());
        log.debug("Sending typing indicator to {}: {}", destination, message);
        
        try {
            messagingTemplate.convertAndSend(destination, message);
            log.debug("Typing indicator sent successfully to {}", destination);
        } catch (Exception e) {
            log.error("Failed to send typing indicator to {}: {}", e.getMessage());
        }
    }
    
    /**
     * Send a message to a specific user
     * Enhanced to be more resilient in Cloud Run environment
     */
    public void sendPrivateMessage(WebSocketMessage message, Long userId) {
        String destination = getPrivateDestination(userId);
        log.debug("Sending private message to {}: {}", destination, message);
        
        try {
            // Add retry logic for Cloud Run environment
            if ("prod".equals(activeProfile)) {
                sendWithRetry(destination, message);
            } else {
                messagingTemplate.convertAndSendToUser(userId.toString(), 
                                                      "/queue/messages", 
                                                      message);
            }
            log.debug("Private message sent successfully to user {}", userId);
        } catch (Exception e) {
            log.error("Failed to send private message to user {}: {}", userId, e.getMessage());
        }
    }
    
    /**
     * Send with retry logic for Cloud Run environment
     */
    private void sendWithRetry(String destination, WebSocketMessage message) {
        int maxRetries = 3;
        int retryCount = 0;
        boolean sent = false;
        
        while (!sent && retryCount < maxRetries) {
            try {
                messagingTemplate.convertAndSend(destination, message);
                sent = true;
                log.debug("Message sent successfully to {} on attempt {}", destination, retryCount + 1);
            } catch (Exception e) {
                retryCount++;
                log.warn("Failed to send message to {} on attempt {}: {}", 
                        destination, retryCount, e.getMessage());
                
                if (retryCount < maxRetries) {
                    try {
                        Thread.sleep(500 * retryCount); // Exponential backoff
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                    }
                }
            }
        }
        
        if (!sent) {
            log.error("Failed to send message to {} after {} attempts", destination, maxRetries);
        }
    }
    
    /**
     * Get topic destination for a chat room
     */
    public String getTopicDestination(Long chatId) {
        return "/topic/chat." + chatId;
    }
    
    /**
     * Get typing destination for a chat room
     */
    public String getTypingDestination(Long chatId) {
        return "/topic/typing." + chatId;
    }
    
    /**
     * Get private destination for a user
     */
    public String getPrivateDestination(Long userId) {
        return "/user/" + userId + "/queue/messages";
    }
    
    /**
     * Send a message to a specific user with any object type as payload
     * Used for game-related messages and other non-WebSocketMessage communications
     * 
     * @param userId The ID of the user to send the message to
     * @param destination The destination sub-path (e.g., "/queue/games")
     * @param payload The payload to send (can be any object)
     */
    public <T> void sendToUser(Long userId, String destination, T payload) {
        String userDestination = "/user/" + userId + destination;
        messagingTemplate.convertAndSend(userDestination, payload);
        log.debug("Sent message to user destination: {}", userDestination);
    }
    
    /**
     * Get a game-specific topic destination
     */
    public String getGameTopicDestination(String gameId) {
        return "/topic/game." + gameId;
    }
    
    /**
     * Get a user-specific game destination
     */
    public String getGameUserDestination(Long userId) {
        return "/user/" + userId + "/queue/game-events";
    }
    
    /**
     * Subscribe a user to game events, bypassing chat membership checks
     * 
     * @param gameId The game ID
     * @param userId The user ID
     * @param sessionId The session ID
     * @return WebSocketMessage with JOIN type
     */
    public WebSocketMessage subscribeToGameEvents(String gameId, Long userId, String sessionId) {
        if (gameId == null || gameId.trim().isEmpty()) {
            log.error("Cannot subscribe to game events: game ID is null or empty");
            throw new IllegalArgumentException("Game ID cannot be null or empty");
        }
        
        // Register this subscription in our tracking data
        registeredSubscriptions.add(
            WebSocketSubscription.builder()
                .sessionId(sessionId)
                .userId(userId)
                .chatId(0L) // Use chatId=0 for games
                .gameId(gameId) // Store the game ID
                .subscriptionTime(LocalDateTime.now())
                .build()
        );
        
        log.info("User {} subscribed to game events for game {}", userId, gameId);
        
        // Get the username
        String username = userRepository.findById(userId)
            .map(User::getUsername)
            .orElse("Unknown");
        
        // Return confirmation message
        return WebSocketMessage.builder()
                .type(WebSocketMessage.MessageType.GAME_JOIN)
                .chatId(0L) // Use chatId=0 for games
                .userId(userId)
                .username(username)
                .gameId(gameId) // Include the game ID
                .content("User subscribed to game events")
                .timestamp(LocalDateTime.now())
                .build();
    }
    
    /**
     * Broadcast a game message to all subscribers of a game topic
     * 
     * @param message The message to broadcast
     */
    public void broadcastGameMessage(WebSocketMessage message) {
        // For game messages, always set type to GAME_MESSAGE if not already a game type
        if (!message.getType().name().startsWith("GAME_")) {
            message.setType(WebSocketMessage.MessageType.GAME_MESSAGE);
        }
        
        // Set chatId to 0 for game messages
        message.setChatId(0L);
        
        // Set isGameMessage flag
        message.setIsGameMessage(true);
        
        // Set timestamp if not already set
        if (message.getTimestamp() == null) {
            message.setTimestamp(LocalDateTime.now());
        }
        
        // Get the game ID from the message
        String gameId = message.getGameId();
        if (gameId == null && message.getContent() != null) {
            // Try to extract from content if needed
            try {
                if (message.getContent().startsWith("{")) {
                    // Crude JSON extraction - in production use a proper JSON parser
                    int start = message.getContent().indexOf("\"gameId\":");
                    if (start > 0) {
                        int valueStart = message.getContent().indexOf("\"", start + 9) + 1;
                        int valueEnd = message.getContent().indexOf("\"", valueStart);
                        if (valueStart > 0 && valueEnd > valueStart) {
                            gameId = message.getContent().substring(valueStart, valueEnd);
                        }
                    }
                }
            } catch (Exception e) {
                log.error("Error extracting game ID from message content", e);
            }
        }
        
        if (gameId == null) {
            log.error("Cannot broadcast game message: game ID is not specified");
            return;
        }
        
        // Broadcast to the game topic
        String destination = "/topic/game." + gameId;
        messagingTemplate.convertAndSend(destination, message);
        
        log.debug("Broadcast game message to {}: {}", destination, message);
    }

    /**
     * Process a game-specific message
     * This bypasses chat membership checks and other chat-specific logic
     */
    private WebSocketMessage processGameMessage(WebSocketMessage inputMessage) {
        Long userId = inputMessage.getUserId();
        
        // Validate the user exists
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return createErrorMessage("User not found");
        }
        
        // For game messages, we need to extract the game ID from the content
        String gameId = null;
        try {
            // Try to parse the content as JSON to extract gameId
            if (inputMessage.getContent() != null && inputMessage.getContent().contains("gameId")) {
                // Simple extraction - in production use a proper JSON parser
                String content = inputMessage.getContent();
                int gameIdStart = content.indexOf("\"gameId\":");
                if (gameIdStart >= 0) {
                    int valueStart = content.indexOf("\"", gameIdStart + 9) + 1;
                    int valueEnd = content.indexOf("\"", valueStart);
                    if (valueStart > 0 && valueEnd > valueStart) {
                        gameId = content.substring(valueStart, valueEnd);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error extracting game ID from content", e);
        }
        
        // Always set chatId to 0 for game messages
        inputMessage.setChatId(0L);
        
        // Set timestamp if not present
        if (inputMessage.getTimestamp() == null) {
            inputMessage.setTimestamp(LocalDateTime.now());
        }
        
        // Set username if not present
        if (inputMessage.getUsername() == null) {
            inputMessage.setUsername(user.getUsername());
        }
        
        // If gameId was extracted, set it in the message
        if (gameId != null) {
            inputMessage.setGameId(gameId);
        }
        
        // Broadcast to appropriate topic
        // If we have a game ID, send to the game-specific topic
        if (gameId != null) {
            String destination = "/topic/game." + gameId;
            messagingTemplate.convertAndSend(destination, inputMessage);
            log.info("Game message sent to {}", destination);
        } else {
            // Otherwise try to extract recipient info and send to their queue
            Long recipientId = extractRecipientId(inputMessage.getContent());
            if (recipientId != null) {
                messagingTemplate.convertAndSendToUser(
                    recipientId.toString(),
                    "/queue/game-events",
                    inputMessage
                );
                log.info("Game message sent to user {}", recipientId);
            } else {
                log.warn("Could not determine destination for game message");
            }
        }
        
        return inputMessage;
    }
    
    /**
     * Extract recipient ID from message content
     */
    private Long extractRecipientId(String content) {
        if (content == null) return null;
        
        try {
            // Simple extraction - in production use a proper JSON parser
            int recipientIdStart = content.indexOf("\"recipientId\":");
            if (recipientIdStart >= 0) {
                int valueStart = recipientIdStart + 14; // Length of "recipientId":
                int valueEnd = content.indexOf(",", valueStart);
                if (valueEnd < 0) {
                    valueEnd = content.indexOf("}", valueStart);
                }
                
                if (valueEnd > valueStart) {
                    String idStr = content.substring(valueStart, valueEnd).trim();
                    return Long.parseLong(idStr);
                }
            }
        } catch (Exception e) {
            log.error("Error extracting recipient ID", e);
        }
        
        return null;
    }
}