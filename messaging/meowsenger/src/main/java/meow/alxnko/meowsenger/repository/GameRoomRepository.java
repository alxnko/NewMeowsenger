package meow.alxnko.meowsenger.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import meow.alxnko.meowsenger.model.GameRoom;
import meow.alxnko.meowsenger.model.GameStatus;
import meow.alxnko.meowsenger.model.User;

import java.util.List;
import java.util.Optional;

@Repository
public interface GameRoomRepository extends JpaRepository<GameRoom, Long> {
    
    List<GameRoom> findByStatus(GameStatus status);
    
    List<GameRoom> findByOwner(User owner);
    
    List<GameRoom> findByPlayersContaining(User player);
    
    List<GameRoom> findByGameType(String gameType);
    
    Optional<GameRoom> findByInviteCode(String inviteCode);
    
    List<GameRoom> findByIsActiveTrue();
} 