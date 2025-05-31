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
@Table(name = "game_room")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GameRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String name;
    
    @Column(nullable = false)
    private String gameType;
    
    @Column(nullable = false)
    private Integer maxPlayers;
    
    @Column(nullable = false)
    private Integer minPlayers;
    
    @Column(nullable = false)
    private boolean isActive;
    
    @Column(nullable = false)
    private LocalDateTime createdAt;
    
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;
    
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "game_room_player",
        joinColumns = @JoinColumn(name = "game_room_id"),
        inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private Set<User> players = new HashSet<>();
    
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private GameStatus status;
    
    @Column(nullable = true)
    private String gameState;
    
    @Column(nullable = true)
    private String inviteCode;
} 