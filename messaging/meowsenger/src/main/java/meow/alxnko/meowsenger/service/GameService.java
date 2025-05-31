package meow.alxnko.meowsenger.service;

import meow.alxnko.meowsenger.dto.GameActionRequest;

public interface GameService {
    /**
     * Process a game action from a user
     * 
     * @param actionRequest The game action request
     * @param userId The ID of the user who sent the action
     */
    void processGameAction(GameActionRequest actionRequest, Long userId);
} 