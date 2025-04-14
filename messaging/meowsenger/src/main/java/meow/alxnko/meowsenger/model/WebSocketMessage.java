package meow.alxnko.meowsenger.model;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL) // Only include non-null fields in JSON
public class WebSocketMessage {
    
    private MessageType type;
    private Long chatId;
    private Long userId;
    private String content;
    private LocalDateTime timestamp;
    private Long messageId;
    
    // Additional fields to support frontend features
    private String username;        // Name of message sender
    private Boolean isEdited;       // Whether message has been edited
    private Boolean isDeleted;      // Whether message has been deleted
    private Boolean isSystem;       // Whether message is a system message
    private Long replyTo;           // ID of message being replied to
    private Boolean isForwarded;    // Whether message is forwarded from another chat
    private Boolean isRead;         // Whether message has been read by recipient
    
    // For group chats
    private Boolean isGroup;        // Whether this is a group chat
    private String chatName;        // Name of the chat (for group notifications)
    
    public enum MessageType {
        CHAT,       // Regular chat message
        JOIN,       // User joining a chat
        LEAVE,      // User leaving a chat
        SUBSCRIBE,  // User subscribing to a chat
        ERROR,      // Error message
        TYPING,     // User is typing
        READ        // Message read receipt
    }
}