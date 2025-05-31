package meow.alxnko.meowsenger.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import meow.alxnko.meowsenger.dto.CreateGameRoomRequest;
import meow.alxnko.meowsenger.dto.GameRoomDto;
import meow.alxnko.meowsenger.service.GameRoomService;

import java.util.List;

@RestController
@RequestMapping("/api/games")
@RequiredArgsConstructor
@Slf4j
public class GameController {

    private final GameRoomService gameRoomService;
    
    /**
     * Create a new game room
     */
    @PostMapping("/rooms")
    public ResponseEntity<GameRoomDto> createGameRoom(
            @RequestBody CreateGameRoomRequest request,
            @RequestHeader("X-User-ID") Long userId) {
        log.info("Creating game room for user {}: {}", userId, request);
        GameRoomDto createdRoom = gameRoomService.createGameRoom(request, userId);
        return ResponseEntity.ok(createdRoom);
    }
    
    /**
     * Get all active game rooms
     */
    @GetMapping("/rooms")
    public ResponseEntity<List<GameRoomDto>> getActiveGameRooms() {
        log.info("Getting all active game rooms");
        List<GameRoomDto> activeRooms = gameRoomService.getActiveGameRooms();
        return ResponseEntity.ok(activeRooms);
    }
    
    /**
     * Get game rooms by type
     */
    @GetMapping("/rooms/type/{gameType}")
    public ResponseEntity<List<GameRoomDto>> getGameRoomsByType(@PathVariable String gameType) {
        log.info("Getting game rooms of type: {}", gameType);
        List<GameRoomDto> rooms = gameRoomService.getGameRoomsByType(gameType);
        return ResponseEntity.ok(rooms);
    }
    
    /**
     * Get a game room by ID
     */
    @GetMapping("/rooms/{roomId}")
    public ResponseEntity<GameRoomDto> getGameRoomById(@PathVariable Long roomId) {
        log.info("Getting game room with ID: {}", roomId);
        GameRoomDto room = gameRoomService.getGameRoomById(roomId);
        return ResponseEntity.ok(room);
    }
    
    /**
     * Join a game room
     */
    @PostMapping("/rooms/{roomId}/join")
    public ResponseEntity<GameRoomDto> joinGameRoom(
            @PathVariable Long roomId,
            @RequestHeader("X-User-ID") Long userId) {
        log.info("User {} is joining game room {}", userId, roomId);
        GameRoomDto updatedRoom = gameRoomService.joinGameRoom(roomId, userId);
        return ResponseEntity.ok(updatedRoom);
    }
    
    /**
     * Join a game room by invite code
     */
    @PostMapping("/rooms/join/code/{inviteCode}")
    public ResponseEntity<GameRoomDto> joinGameRoomByInviteCode(
            @PathVariable String inviteCode,
            @RequestHeader("X-User-ID") Long userId) {
        log.info("User {} is joining game room with invite code {}", userId, inviteCode);
        GameRoomDto updatedRoom = gameRoomService.joinGameRoomByInviteCode(inviteCode, userId);
        return ResponseEntity.ok(updatedRoom);
    }
    
    /**
     * Leave a game room
     */
    @PostMapping("/rooms/{roomId}/leave")
    public ResponseEntity<Void> leaveGameRoom(
            @PathVariable Long roomId,
            @RequestHeader("X-User-ID") Long userId) {
        log.info("User {} is leaving game room {}", userId, roomId);
        gameRoomService.leaveGameRoom(roomId, userId);
        return ResponseEntity.ok().build();
    }
    
    /**
     * Kick a player from a game room
     */
    @PostMapping("/rooms/{roomId}/kick/{playerId}")
    public ResponseEntity<GameRoomDto> kickPlayer(
            @PathVariable Long roomId,
            @PathVariable Long playerId,
            @RequestHeader("X-User-ID") Long userId) {
        log.info("User {} is kicking player {} from game room {}", userId, playerId, roomId);
        GameRoomDto updatedRoom = gameRoomService.kickPlayer(roomId, playerId, userId);
        return ResponseEntity.ok(updatedRoom);
    }
    
    /**
     * Start a game
     */
    @PostMapping("/rooms/{roomId}/start")
    public ResponseEntity<GameRoomDto> startGame(
            @PathVariable Long roomId,
            @RequestHeader("X-User-ID") Long userId) {
        log.info("User {} is starting game in room {}", userId, roomId);
        GameRoomDto updatedRoom = gameRoomService.startGame(roomId, userId);
        return ResponseEntity.ok(updatedRoom);
    }
    
    /**
     * Cancel a game
     */
    @PostMapping("/rooms/{roomId}/cancel")
    public ResponseEntity<Void> cancelGame(
            @PathVariable Long roomId,
            @RequestHeader("X-User-ID") Long userId) {
        log.info("User {} is canceling game in room {}", userId, roomId);
        gameRoomService.cancelGame(roomId, userId);
        return ResponseEntity.ok().build();
    }
    
    /**
     * Get all game rooms for a user
     */
    @GetMapping("/user/rooms")
    public ResponseEntity<List<GameRoomDto>> getUserGameRooms(
            @RequestHeader("X-User-ID") Long userId) {
        log.info("Getting game rooms for user {}", userId);
        List<GameRoomDto> rooms = gameRoomService.getUserGameRooms(userId);
        return ResponseEntity.ok(rooms);
    }
} 