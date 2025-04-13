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
@Table(name = "meowsenger_backend_user") // Match Django table name
@Getter
@Setter
@ToString(exclude = {"chats", "managedChats", "messages", "notifications", "unreadMessages"})
@EqualsAndHashCode(of = "id")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // Changed from Integer to Long for consistency
    
    @Column(unique = true, nullable = false)
    private String username;
    
    @Column(nullable = false)
    private String password;
    
    @Column(unique = true)
    private String email;
    
    @Column(name = "first_name")
    private String firstName;
    
    @Column(name = "last_name")
    private String lastName;
    
    private String description;
    
    @Column(name = "image_file")
    private String imageFile;
    
    private String rank;
    
    @Column(name = "is_tester")
    private boolean isTester;
    
    @Column(name = "is_verified")
    private boolean isVerified;
    
    @Column(name = "is_staff")
    private boolean isStaff; // Django's is_staff
    
    @Column(name = "is_superuser")
    private boolean isSuperuser; // Django's is_superuser
    
    @Column(name = "is_active")
    private boolean isActive; // Django's is_active
    
    @Column(name = "date_joined")
    private LocalDateTime dateJoined; // Django's date_joined
    
    @Column(name = "reg_time")
    private LocalDateTime regTime;
    
    @Column(name = "last_login")
    private LocalDateTime lastLogin; // Django's last_login
    
    // Don't use this for database operations - use the junction tables instead
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "user_chat", // Updated to match Django table name
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "chat_id")
    )
    private Set<Chat> chats = new HashSet<>();
    
    // Don't use this for database operations - use the junction tables instead
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "admin_chat", // Updated to match Django table name
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "chat_id")
    )
    private Set<Chat> managedChats = new HashSet<>();
    
    // Only for reference - don't use cascade operations
    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY)
    private Set<Message> messages = new HashSet<>();
    
    // Only for reference - don't use cascade operations
    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY)
    private Set<Notify> notifications = new HashSet<>();
    
    // Don't use this for database operations - use the junction table instead
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "user_message", // Updated to match Django table name
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "id")
    )
    private Set<Message> unreadMessages = new HashSet<>();
}