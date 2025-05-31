package meow.alxnko.meowsenger.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import meow.alxnko.meowsenger.dto.CreateGameRoomRequest;
import meow.alxnko.meowsenger.dto.GameRoomDto;
import meow.alxnko.meowsenger.dto.UserDto;
import meow.alxnko.meowsenger.model.GameRoom;
import meow.alxnko.meowsenger.model.GameStatus;
import meow.alxnko.meowsenger.model.User;
import meow.alxnko.meowsenger.repository.GameRoomRepository;
import meow.alxnko.meowsenger.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
@Slf4j
public class GameRoomService {
    
    private final GameRoomRepository gameRoomRepository;
    private final UserRepository userRepository;
    private final WebSocketService webSocketService;
    
    /**
     * Create a new game room
     */
    @Transactional
    public GameRoomDto createGameRoom(CreateGameRoomRequest request, Long userId) {
        User owner = userRepository.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("User not found"));
                
        GameRoom gameRoom = GameRoom.builder()
                .name(request.getName())
                .gameType(request.getGameType())
                .maxPlayers(request.getMaxPlayers())
                .minPlayers(request.getMinPlayers())
                .isActive(true)
                .createdAt(LocalDateTime.now())
                .owner(owner)
                .status(GameStatus.WAITING_FOR_PLAYERS)
                .inviteCode(generateInviteCode())
                .build();
                
        gameRoom.getPlayers().add(owner);
        GameRoom savedRoom = gameRoomRepository.save(gameRoom);
        
        // Notify users that a new game room was created
        webSocketService.sendToUser(userId, "/queue/games", toDto(savedRoom));
        
