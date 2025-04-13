package meow.alxnko.meowsenger.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import meow.alxnko.meowsenger.model.Chat;
import meow.alxnko.meowsenger.model.Message;
import meow.alxnko.meowsenger.model.Update;
import meow.alxnko.meowsenger.repository.ChatRepository;
import meow.alxnko.meowsenger.repository.MessageRepository;
import meow.alxnko.meowsenger.repository.UpdateRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class UpdateService {

    private final UpdateRepository updateRepository;
    private final ChatRepository chatRepository;
    private final MessageRepository messageRepository;
    
    /**
     * Create an update record for a new message
     */
    @Transactional
    public Update createUpdate(Long chatId, Long messageId) {
        // Get the chat
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new RuntimeException("Chat not found"));
                
        // Get the message
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));
        
        // Update the chat's last activity timestamp
        chat.setLastTime(LocalDateTime.now());
        chatRepository.save(chat);
        
        // Create and save the update
        Update update = Update.builder()
                .chat(chat)
                .message(message)
                .time(LocalDateTime.now())
                .build();
        
        return updateRepository.save(update);
    }
    
    /**
     * Get recent updates for a chat
     */
    public List<Update> getRecentUpdatesForChat(Long chatId) {
        return updateRepository.findByChatId(chatId);
    }
}