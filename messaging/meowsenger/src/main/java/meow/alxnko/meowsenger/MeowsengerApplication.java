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
	 * only when deployed, otherwise use application properties
	 */
	@Bean
	public WebServerFactoryCustomizer<ConfigurableServletWebServerFactory> webServerFactoryCustomizer() {
		return factory -> {
			// Get port from environment variable only for deployment
			String port = System.getenv("PORT");
			if (port != null && !port.isEmpty()) {
				int portNumber = Integer.parseInt(port);
				log.info("Setting server port from environment variable to: {}", portNumber);
				factory.setPort(portNumber);
			} else {
				// Let Spring use the port defined in application.properties
				log.info("Using port configured in application.properties");
			}
		};
	}

}
