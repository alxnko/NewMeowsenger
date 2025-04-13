package meow.alxnko.meowsenger.model;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WebSocketMessage {
    
    private MessageType type;
    private Long chatId;
    private Long userId;
    private String content;
    private LocalDateTime timestamp;
    private Long messageId;
    
    public enum MessageType {
        CHAT,       // Regular chat message
        JOIN,       // User joining a chat
        LEAVE,      // User leaving a chat
        SUBSCRIBE,  // User subscribing to a chat
        ERROR       // Error message
    }
}