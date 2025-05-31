package meow.alxnko.meowsenger.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CreateGameRoomRequest {
    private String name;
    private String gameType;
    private Integer maxPlayers;
    private Integer minPlayers;
} 