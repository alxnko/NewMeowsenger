package meow.alxnko.meowsenger.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
@Slf4j
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final UserChannelInterceptor userChannelInterceptor;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        log.info("Configuring message broker");
        config.enableSimpleBroker("/topic", "/queue", "/user");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
        log.info("Message broker configured");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        log.info("Registering STOMP endpoints");
        
        // Register SockJS endpoint with enhanced configuration for Cloud Run
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS()
                .setWebSocketEnabled(true)
                .setHeartbeatTime(25000)
                .setDisconnectDelay(5000)
                .setSessionCookieNeeded(true) // Enable cookies for session tracking
                .setStreamBytesLimit(512 * 1024)
                .setHttpMessageCacheSize(1000)
                .setDisconnectDelay(30 * 1000);
        log.info("Registered SockJS WebSocket endpoint at /ws with cross-origin support");
                
        // Register direct WebSocket endpoint without SockJS - enhanced for Cloud Run
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*");
        log.info("Registered direct WebSocket endpoint at /ws with cross-origin support");
                
        // Debugging endpoint for connectivity testing with more permissive settings
        registry.addEndpoint("/ws-test")
                .setAllowedOriginPatterns("*")
                .withSockJS()
                .setWebSocketEnabled(true)
                .setSessionCookieNeeded(true); // Enable cookies for session tracking
        log.info("Registered test WebSocket endpoint at /ws-test with cross-origin support");
        
        log.info("STOMP endpoints registered with enhanced Cloud Run support");
    }
    
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(userChannelInterceptor);
        log.info("Client inbound channel interceptor configured");
    }
    
    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration
            .setMessageSizeLimit(128 * 1024) // 128KB
            .setSendBufferSizeLimit(512 * 1024) // 512KB
            .setSendTimeLimit(20000) // 20 seconds
            .setTimeToFirstMessage(120000); // Extended to 120 seconds for Cloud Run
        log.info("WebSocket transport parameters optimized for Cloud Run");
    }
}