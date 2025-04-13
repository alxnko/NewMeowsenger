package meow.alxnko.meowsenger.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "meowsenger_backend_message")  // Match Django table name
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@SecondaryTable(name = "user_message", pkJoinColumns = @PrimaryKeyJoinColumn(name = "msg_id"))
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Integer id; // Changed from Long to Integer to match Django's int4 type
    
    // Adding attribute to match Django's custom column name in junction table
    @AttributeOverride(name = "id", column = @Column(name = "msg_id", insertable = false, updatable = false))
    private Integer msgId; // Changed from Long to Integer to match Django's int4 type
    
    @Column(nullable = false, columnDefinition = "TEXT")
    private String text;
    
    @Column(name = "is_deleted")
    private boolean isDeleted = false;
    
    @Column(name = "is_edited")
    private boolean isEdited = false;
    
    @Column(name = "is_system")
    private boolean isSystem = false;
    
    @Column(name = "send_time")
    private LocalDateTime sendTime;
    
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "chat_id", nullable = false)
    private Chat chat;
    
    @Column(name = "reply_to")
    private Integer replyTo;
    
    @Column(name = "is_forwarded")
    private boolean isForwarded = false;
    
    // Updated ManyToMany mapping to use the correct table name
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "user_message",  // Match Django table name
        joinColumns = @JoinColumn(name = "msg_id", referencedColumnName = "id"),  // Map to id field
        inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private Set<User> unreadBy = new HashSet<>();
    
    // Just for reference, don't modify through Spring
    @OneToMany(mappedBy = "message", fetch = FetchType.LAZY)
    private Set<Update> updates = new HashSet<>();
    
    // Add lifecycle callback to ensure msgId equals id
    @PostLoad
    @PostPersist
    @PostUpdate
    private void setMsgId() {
        this.msgId = this.id;
    }
}