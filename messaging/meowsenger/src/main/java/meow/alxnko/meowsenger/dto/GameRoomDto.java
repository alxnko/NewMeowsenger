package meow.alxnko.meowsenger.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import meow.alxnko.meowsenger.model.GameStatus;

import java.time.LocalDateTime;
import java.util.Set;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class GameRoomDto {
    private Long id;
    private String name;
    private String gameType;
    private Integer maxPlayers;
    private Integer minPlayers;
    private boolean isActive;
    private LocalDateTime createdAt;
    private UserDto owner;
    private Set<UserDto> players;
    private GameStatus status;
    private String inviteCode;
    private Integer currentPlayerCount;
} 