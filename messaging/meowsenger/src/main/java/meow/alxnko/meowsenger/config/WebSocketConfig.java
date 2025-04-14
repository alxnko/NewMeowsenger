package meow.alxnko.meowsenger.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final UserChannelInterceptor userChannelInterceptor;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Enable a simple in-memory message broker to send messages to clients
        // Topic destination prefix for broadcasting messages to subscribers
        config.enableSimpleBroker("/topic", "/queue", "/user");
        
        // Application destination prefix for messages from clients
        config.setApplicationDestinationPrefixes("/app");
        
        // User destination prefix for sending messages to specific users
        config.setUserDestinationPrefix("/user");
        
        // Set the system username for server-initiated messages
        config.setUserRegistryOrder(99);
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Register the "/ws" endpoint for WebSocket connections
        registry.addEndpoint("/ws")
                // Enable CORS for specific origins instead of wildcard
                .setAllowedOrigins(
                    "http://localhost:3000",
                    "http://127.0.0.1:3000", 
                    "http://localhost:80",
                    "http://127.0.0.1:80"
                )
                // Fallback to SockJS if WebSocket is not available
                .withSockJS();
    }
    
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Register our custom interceptor
        registration.interceptors(userChannelInterceptor);
    }
}