        return toDto(savedRoom);
    }
    
    /**
     * Join a game room
     */
    @Transactional
    public GameRoomDto joinGameRoom(Long gameRoomId, Long userId) {
        GameRoom gameRoom = gameRoomRepository.findById(gameRoomId)
                .orElseThrow(() -> new NoSuchElementException("Game room not found"));
                
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("User not found"));
                
        // Check if the game is already in progress
        if (gameRoom.getStatus() == GameStatus.IN_PROGRESS) {
            throw new IllegalStateException("Cannot join a game that is already in progress");
        }
        
        // Check if the game is inactive
        if (!gameRoom.isActive()) {
            throw new IllegalStateException("Cannot join an inactive game");
        }
        
        // Check if the game is full
        if (gameRoom.getPlayers().size() >= gameRoom.getMaxPlayers()) {
            throw new IllegalStateException("Game room is full");
        }
        
        // Check if the user is already in the game
        if (gameRoom.getPlayers().contains(user)) {
            throw new IllegalStateException("User is already in the game");
        }
        
        gameRoom.getPlayers().add(user);
        GameRoom updatedRoom = gameRoomRepository.save(gameRoom);
        
        // Notify all players in the room that a new player joined
        notifyGameRoomPlayers(updatedRoom, "User " + user.getUsername() + " joined the game");
        
        return toDto(updatedRoom);
    }
    
    /**
     * Join a game room by invite code
     */
    @Transactional
    public GameRoomDto joinGameRoomByInviteCode(String inviteCode, Long userId) {
        GameRoom gameRoom = gameRoomRepository.findByInviteCode(inviteCode)
                .orElseThrow(() -> new NoSuchElementException("Game room not found with provided invite code"));
                
        return joinGameRoom(gameRoom.getId(), userId);
    }
    
    /**
     * Leave a game room
     */
    @Transactional
    public void leaveGameRoom(Long gameRoomId, Long userId) {
        GameRoom gameRoom = gameRoomRepository.findById(gameRoomId)
                .orElseThrow(() -> new NoSuchElementException("Game room not found"));
                
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("User not found"));
                
        // Cannot leave if you're not in the game
        if (!gameRoom.getPlayers().contains(user)) {
            throw new IllegalStateException("User is not in the game");
        }
        
        // Remove the player from the game
        gameRoom.getPlayers().remove(user);
        
        // If the owner leaves, assign a new owner or close the room
        if (gameRoom.getOwner().getId().equals(userId)) {
            if (gameRoom.getPlayers().isEmpty()) {
                // If no players are left, deactivate the room
                gameRoom.setActive(false);
                gameRoom.setStatus(GameStatus.CANCELED);
            } else {
                // Assign a new owner (first player in the set)
                User newOwner = gameRoom.getPlayers().iterator().next();
                gameRoom.setOwner(newOwner);
                
                // Notify players about the new owner
                notifyGameRoomPlayers(gameRoom, "User " + newOwner.getUsername() + " is now the game owner");
            }
        }
        
        GameRoom updatedRoom = gameRoomRepository.save(gameRoom);
        
        // Notify remaining players that a player left
        if (!gameRoom.getPlayers().isEmpty()) {
            notifyGameRoomPlayers(updatedRoom, "User " + user.getUsername() + " left the game");
        }
    }
    
    /**
     * Kick a player from the game room (owner only)
     */
    @Transactional
    public GameRoomDto kickPlayer(Long gameRoomId, Long playerId, Long ownerId) {
        GameRoom gameRoom = gameRoomRepository.findById(gameRoomId)
                .orElseThrow(() -> new NoSuchElementException("Game room not found"));
                
        // Check if the requester is the owner
        if (!gameRoom.getOwner().getId().equals(ownerId)) {
            throw new IllegalStateException("Only the room owner can kick players");
        }
        
        User player = userRepository.findById(playerId)
                .orElseThrow(() -> new NoSuchElementException("Player not found"));
                
        // Cannot kick if player is not in the game
        if (!gameRoom.getPlayers().contains(player)) {
            throw new IllegalStateException("Player is not in the game");
        }
        
        // Cannot kick yourself (the owner)
        if (playerId.equals(ownerId)) {
            throw new IllegalStateException("Owner cannot kick themselves");
        }
        
        // Remove the player
        gameRoom.getPlayers().remove(player);
        GameRoom updatedRoom = gameRoomRepository.save(gameRoom);
        
        // Notify the kicked player
        webSocketService.sendToUser(playerId, "/queue/games/kicked", gameRoomId);
        
        // Notify remaining players
        notifyGameRoomPlayers(updatedRoom, "User " + player.getUsername() + " was kicked from the game");
        
        return toDto(updatedRoom);
    }
    
    /**
     * Start a game (owner only)
     */
    @Transactional
    public GameRoomDto startGame(Long gameRoomId, Long ownerId) {
        GameRoom gameRoom = gameRoomRepository.findById(gameRoomId)
                .orElseThrow(() -> new NoSuchElementException("Game room not found"));
                
        // Check if the requester is the owner
        if (!gameRoom.getOwner().getId().equals(ownerId)) {
            throw new IllegalStateException("Only the room owner can start the game");
        }
        
        // Check if there are enough players
        if (gameRoom.getPlayers().size() < gameRoom.getMinPlayers()) {
            throw new IllegalStateException("Not enough players to start the game");
        }
        
        // Update game status
        gameRoom.setStatus(GameStatus.IN_PROGRESS);
        GameRoom updatedRoom = gameRoomRepository.save(gameRoom);
        
        // Notify all players that the game has started
        notifyGameRoomPlayers(updatedRoom, "Game has started!");
        
        return toDto(updatedRoom);
    }
    
    /**
     * Get active game rooms
     */
    public List<GameRoomDto> getActiveGameRooms() {
        return gameRoomRepository.findByIsActiveTrue().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Get game rooms by type
     */
    public List<GameRoomDto> getGameRoomsByType(String gameType) {
        return gameRoomRepository.findByGameType(gameType).stream()
                .filter(GameRoom::isActive)
                .map(this::toDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Get a game room by ID
     */
    public GameRoomDto getGameRoomById(Long gameRoomId) {
        GameRoom gameRoom = gameRoomRepository.findById(gameRoomId)
                .orElseThrow(() -> new NoSuchElementException("Game room not found"));
                
        return toDto(gameRoom);
    }
    
    /**
     * Get all game rooms for a user (either as owner or player)
     */
    public List<GameRoomDto> getUserGameRooms(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("User not found"));
                
        // Get rooms where user is a player
        List<GameRoom> playerRooms = gameRoomRepository.findByPlayersContaining(user);
        
        return playerRooms.stream()
                .filter(GameRoom::isActive)
                .map(this::toDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Cancel a game (owner only)
     */
    @Transactional
    public void cancelGame(Long gameRoomId, Long ownerId) {
        GameRoom gameRoom = gameRoomRepository.findById(gameRoomId)
                .orElseThrow(() -> new NoSuchElementException("Game room not found"));
                
        // Check if the requester is the owner
        if (!gameRoom.getOwner().getId().equals(ownerId)) {
            throw new IllegalStateException("Only the room owner can cancel the game");
        }
        
        // Update game status
        gameRoom.setStatus(GameStatus.CANCELED);
        gameRoom.setActive(false);
        GameRoom updatedRoom = gameRoomRepository.save(gameRoom);
        
        // Notify all players that the game has been canceled
        notifyGameRoomPlayers(updatedRoom, "Game has been canceled by the owner");
    }
    
    /**
     * Convert a GameRoom entity to a DTO
     */
    private GameRoomDto toDto(GameRoom gameRoom) {
        Set<UserDto> playerDtos = gameRoom.getPlayers().stream()
                .map(this::toUserDto)
                .collect(Collectors.toSet());
                
        return GameRoomDto.builder()
                .id(gameRoom.getId())
                .name(gameRoom.getName())
                .gameType(gameRoom.getGameType())
                .maxPlayers(gameRoom.getMaxPlayers())
                .minPlayers(gameRoom.getMinPlayers())
                .isActive(gameRoom.isActive())
                .createdAt(gameRoom.getCreatedAt())
                .owner(toUserDto(gameRoom.getOwner()))
                .players(playerDtos)
                .status(gameRoom.getStatus())
                .inviteCode(gameRoom.getInviteCode())
                .currentPlayerCount(gameRoom.getPlayers().size())
                .build();
    }
    
    /**
     * Convert a User entity to a UserDto
     */
    private UserDto toUserDto(User user) {
        return UserDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .imageFile(user.getImageFile())
                .build();
    }
    
    /**
     * Generate a unique invite code
     */
    private String generateInviteCode() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
    
    /**
     * Notify all players in a game room of an event
     */
    private void notifyGameRoomPlayers(GameRoom gameRoom, String message) {
        GameRoomDto roomDto = toDto(gameRoom);
        
        for (User player : gameRoom.getPlayers()) {
            webSocketService.sendToUser(player.getId(), "/queue/games/updates", roomDto);
            webSocketService.sendToUser(player.getId(), "/queue/games/messages", message);
        }
    }
} 