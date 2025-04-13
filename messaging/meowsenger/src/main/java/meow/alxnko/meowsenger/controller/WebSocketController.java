package meow.alxnko.meowsenger.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import meow.alxnko.meowsenger.model.WebSocketMessage;
import meow.alxnko.meowsenger.service.WebSocketService;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Controller
@RequiredArgsConstructor
@Slf4j
public class WebSocketController {

    private final WebSocketService webSocketService;

    /**
     * Handle user registration when they connect with WebSocket
     */
    @MessageMapping("/register")
    public void registerUser(@Payload WebSocketMessage message, SimpMessageHeaderAccessor headerAccessor) {
        // Store user ID in WebSocket session
        String sessionId = headerAccessor.getSessionId();
        webSocketService.registerUserSession(sessionId, message.getUserId());
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
    public Map<Integer, WebSocketMessage> subscribeToMultipleChats(@Payload List<Integer> chatIds, SimpMessageHeaderAccessor headerAccessor) { // Changed from Long to Integer
        String sessionId = headerAccessor.getSessionId();
        Integer userId = webSocketService.getUserIdFromSession(sessionId); // Changed from Long to Integer
        
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
     * Handle marking messages as read
     */
    @MessageMapping("/chat.read")
    public void markAsRead(@Payload WebSocketMessage message) {
        // Extract message ID and user ID from the message
        if (message.getMessageId() != null && message.getUserId() != null) {
            webSocketService.markMessageAsRead(message.getMessageId(), message.getUserId());
        }
    }
}