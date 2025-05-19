package meow.alxnko.meowsenger;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.boot.web.servlet.server.ConfigurableServletWebServerFactory;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import lombok.extern.slf4j.Slf4j;

@SpringBootApplication
@EnableWebMvc
@Slf4j
public class MeowsengerApplication {

	public static void main(String[] args) {
		log.info("Starting Meowsenger WebSocket application...");
		SpringApplication.run(MeowsengerApplication.class, args);
		log.info("Meowsenger WebSocket application started");
	}

	/**
	 * Ensure the server listens on the port specified by the PORT environment variable
	 */
	@Bean
	public WebServerFactoryCustomizer<ConfigurableServletWebServerFactory> webServerFactoryCustomizer() {
		return factory -> {
			// Get port from environment variable or use default
			String port = System.getenv("PORT");
			if (port != null && !port.isEmpty()) {
				int portNumber = Integer.parseInt(port);
				log.info("Setting server port to: {}", portNumber);
				factory.setPort(portNumber);
			} else {
				log.info("Using default port: 8080");
				factory.setPort(8080);
			}
		};
	}

}
