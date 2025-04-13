package meow.alxnko.meowsenger.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "meowsenger_backend_chat") // Match Django table name
@Getter
@Setter
@ToString(exclude = {"users", "admins", "messages", "updates"})
@EqualsAndHashCode(of = "id")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Chat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // Changed from Integer to Long for consistency
    
    @Column(name = "is_group")
    private boolean isGroup = false;
    
    private String name;
    
    private String description = "meowsenger group";
    
    @Column(name = "is_verified")
    private boolean isVerified = false;
    
    @Column(length = 64)
    private String secret;
    
    @Column(name = "last_time")
    private LocalDateTime lastTime;
    
    // Don't use cascade operations since Django manages this
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "user_chat",  // Updated to match Django table name
        joinColumns = @JoinColumn(name = "chat_id"),
        inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private Set<User> users = new HashSet<>();
    
    // Don't use cascade operations since Django manages this
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "admin_chat",  // Updated to match Django table name
        joinColumns = @JoinColumn(name = "chat_id"),
        inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private Set<User> admins = new HashSet<>();
    
    // Just for reference, don't modify through Spring
    @OneToMany(mappedBy = "chat", fetch = FetchType.LAZY)
    private Set<Message> messages = new HashSet<>();
    
    // Just for reference, don't modify through Spring
    @OneToMany(mappedBy = "chat", fetch = FetchType.LAZY)
    private Set<Update> updates = new HashSet<>();
}