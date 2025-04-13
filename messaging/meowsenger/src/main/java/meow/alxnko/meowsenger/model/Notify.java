package meow.alxnko.meowsenger.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "meowsenger_backend_notify")  // Match Django table name
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notify {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id; // Changed from Long to Integer to match Django's int4 type
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @Column(columnDefinition = "TEXT")
    private String subscription;
}