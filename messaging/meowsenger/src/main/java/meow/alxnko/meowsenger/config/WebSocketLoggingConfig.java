package meow.alxnko.meowsenger.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.web.socket.messaging.SessionUnsubscribeEvent;
import org.springframework.web.socket.messaging.AbstractSubProtocolEvent;

import lombok.extern.slf4j.Slf4j;

/**
 * Configuration for logging WebSocket connection events
 */
@Configuration
@Slf4j
public class WebSocketLoggingConfig {

    /**
     * Log session connect events
     */
    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        log.info("WebSocket Connected: sessionId={}, user={}, destination={}",
                headerAccessor.getSessionId(),
                headerAccessor.getUser(),
                headerAccessor.getDestination());
    }

    /**
     * Log session disconnect events
     */
    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        log.info("WebSocket Disconnected: sessionId={}, user={}, status code={}",
                headerAccessor.getSessionId(),
                headerAccessor.getUser(),
                event.getCloseStatus());
    }
    
    /**
     * Log session subscribe events
     */
    @EventListener
    public void handleWebSocketSubscribeListener(SessionSubscribeEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        log.info("WebSocket Subscription: sessionId={}, user={}, destination={}",
                headerAccessor.getSessionId(),
                headerAccessor.getUser(),
                headerAccessor.getDestination());
    }
    
    /**
     * Log session unsubscribe events
     */
    @EventListener
    public void handleWebSocketUnsubscribeListener(SessionUnsubscribeEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        log.info("WebSocket Unsubscription: sessionId={}, user={}, destination={}",
                headerAccessor.getSessionId(),
                headerAccessor.getUser(),
                headerAccessor.getDestination());
    }
} 