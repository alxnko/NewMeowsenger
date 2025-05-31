package meow.alxnko.meowsenger.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import meow.alxnko.meowsenger.dto.GameActionRequest;
import meow.alxnko.meowsenger.model.GameRoom;
import meow.alxnko.meowsenger.model.GameStatus;
import meow.alxnko.meowsenger.model.User;
import meow.alxnko.meowsenger.repository.GameRoomRepository;
import meow.alxnko.meowsenger.repository.UserRepository;
import meow.alxnko.meowsenger.service.GameService;
import meow.alxnko.meowsenger.service.WebSocketService;
import org.springframework.stereotype.Service;

import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
@Slf4j
public class DefaultGameService implements GameService {

    private final GameRoomRepository gameRoomRepository;
    private final UserRepository userRepository;
    private final WebSocketService webSocketService;
    private final ObjectMapper objectMapper;
    
    @Override
    public void processGameAction(GameActionRequest actionRequest, Long userId) {
        log.info("Processing game action: {} from user: {}", actionRequest, userId);
        
        GameRoom gameRoom = gameRoomRepository.findById(actionRequest.getGameRoomId())
                .orElseThrow(() -> new NoSuchElementException("Game room not found"));
                
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("User not found"));
                
        // Check if the game is in progress
        if (gameRoom.getStatus() != GameStatus.IN_PROGRESS) {
            log.error("Cannot process action for game that is not in progress. Current status: {}", gameRoom.getStatus());
            throw new IllegalStateException("Game is not in progress");
        }
        
        // Check if the user is a player in the game
        if (!gameRoom.getPlayers().contains(user)) {
            log.error("User {} is not a player in game room {}", userId, gameRoom.getId());
            throw new IllegalStateException("User is not a player in this game");
        }
        
        // Process the action and update the game state
        try {
            // The game action implementation will depend on the specific game type
            // For now, we'll just update the game state with the action data
            String currentState = gameRoom.getGameState();
            
            // Update game state based on the action
            // In a real implementation, this would be game-specific logic
            String updatedState = updateGameState(gameRoom.getGameType(), currentState, actionRequest, userId);
            
            // Save the updated game state
            gameRoom.setGameState(updatedState);
            gameRoomRepository.save(gameRoom);
            
            // Notify all players about the updated game state
            for (User player : gameRoom.getPlayers()) {
                webSocketService.sendToUser(player.getId(), "/queue/games/state/" + gameRoom.getId(), updatedState);
            }
            
            // Check if the game has ended
            if (isGameOver(gameRoom.getGameType(), updatedState)) {
                gameRoom.setStatus(GameStatus.FINISHED);
                gameRoomRepository.save(gameRoom);
                
                // Notify all players that the game has ended
                for (User player : gameRoom.getPlayers()) {
                    webSocketService.sendToUser(player.getId(), "/queue/games/ended/" + gameRoom.getId(), getGameResult(updatedState));
                }
            }
            
        } catch (Exception e) {
            log.error("Error processing game action", e);
            throw new IllegalStateException("Error processing game action: " + e.getMessage());
        }
    }
    
    /**
     * Update the game state based on the game type and action
     * This would be implemented differently for each game type
     */
    private String updateGameState(String gameType, String currentState, GameActionRequest actionRequest, Long userId) {
        // This is a placeholder implementation
        // In a real application, different game types would have their own state update logic
        
        log.info("Updating game state for game type: {}", gameType);
        
        // For now, just return a simple JSON with the action
        return String.format("{\"lastAction\": \"%s\", \"lastActionBy\": %d, \"actionData\": \"%s\"}",
                actionRequest.getAction(), userId, actionRequest.getData());
    }
    
    /**
     * Check if the game has ended
     * This would be implemented differently for each game type
     */
    private boolean isGameOver(String gameType, String gameState) {
        // This is a placeholder implementation
        // In a real application, different game types would have their own end condition logic
        return false;
    }
    
    /**
     * Get the game result
     * This would be implemented differently for each game type
     */
    private String getGameResult(String gameState) {
        // This is a placeholder implementation
        // In a real application, different game types would have their own result reporting logic
        return "{\"winner\": null, \"isDraw\": false}";
    }
} 