package meow.alxnko.meowsenger.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import meow.alxnko.meowsenger.model.Chat;
import meow.alxnko.meowsenger.model.Message;
import meow.alxnko.meowsenger.model.User;
import meow.alxnko.meowsenger.model.WebSocketMessage;
import meow.alxnko.meowsenger.repository.ChatRepository;
import meow.alxnko.meowsenger.repository.UserRepository;
import meow.alxnko.meowsenger.service.WebSocketService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class WebSocketNotificationController {

    private final WebSocketService webSocketService;
    private final ChatRepository chatRepository;
    private final UserRepository userRepository;

    /**
     * Endpoint to notify about admin status changes
     */
    @PostMapping("/admin-status-changed")
    public ResponseEntity<Map<String, String>> adminStatusChanged(@RequestBody Map<String, Object> payload) {
        try {
            Long chatId = ((Number) payload.get("chatId")).longValue();
            Long changedByUserId = ((Number) payload.get("changedByUserId")).longValue();
            String changedByUsername = (String) payload.get("changedByUsername");
            Long targetUserId = ((Number) payload.get("targetUserId")).longValue();
            String targetUsername = (String) payload.get("targetUsername");
            boolean isPromotion = (boolean) payload.get("isPromotion");
            
            log.info("Admin status change notification received: user {} {} by {}", 
                    targetUsername, 
                    isPromotion ? "promoted" : "demoted", 
                    changedByUsername);
            
            // Call the WebSocket service to broadcast the notification
            webSocketService.notifyAdminStatusChanged(
                chatId, 
                changedByUserId, 
                changedByUsername,
                targetUserId,
                targetUsername,
                isPromotion
            );
            
            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (Exception e) {
            log.error("Error processing admin status change notification: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
    
    /**
     * Endpoint to notify about user removal
     */
    @PostMapping("/user-removed")
    public ResponseEntity<Map<String, String>> userRemoved(@RequestBody Map<String, Object> payload) {
        try {
            Long chatId = ((Number) payload.get("chatId")).longValue();
            Long removedByUserId = ((Number) payload.get("removedByUserId")).longValue();
            String removedByUsername = (String) payload.get("removedByUsername");
            Long targetUserId = ((Number) payload.get("targetUserId")).longValue();
            String targetUsername = (String) payload.get("targetUsername");
            
            log.info("User removal notification received: user {} removed by {}", 
                    targetUsername, removedByUsername);
            
            // Call the WebSocket service to broadcast the notification
            webSocketService.notifyUserRemoved(
                chatId, 
                removedByUserId, 
                removedByUsername,
                targetUserId,
                targetUsername
            );
            
            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (Exception e) {
            log.error("Error processing user removal notification: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
    
    /**
     * Endpoint to notify about user addition to a chat
     */
    @PostMapping("/user-added")
    public ResponseEntity<Map<String, String>> userAdded(@RequestBody Map<String, Object> payload) {
        try {
            Long chatId = ((Number) payload.get("chatId")).longValue();
            Long addedByUserId = ((Number) payload.get("addedByUserId")).longValue();
            String targetUsername = (String) payload.get("targetUsername");
            
            log.info("User addition notification received: user {} added to chat {}", 
                    targetUsername, chatId);
            
            // Call the WebSocket service to broadcast the notification
            webSocketService.notifyChatMemberAdded(
                chatId, 
                addedByUserId, 
                targetUsername
            );
            
            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (Exception e) {
            log.error("Error processing user addition notification: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
    
    /**
     * Endpoint to notify about chat settings changes
     */
    @PostMapping("/chat-settings-changed")
    public ResponseEntity<Map<String, String>> chatSettingsChanged(@RequestBody Map<String, Object> payload) {
        try {
            Long chatId = ((Number) payload.get("chatId")).longValue();
            Long changedByUserId = ((Number) payload.get("changedByUserId")).longValue();
            String changedByUsername = (String) payload.get("changedByUsername");
            String name = (String) payload.get("name");
            String description = (String) payload.get("description");
            String message = (String) payload.get("message");
            
            log.info("Chat settings change notification received: chat {} updated by {}", 
                    chatId, changedByUsername);
            
            // Call the WebSocket service to broadcast the notification
            webSocketService.notifyChatSettingsChanged(
                chatId, 
                changedByUserId, 
                changedByUsername,
                name,
                description,
                message
            );
            
            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (Exception e) {
            log.error("Error processing chat settings change notification: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
}