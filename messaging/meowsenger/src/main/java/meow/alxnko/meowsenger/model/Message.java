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
@SecondaryTable(name = "user_message", pkJoinColumns = @PrimaryKeyJoinColumn(name = "id"))
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id; // Changed from Integer to Long
    
    @Column(nullable = false, columnDefinition = "TEXT")
    private String text;
    
    @Builder.Default
    @Column(name = "is_deleted")
    private boolean isDeleted = false;
    
    @Builder.Default
    @Column(name = "is_edited")
    private boolean isEdited = false;
    
    @Builder.Default
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
    private Long replyTo; // Changed from Integer to Long
    
    @Builder.Default
    @Column(name = "is_forwarded")
    private boolean isForwarded = false;
    
    // Updated ManyToMany mapping to use the correct table name
    @Builder.Default
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "user_message",  // Match Django table name
        joinColumns = @JoinColumn(name = "id", referencedColumnName = "id"),  // Map to id field
        inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private Set<User> unreadBy = new HashSet<>();
    
    // Just for reference, don't modify through Spring
    @Builder.Default
    @OneToMany(mappedBy = "message", fetch = FetchType.LAZY)
    private Set<Update> updates = new HashSet<>();
}