package meow.alxnko.meowsenger.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import meow.alxnko.meowsenger.model.Chat;
import meow.alxnko.meowsenger.model.Message;
import meow.alxnko.meowsenger.model.User;
import meow.alxnko.meowsenger.model.WebSocketMessage;
import meow.alxnko.meowsenger.repository.ChatRepository;
import meow.alxnko.meowsenger.repository.MessageRepository;
import meow.alxnko.meowsenger.repository.UserRepository;
import meow.alxnko.meowsenger.service.MessageService;
import meow.alxnko.meowsenger.service.WebSocketService;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Controller
@RequiredArgsConstructor
@Slf4j
public class WebSocketController {

    private final WebSocketService webSocketService;
    private final MessageService messageService;
    private final ChatRepository chatRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;

    /**
     * Handle ping messages for connection health monitoring
     */
    @MessageMapping("/ping")
    public void handlePing() {
        // Just log at debug level to avoid too much noise in the logs
        log.debug("Received ping from client");
        // No response needed - the fact that the message was processed indicates the connection is alive
    }

    /**
     * Handle user registration when they connect with WebSocket
     */
    @MessageMapping("/register")
    public WebSocketMessage registerUser(@Payload WebSocketMessage message, SimpMessageHeaderAccessor headerAccessor) {
        // Store user ID in WebSocket session
        String sessionId = headerAccessor.getSessionId();
        webSocketService.registerUserSession(sessionId, message.getUserId());
        
        // Return a confirmation message that won't be broadcast to other users
        return WebSocketMessage.builder()
                .type(WebSocketMessage.MessageType.JOIN)
                .userId(message.getUserId())
                .content("Registration successful")
                .timestamp(java.time.LocalDateTime.now())
                .build();
    }
    
    /**
     * Handle chat subscription
     */
    @MessageMapping("/chat.subscribe")
    public WebSocketMessage subscribeToChat(@Payload WebSocketMessage message, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        return webSocketService.subscribeUserToChat(message.getChatId(), message.getUserId(), sessionId);
    }
    
    /**
     * Handle batch subscription to multiple chats
     */
    @MessageMapping("/chats.subscribe")
    public Map<Long, WebSocketMessage> subscribeToMultipleChats(@Payload List<Long> chatIds, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        Long userId = webSocketService.getUserIdFromSession(sessionId);
        
        if (userId == null) {
            log.error("User not registered for session {}", sessionId);
            throw new IllegalStateException("User must be registered before subscribing to chats");
        }
        
        // Subscribe to each chat and collect the results
        return chatIds.stream()
                .collect(Collectors.toMap(
                        chatId -> chatId,
                        chatId -> webSocketService.subscribeUserToChat(chatId, userId, sessionId),
                        (existing, replacement) -> existing
                ));
    }
    
    /**
     * Handle sending chat messages
     */
    @MessageMapping("/chat.send")
    public WebSocketMessage sendMessage(@Payload WebSocketMessage message) {
        log.debug("Received regular message via WebSocket: {}", message);
        return webSocketService.processAndSendMessage(message);
    }
    
    /**
     * Handle forwarding messages
     */
    @MessageMapping("/chat.forward")
    public WebSocketMessage forwardMessage(@Payload WebSocketMessage message) {
        log.info("Received forwarded message via WebSocket: {}", message);
        
        // Explicitly set isForwarded to true
        message.setIsForwarded(true);
        
        return webSocketService.processAndSendForwardedMessage(message);
    }
    
    /**
     * Handle user typing notifications
     */
    @MessageMapping("/chat.typing")
    public void userTyping(@Payload WebSocketMessage message) {
        if (message.getChatId() != null && message.getUserId() != null) {
            webSocketService.notifyTyping(message.getChatId(), message.getUserId());
        }
    }
    
