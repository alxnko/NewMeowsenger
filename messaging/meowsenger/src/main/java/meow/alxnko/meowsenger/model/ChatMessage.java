package meow.alxnko.meowsenger.model;

import java.time.LocalDateTime;

import jakarta.persistence.Transient;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// Remove @Entity and @Table annotations - this is now just a DTO, not an entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessage {
    
    private Long id;
    private String content;
    private Long senderId;
    private Long chatId;
    private LocalDateTime timestamp;
    
    @Transient  // Not stored in database
    private MessageType type;
    
    public enum MessageType {
        CHAT,
        JOIN,
        LEAVE
    }
    
    // Factory method to create ChatMessage from Message entity
    public static ChatMessage fromMessage(Message message) {
        return ChatMessage.builder()
                .id(message.getId())
                .content(message.getText())
                .senderId(message.getUser().getId())
                .chatId(message.getChat().getId())
                .timestamp(message.getSendTime())
                .type(MessageType.CHAT)
                .build();
    }
}