package meow.alxnko.meowsenger.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import meow.alxnko.meowsenger.model.Message;
import meow.alxnko.meowsenger.model.WebSocketMessage;
import meow.alxnko.meowsenger.service.MessageService;
import meow.alxnko.meowsenger.service.WebSocketService;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Controller
@RequiredArgsConstructor
@Slf4j
public class WebSocketController {

    private final WebSocketService webSocketService;
    private final MessageService messageService;

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
        return webSocketService.processAndSendMessage(message);
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
     * Handle member removed notifications
     */
    @MessageMapping("/chat.member-removed")
    public void memberRemoved(@Payload WebSocketMessage message) {
        if (message.getChatId() == null || message.getUserId() == null || 
            message.getTargetUserId() == null || message.getTargetUsername() == null) {
            log.error("Invalid member removal message: missing required fields");
            return;
        }
        
        log.info("Received member removal message from WebSocket: {} removed {}", 
                message.getUserId(), message.getTargetUsername());
                
        webSocketService.notifyUserRemoved(
            message.getChatId(),
            message.getUserId(),
            message.getUsername(), // sender's username
            message.getTargetUserId(),
            message.getTargetUsername()
        );
    }
    
    /**
     * Handle member added notifications
     */
    @MessageMapping("/chat.member-added")
    public void memberAdded(@Payload WebSocketMessage message) {
        if (message.getChatId() == null || message.getUserId() == null || 
            message.getTargetUsername() == null) {
            log.error("Invalid member added message: missing required fields");
            return;
        }
        
        log.info("Received member added message from WebSocket: {} added {}", 
                message.getUserId(), message.getTargetUsername());
                
        webSocketService.notifyChatMemberAdded(
            message.getChatId(),
            message.getUserId(),
            message.getTargetUsername()
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