    /**
     * Handle message editing
     */
    @MessageMapping("/chat.edit")
    public WebSocketMessage editMessage(@Payload WebSocketMessage message) {
        try {
            // Verify the required fields are present
            if (message.getMessageId() == null || message.getUserId() == null || message.getContent() == null) {
                return createErrorResponse("Invalid request parameters");
            }
            
            // Edit the message in the database
            Message editedMessage = messageService.editMessage(message.getMessageId(), message.getContent(), message.getUserId());
            
            // Create response with updated message data
            WebSocketMessage response = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.CHAT)
                    .messageId(editedMessage.getId())
                    .userId(editedMessage.getUser().getId())
                    .username(editedMessage.getUser().getUsername())
                    .chatId(editedMessage.getChat().getId())
                    .content(editedMessage.getText())
                    .timestamp(editedMessage.getSendTime())
                    .isEdited(editedMessage.isEdited())
                    .isDeleted(editedMessage.isDeleted())
                    .isSystem(editedMessage.isSystem())
                    .isForwarded(editedMessage.isForwarded())
                    .replyTo(editedMessage.getReplyTo())
                    .build();
            
            // Broadcast the updated message to all users in the chat
            webSocketService.broadcastMessageUpdate(response);
            
            return response;
        } catch (Exception e) {
            log.error("Error editing message: {}", e.getMessage());
            return createErrorResponse("Failed to edit message: " + e.getMessage());
        }
    }
    
    /**
     * Handle message deletion
     */
    @MessageMapping("/chat.delete")
    public WebSocketMessage deleteMessage(@Payload WebSocketMessage message) {
        try {
            // Verify the required fields are present
            if (message.getMessageId() == null || message.getUserId() == null) {
                return createErrorResponse("Invalid request parameters");
            }
            
            // Delete the message in the database (soft-delete)
            Message deletedMessage = messageService.deleteMessage(message.getMessageId(), message.getUserId());
            
            // Create response with deleted message data
            WebSocketMessage response = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.CHAT)
                    .messageId(deletedMessage.getId())
                    .userId(deletedMessage.getUser().getId())
                    .username(deletedMessage.getUser().getUsername())
                    .chatId(deletedMessage.getChat().getId())
                    .content(deletedMessage.getText())
                    .timestamp(deletedMessage.getSendTime())
                    .isEdited(deletedMessage.isEdited())
                    .isDeleted(true)
                    .isSystem(deletedMessage.isSystem())
                    .isForwarded(deletedMessage.isForwarded())
                    .replyTo(deletedMessage.getReplyTo())
                    .build();
            
            // Broadcast the deleted message to all users in the chat
            webSocketService.broadcastMessageUpdate(response);
            
            return response;
        } catch (Exception e) {
            log.error("Error deleting message: {}", e.getMessage());
            return createErrorResponse("Failed to delete message: " + e.getMessage());
        }
    }
    
    /**
     * Handle marking messages as read
     */
    @MessageMapping("/chat.read")
    public void markAsRead(@Payload WebSocketMessage message) {
        // Extract message ID and user ID from the message
        if (message.getMessageId() != null && message.getUserId() != null) {
            webSocketService.markMessageAsRead(message.getMessageId(), message.getUserId());
        }
    }
    
    /**
     * Handle admin status change notifications
     */
    @MessageMapping("/chat.admin-changed")
    public void adminStatusChanged(@Payload WebSocketMessage message) {
        if (message.getChatId() == null || message.getUserId() == null || 
            message.getTargetUserId() == null || message.getTargetUsername() == null) {
            log.error("Invalid admin status change message: missing required fields");
            return;
        }
        
        log.info("Received admin status change message from WebSocket: {} -> {}, isPromotion: {}", 
                message.getUserId(), message.getTargetUsername(), message.getIsPromotion());
                
        webSocketService.notifyAdminStatusChanged(
            message.getChatId(),
            message.getUserId(),
            message.getUsername(), // sender's username
            message.getTargetUserId(),
            message.getTargetUsername(),
            message.getIsPromotion() != null ? message.getIsPromotion() : false
        );
    }
    
    /**
     * Handle admin status change requests directly from frontend
     */
    @MessageMapping("/chat.admin-change")
    @Transactional
    public void handleAdminStatusChange(@Payload WebSocketMessage message) {
        try {
            if (message.getChatId() == null || message.getUserId() == null || 
                message.getTargetUserId() == null || message.getTargetUsername() == null) {
                log.error("Invalid admin change message: missing required fields");
                return;
            }
            
            Long chatId = message.getChatId();
            Long userId = message.getUserId();
            String username = message.getUsername();
            Long targetUserId = message.getTargetUserId();
            String targetUsername = message.getTargetUsername();
            boolean isPromotion = message.getIsPromotion() != null ? message.getIsPromotion() : false;
            
            log.info("Processing admin status change via WebSocket: {} {} {} {}", 
                username, isPromotion ? "promoting" : "demoting", targetUsername, chatId);
            
            // Verify that the user has permission to change admin status
            Chat chat = chatRepository.findById(chatId).orElse(null);
            if (chat == null) {
                log.error("Chat not found: {}", chatId);
                return;
            }
            
            // Need to get user object from repository
            User user = userRepository.findById(userId).orElse(null);
            if (user == null) {
                log.error("User not found: {}", userId);
                return;
            }
            
            // If username wasn't provided in the message, try to get it from the user object
            if (username == null || username.trim().isEmpty()) {
                username = user.getUsername();
                log.info("Using username from user object: {}", username);
            }
            
            // Verify that the user is an admin
            if (!chatRepository.isUserAdmin(chatId, userId)) {
                log.error("User {} is not an admin in chat {}", userId, chatId);
                return;
            }
            
            // Verify that target user is in the chat
            if (!chatRepository.isUserInChat(chatId, targetUserId)) {
                log.error("Target user {} is not in chat {}", targetUserId, chatId);
                return;
            }
            
            // Update the admin status in the database
            if (isPromotion) {
                // Add admin status
                chatRepository.addUserAsAdmin(chatId, targetUserId);
            } else {
                // Remove admin status
                chatRepository.removeUserAsAdmin(chatId, targetUserId);
            }
            
            // Create system message content
            String content = isPromotion 
                ? username + " made " + targetUsername + " an admin" 
                : username + " removed admin rights from " + targetUsername;
                
            // Create and save system message
            Message systemMessage = new Message();
            systemMessage.setChat(chat);
            systemMessage.setUser(user); // Use setUser instead of setUserId
            systemMessage.setText(content);
            systemMessage.setSystem(true);
            systemMessage.setSendTime(java.time.LocalDateTime.now());
            Message savedMessage = messageRepository.save(systemMessage);
            
            log.info("Created system message for admin change: {}", savedMessage.getId());
            
            // Now notify all users about the admin status change
            WebSocketMessage notification = new WebSocketMessage();
            notification.setType(WebSocketMessage.MessageType.CHAT_UPDATE);
            notification.setUpdateType("ADMIN_CHANGED");
            notification.setChatId(chatId);
            notification.setUserId(userId);
            notification.setUsername(username);
            notification.setTargetUserId(targetUserId);
            notification.setTargetUsername(targetUsername);
            notification.setContent(content);
            notification.setTimestamp(java.time.LocalDateTime.now());
            notification.setIsPromotion(isPromotion);
            notification.setMessageId(savedMessage.getId());
            
            webSocketService.broadcastToChat(chatId, notification);
            
            // Additionally send a regular chat message for the system message
            WebSocketMessage chatMsg = new WebSocketMessage();
            chatMsg.setType(WebSocketMessage.MessageType.CHAT);
            chatMsg.setChatId(chatId);
            chatMsg.setUserId(userId);
            chatMsg.setUsername(username);
            chatMsg.setContent(content);
            chatMsg.setTimestamp(savedMessage.getSendTime());
            chatMsg.setMessageId(savedMessage.getId());
            chatMsg.setIsSystem(true);
            
            webSocketService.broadcastToChat(chatId, chatMsg);
            
            log.info("Admin status change processed successfully");
        } catch (Exception e) {
            log.error("Error processing admin status change: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Handle member removed notifications
     */
    @MessageMapping("/chat.member-removed")
    @Transactional
    public void handleMemberRemoved(@Payload WebSocketMessage message) {
        log.info("Received member removed notification: {}", message);
        
        if (message.getChatId() == null || message.getUserId() == null || 
            (message.getTargetUserId() == null && message.getTargetUsername() == null)) {
            log.error("Invalid member removed message: missing required fields");
            return;
        }
        
        // Verify the chat exists
        Chat chat = chatRepository.findById(message.getChatId()).orElse(null);
        if (chat == null) {
            log.error("Chat not found for member removed notification: {}", message.getChatId());
            return;
        }
        
        // Verify the user has permission (is admin)
        User user = userRepository.findById(message.getUserId()).orElse(null);
        if (user == null) {
            log.error("User not found for member removed notification: {}", message.getUserId());
            return;
        }
        
        // Check if user is admin in this chat
        if (!chatRepository.isUserAdmin(message.getChatId(), message.getUserId())) {
            log.error("User {} is not admin in chat {}", message.getUserId(), message.getChatId());
            return;
        }
        
        // Find the target user
        User targetUser = null;
        if (message.getTargetUserId() != null && message.getTargetUserId() > 0) {
            targetUser = userRepository.findById(message.getTargetUserId()).orElse(null);
        } else if (message.getTargetUsername() != null) {
            targetUser = userRepository.findByUsername(message.getTargetUsername()).orElse(null);
        }
        
        if (targetUser == null) {
            log.error("Target user not found for member removed notification");
            return;
        }
        
        // Check if the target user is actually a member of the chat
        if (!chatRepository.isUserInChat(message.getChatId(), targetUser.getId())) {
            log.error("Target user {} is not in chat {}", targetUser.getId(), message.getChatId());
            return;
        }
        
        // Now that we've validated everything, we can send the notification
        webSocketService.notifyUserRemoved(
            message.getChatId(),
            message.getUserId(),
            message.getUsername() != null ? message.getUsername() : user.getUsername(),
            targetUser.getId(),
            targetUser.getUsername()
        );
        
        log.info("Successfully processed member removed notification");
    }
    
    /**
     * Handle member added notifications
     */
    @MessageMapping("/chat.member-added")
    public void handleMemberAdded(@Payload WebSocketMessage message) {
        log.info("Received member added notification: {}", message);
        
        if (message.getChatId() == null || message.getUserId() == null || 
            message.getTargetUsername() == null) {
            log.error("Invalid member added message: missing required fields");
            return;
        }
        
        // Verify the chat exists
        Chat chat = chatRepository.findById(message.getChatId()).orElse(null);
        if (chat == null) {
            log.error("Chat not found for member added notification: {}", message.getChatId());
            return;
        }
        
        // Verify the user has permission (is admin)
        User user = userRepository.findById(message.getUserId()).orElse(null);
        if (user == null) {
            log.error("User not found for member added notification: {}", message.getUserId());
            return;
        }
        
        // Check if user is admin in this chat
        if (!chatRepository.isUserAdmin(message.getChatId(), message.getUserId())) {
            log.error("User {} is not admin in chat {}", message.getUserId(), message.getChatId());
            return;
        }
        
        // Find the target user
        User targetUser = null;
        if (message.getTargetUserId() != null && message.getTargetUserId() > 0) {
            targetUser = userRepository.findById(message.getTargetUserId()).orElse(null);
        } else if (message.getTargetUsername() != null) {
            targetUser = userRepository.findByUsername(message.getTargetUsername()).orElse(null);
        }
        
        if (targetUser == null) {
            log.error("Target user not found for member added notification");
            return;
        }
        
        // Generate system message about the addition
        String content = (message.getUsername() != null ? message.getUsername() : user.getUsername()) + 
                         " added " + targetUser.getUsername() + " to the group";
        
        // Save system message to database
        Message systemMessage = new Message();
        systemMessage.setChat(chat);
        systemMessage.setUser(user);
        systemMessage.setText(content);
        systemMessage.setSystem(true); // Mark as system message
        systemMessage.setSendTime(java.time.LocalDateTime.now());
        Message savedMessage = messageRepository.save(systemMessage);
        
        log.info("Created system message for member addition: {}", savedMessage.getId());
        
        // Create system message notification to be sent to all chat members
        WebSocketMessage systemMsg = WebSocketMessage.builder()
                .type(WebSocketMessage.MessageType.CHAT)
                .chatId(message.getChatId())
                .userId(message.getUserId())
                .username(message.getUsername() != null ? message.getUsername() : user.getUsername())
                .content(content)
                .timestamp(savedMessage.getSendTime())
                .messageId(savedMessage.getId())
                .isSystem(true) // Mark as system message
                .isGroup(chat.isGroup())
                .chatName(chat.getName())
                .build();
        
        // Create a special addition notification for the UI
        WebSocketMessage additionNotification = WebSocketMessage.builder()
                .type(WebSocketMessage.MessageType.CHAT_UPDATE)
                .updateType("MEMBER_ADDED")
                .chatId(message.getChatId())
                .userId(message.getUserId())
                .username(message.getUsername() != null ? message.getUsername() : user.getUsername())
                .timestamp(LocalDateTime.now())
                .isGroup(chat.isGroup())
                .chatName(chat.getName())
                .targetUserId(targetUser.getId())
                .targetUsername(targetUser.getUsername())
                .content(content) // Add content for context
                .build();
        
        // Send to all active chat members
        webSocketService.broadcastToChat(message.getChatId(), systemMsg);
        
        // Send a special notification to all users about the change
        webSocketService.broadcastToChat(message.getChatId(), additionNotification);
        
        // Also send a special notification to the added user
        webSocketService.notifyChatMemberAdded(
            message.getChatId(), 
            message.getUserId(), 
            targetUser.getUsername()
        );
        
        log.info("Successfully processed member added notification");
    }
    
    /**
     * Handle chat settings change notifications
     */
    @MessageMapping("/chat.settings-changed")
    public void chatSettingsChanged(@Payload WebSocketMessage message) {
        if (message.getChatId() == null || message.getUserId() == null || 
            message.getUsername() == null || message.getChatName() == null) {
            log.error("Invalid chat settings change message: missing required fields");
            return;
        }
        
        log.info("Received chat settings change message from WebSocket: {} updated chat {} to name {}", 
                message.getUsername(), message.getChatId(), message.getChatName());
                
        webSocketService.notifyChatSettingsChanged(
            message.getChatId(),
            message.getUserId(),
            message.getUsername(),
            message.getChatName(),
            message.getContent(), // Using content for description
            message.getUpdateMessage() // Message about the change
        );
    }
    
    /**
     * Create an error response
     */
    private WebSocketMessage createErrorResponse(String errorMessage) {
        return WebSocketMessage.builder()
                .type(WebSocketMessage.MessageType.ERROR)
                .content(errorMessage)
                .timestamp(java.time.LocalDateTime.now())
                .build();
    }
}