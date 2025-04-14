package meow.alxnko.meowsenger.config;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.security.Principal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
@Slf4j
public class UserChannelInterceptor implements ChannelInterceptor {
    
    private final Map<String, UserPrincipal> sessionPrincipalMap = new ConcurrentHashMap<>();
    private final ApplicationEventPublisher eventPublisher;
    
    /**
     * Set the user principal for a session ID
     */
    public void setUserPrincipal(String sessionId, Long userId) {
        if (sessionId != null && userId != null) {
            UserPrincipal principal = new UserPrincipal(userId.toString());
            sessionPrincipalMap.put(sessionId, principal);
            log.debug("Set principal for user {} with session {}", userId, sessionId);
        }
    }
    
    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        
        if (accessor != null) {
            // When a client connects
            if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                log.debug("Client connected: {}", accessor.getSessionId());
            }
            // Handle user disconnection
            else if (StompCommand.DISCONNECT.equals(accessor.getCommand())) {
                String sessionId = accessor.getSessionId();
                sessionPrincipalMap.remove(sessionId);
                log.debug("Client disconnected: {}", sessionId);
                // Publish an event when a client disconnects
                eventPublisher.publishEvent(new WebSocketDisconnectEvent(sessionId));
            }
            
            // For all messages, ensure the principal is set if available
            String sessionId = accessor.getSessionId();
            if (sessionId != null && sessionPrincipalMap.containsKey(sessionId)) {
                accessor.setUser(sessionPrincipalMap.get(sessionId));
            }
        }
        
        return message;
    }
    
    // Custom Principal implementation
    public static class UserPrincipal implements Principal {
        private final String name;
        
        public UserPrincipal(String name) {
            this.name = name;
        }
        
        @Override
        public String getName() {
            return name;
        }
    }
    
    // Custom event for WebSocket disconnections
    public static class WebSocketDisconnectEvent {
        private final String sessionId;
        
        public WebSocketDisconnectEvent(String sessionId) {
            this.sessionId = sessionId;
        }
        
        public String getSessionId() {
            return sessionId;
        }
    }
}