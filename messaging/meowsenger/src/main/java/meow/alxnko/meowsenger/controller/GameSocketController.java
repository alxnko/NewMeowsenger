package meow.alxnko.meowsenger.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import meow.alxnko.meowsenger.model.User;
import meow.alxnko.meowsenger.model.WebSocketMessage;
import meow.alxnko.meowsenger.repository.UserRepository;
import meow.alxnko.meowsenger.service.WebSocketService;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Controller dedicated to handling game-related WebSocket messages.
 * These messages bypass the chat membership checks that are normally applied
 * to regular chat messages.
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class GameSocketController {

    private final SimpMessageSendingOperations messagingTemplate;
    private final WebSocketService webSocketService;
    private final UserRepository userRepository;

    // Constructor is created by @RequiredArgsConstructor, don't need to create manually
    // The initialization code can go in PostConstruct
    
    @jakarta.annotation.PostConstruct
    public void init() {
        log.info("********** GameSocketController initialized **********");
        log.info("WebSocket game controller is ready to receive game messages");
        log.info("Game endpoints: /game.create, /game.join, /game.action, /game.invite, /game.subscribe");
    }

    /**
     * Handle game creation requests
     */
    @MessageMapping("/game.create")
    public void createGame(@Payload WebSocketMessage message, SimpMessageHeaderAccessor headerAccessor) {
        log.info("********** RECEIVED GAME CREATION REQUEST **********");
        log.info("Full message details: {}", message);
        
        if (headerAccessor != null) {
            log.info("Header details: sessionId={}, user={}", 
                    headerAccessor.getSessionId(),
                    headerAccessor.getUser());
        } else {
            log.warn("Header accessor is null");
        }
        
        // Validate the message
        if (message.getUserId() == null) {
            log.error("Invalid game creation request: missing user ID");
            return;
        }
        
        // Get user information
        Optional<User> userOpt = userRepository.findById(message.getUserId());
        if (userOpt.isEmpty()) {
            log.error("User not found for game creation: {}", message.getUserId());
            return;
        }
        
        User user = userOpt.get();
        String username = user.getUsername();
        log.info("Found user: {}", username);
        
        try {
            // Parse game data from the message content
            String gameId = extractGameId(message.getContent());
            log.info("Extracted gameId: {} from content: {}", gameId, message.getContent());
            
            // Create response message
            WebSocketMessage response = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.GAME_CREATE)
                    .userId(message.getUserId())
                    .username(username)
                    .chatId(0L) // Use chatId=0 for games
                    .content(message.getContent())
                    .timestamp(LocalDateTime.now())
                    .build();
            
            // Send to the game topic
            String destination = "/topic/game." + gameId;
            log.info("Sending game creation response to destination: {}", destination);
            messagingTemplate.convertAndSend(destination, response);
            
            log.info("Game created successfully: {}", gameId);
            
            // Also send a confirmation directly to the user
            String userDestination = "/user/" + message.getUserId() + "/queue/game-events";
            log.info("Sending confirmation to user destination: {}", userDestination);
            
            WebSocketMessage confirmationMsg = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.GAME_CREATE)
                    .userId(message.getUserId())
                    .username(username)
                    .chatId(0L)
                    .content("Game " + gameId + " created successfully")
                    .timestamp(LocalDateTime.now())
                    .build();
                    
            messagingTemplate.convertAndSendToUser(
                message.getUserId().toString(),
                "/queue/game-events",
                confirmationMsg
            );
            
            log.info("Confirmation message sent to user {}", message.getUserId());
        } catch (Exception e) {
            log.error("Error processing game creation request", e);
        }
    }
    
    /**
     * Handle game join requests
     */
    @MessageMapping("/game.join")
    public void joinGame(@Payload WebSocketMessage message, SimpMessageHeaderAccessor headerAccessor) {
        log.info("Received game join request: {}", message);
        
        // Validate the message
        if (message.getUserId() == null) {
            log.error("Invalid game join request: missing user ID");
            return;
        }
        
        // Get user information
        Optional<User> userOpt = userRepository.findById(message.getUserId());
        if (userOpt.isEmpty()) {
            log.error("User not found for game join: {}", message.getUserId());
            return;
        }
        
        User user = userOpt.get();
        String username = user.getUsername();
        
        try {
            // Parse game data from the message content
            String gameId = extractGameId(message.getContent());
            
            // Create response message
            WebSocketMessage response = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.GAME_JOIN)
                    .userId(message.getUserId())
                    .username(username)
                    .chatId(0L) // Use chatId=0 for games
                    .content(message.getContent())
                    .timestamp(LocalDateTime.now())
                    .build();
            
            // Send to the game topic
            messagingTemplate.convertAndSend("/topic/game." + gameId, response);
            
            log.info("User {} joined game {}", username, gameId);
        } catch (Exception e) {
            log.error("Error processing game join request", e);
        }
    }
    
    /**
     * Handle game moves/actions
     */
    @MessageMapping("/game.action")
    public void gameAction(@Payload WebSocketMessage message) {
        log.info("Received game action: {}", message);
        
        // Validate the message
        if (message.getUserId() == null) {
            log.error("Invalid game action: missing user ID");
            return;
        }
        
        try {
            // Parse game data from the message content
            String gameId = extractGameId(message.getContent());
            
            // Create response message - just forward the original message
            WebSocketMessage response = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.GAME_MOVE)
                    .userId(message.getUserId())
                    .username(message.getUsername())
                    .chatId(0L) // Use chatId=0 for games
                    .content(message.getContent())
                    .timestamp(LocalDateTime.now())
                    .build();
            
            // Send to the game topic
            messagingTemplate.convertAndSend("/topic/game." + gameId, response);
            
            log.debug("Game action processed for game {}", gameId);
        } catch (Exception e) {
            log.error("Error processing game action", e);
        }
    }
    
    /**
     * Handle game invitations
     */
    @MessageMapping("/game.invite")
    public void sendGameInvite(@Payload WebSocketMessage message) {
        log.info("Received game invitation: {}", message);
        
        // Validate the message
        if (message.getUserId() == null) {
            log.error("Invalid game invitation: missing user ID");
            return;
        }
        
        try {
            // Parse the invitation data
            String content = message.getContent();
            
            // Create the invite message
            WebSocketMessage inviteMessage = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.GAME_INVITE)
                    .userId(message.getUserId())
                    .username(message.getUsername())
                    .chatId(0L) // Use chatId=0 for invitations
                    .content(content)
                    .timestamp(LocalDateTime.now())
                    .build();
            
            // Extract recipient information from the content
            Long recipientId = extractRecipientId(content);
            if (recipientId != null) {
                // Send to the recipient's personal queue
                messagingTemplate.convertAndSendToUser(
                    recipientId.toString(),
                    "/queue/game.invite",
                    inviteMessage
                );
                
                log.info("Game invitation sent to user {}", recipientId);
            } else {
                log.error("Could not extract recipient ID from invitation content");
            }
        } catch (Exception e) {
            log.error("Error sending game invitation", e);
        }
    }
    
    /**
     * Handle subscription to game topics
     */
    @MessageMapping("/game.subscribe")
    public void subscribeToGame(@Payload WebSocketMessage message, SimpMessageHeaderAccessor headerAccessor) {
        log.info("Received game subscription request for: {}", message.getContent());
        
        // No chat membership check needed for games - anyone can join with the game ID
        // Just log the subscription for monitoring
        String sessionId = headerAccessor.getSessionId();
        Long userId = webSocketService.getUserIdFromSession(sessionId);
        
        if (userId == null) {
            log.error("User not registered for session {}", sessionId);
            // Don't throw an exception, just log and return
            return;
        }
        
        String gameId = message.getContent();
        log.info("User {} with session {} subscribed to game {}", userId, sessionId, gameId);
        
        // Confirm subscription by sending a message back
        try {
            WebSocketMessage confirmationMessage = WebSocketMessage.builder()
                    .type(WebSocketMessage.MessageType.GAME_MESSAGE)
                    .content("Subscribed to game " + gameId)
                    .userId(userId)
                    .chatId(0L)
                    .timestamp(LocalDateTime.now())
                    .build();
            
            // Send confirmation to the user's personal queue
            messagingTemplate.convertAndSendToUser(
                userId.toString(),
                "/queue/game-events",
                confirmationMessage
            );
            
            log.info("Sent subscription confirmation to user {}", userId);
        } catch (Exception e) {
            log.error("Error sending subscription confirmation", e);
        }
    }
    
    /**
     * Utility method to extract the game ID from a message content
     */
    private String extractGameId(String content) {
        try {
            // Different content formats may be used, try to handle them
            if (content.startsWith("{")) {
                // JSON format
                // This is a simplistic approach - in a real implementation use a proper JSON parser
                int gameIdIndex = content.indexOf("\"gameId\":");
                if (gameIdIndex >= 0) {
                    int valueStart = content.indexOf("\"", gameIdIndex + 9) + 1;
                    int valueEnd = content.indexOf("\"", valueStart);
                    return content.substring(valueStart, valueEnd);
                }
            }
            
            // If not JSON or gameId not found, assume the content is the game ID itself
            return content.trim();
        } catch (Exception e) {
            log.error("Error extracting game ID from content: {}", content, e);
            return "unknown";
        }
    }
    
    /**
     * Utility method to extract recipient ID from the invitation content
     */
    private Long extractRecipientId(String content) {
        try {
            // Assuming JSON format
            // This is a simplistic approach - in a real implementation use a proper JSON parser
            int recipientIdIndex = content.indexOf("\"recipientId\":");
            if (recipientIdIndex >= 0) {
                int valueStart = recipientIdIndex + 14; // Length of "recipientId":
                int valueEnd = content.indexOf(",", valueStart);
                if (valueEnd < 0) {
                    valueEnd = content.indexOf("}", valueStart);
                }
                
                if (valueEnd > valueStart) {
                    String idStr = content.substring(valueStart, valueEnd).trim();
                    return Long.parseLong(idStr);
                }
            }
            return null;
        } catch (Exception e) {
            log.error("Error extracting recipient ID from content: {}", content, e);
            return null;
        }
    }
} 