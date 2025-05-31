package meow.alxnko.meowsenger.model;

import java.time.LocalDateTime;
import java.util.List;

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
    private String username;
    private String content;
    private LocalDateTime timestamp;
    private Long messageId;
    private Long targetUserId;    // For member-specific operations (e.g. admin promotion)
    private String targetUsername; // For member-specific operations (e.g. admin promotion)
    private Boolean isSystem;
    private Boolean isEdited;
    private Boolean isDeleted;
    private Boolean isForwarded;
    private Boolean isPromotion;  // For admin status changes (true = promoted, false = demoted)
    private Boolean isRead;       // Whether a message has been read
    private Long replyTo;
    private List<Long> destinations; // For forwarded messages
    
    // Additional game-specific fields
    private String gameId;        // Game identifier 
    private String action;        // Game action type (move, join, etc.)
    private Boolean isGameMessage; // Flag to indicate this is a game-related message
    
    // Additional fields to support frontend features
    private Boolean isGroup;        // Whether this is a group chat
    private String chatName;        // Name of the chat (for group notifications)
    
    // For chat updates
    private String updateType;      // Type of update (NEW_CHAT, MEMBER_ADDED, etc.)
    private String updateMessage;   // Human-readable message about the change for system messages
    
    public enum MessageType {
        CHAT,           // Regular chat message
        JOIN,           // User joined chat
        LEAVE,          // User left chat
        TYPING,         // User is typing
        READ,           // Message was read
        ADMIN_CHANGED,  // Admin status changed for a user
        MEMBER_ADDED,   // New member added to chat
        MEMBER_REMOVED, // Member removed from chat
        GROUP_SETTINGS, // Group settings changed
        ERROR,          // Error message
        CHAT_UPDATE,    // General chat update (for UI notifications)
        SUBSCRIBE,      // User subscribing to a chat or topic
        
        // Game-specific message types that bypass chat membership checks
        GAME_MESSAGE,   // Generic game message
        GAME_CREATE,    // Game creation
        GAME_JOIN,      // Player joining a game
        GAME_LEAVE,     // Player leaving a game
        GAME_MOVE,      // Game move/action
        GAME_INVITE,    // Game invitation
        GAME_START,     // Game starting
        GAME_END,       // Game ending
        GAME_STATE      // Game state update
    }
}