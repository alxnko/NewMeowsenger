package meow.alxnko.meowsenger.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class GameActionRequest {
    private Long gameRoomId;
    private String action;
    private String data;
} 