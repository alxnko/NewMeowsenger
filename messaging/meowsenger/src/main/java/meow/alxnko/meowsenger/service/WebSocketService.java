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
import meow.alxnko.meowsenger.repository.MessageRepository;
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
    private final MessageRepository messageRepository;
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
}